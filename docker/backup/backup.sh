#!/bin/sh
# Daily pg_dump -Fc of the compose database to s3://$S3_BUCKET/backups/$DEPLOY_ENV/, keeps BACKUP_KEEP_DAYS days but
# never fewer than the newest BACKUP_KEEP_MIN dumps. Connection from PG* env, bucket from S3_*. Logs names and sizes only.
# Every step returns on failure (set -e does not apply inside `backup || ...`): no upload without a verified dump, no
# pruning without a verified upload.
set -eu

: "${BACKUP_HOUR_UTC:=3}"
: "${BACKUP_KEEP_DAYS:=14}"
: "${BACKUP_KEEP_MIN:=3}"

if [ -z "${S3_BUCKET:-}" ] || [ -z "${S3_ACCESS_KEY_ID:-}" ] || [ -z "${S3_SECRET_ACCESS_KEY:-}" ]; then
  echo "backup: S3_BUCKET and S3 keys not set, no backups"
  exec sleep infinity
fi

export RCLONE_LOG_LEVEL=ERROR RCLONE_CONFIG_S3_TYPE=s3 RCLONE_CONFIG_S3_PROVIDER=Other RCLONE_CONFIG_S3_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_S3_ENDPOINT="${S3_ENDPOINT:-}" RCLONE_CONFIG_S3_REGION="${S3_REGION:-auto}"
export RCLONE_CONFIG_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export RCLONE_S3_NO_CHECK_BUCKET=true
dir="s3:$S3_BUCKET/backups/${DEPLOY_ENV:?}"

fail() {
  echo "backup: failed: $1" >&2
  rm -f "$file"
  return 1
}

prune() {
  keep=$(rclone lsf --files-only "$dir" | grep '\.dump$' | sort | tail -n "$BACKUP_KEEP_MIN") || return 1
  old=$(rclone lsf --files-only --min-age "${BACKUP_KEEP_DAYS}d" "$dir" | grep '\.dump$') || return 0
  for name in $old; do
    printf '%s\n' "$keep" | grep -qxF "$name" && continue
    rclone deletefile "$dir/$name" || return 1
    echo "backup: pruned backups/$DEPLOY_ENV/$name"
  done
}

backup() {
  name="$PGDATABASE-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
  file="/tmp/$name"
  pg_dump -Fc --no-owner --no-privileges -f "$file" || { fail "pg_dump exited $?"; return 1; }
  [ -s "$file" ] || { fail "empty dump"; return 1; }
  pg_restore --list "$file" >/dev/null || { fail "dump is not readable by pg_restore"; return 1; }
  size=$(wc -c <"$file")
  rclone copyto "$file" "$dir/$name" || { fail "upload of $name"; return 1; }
  remote=$(rclone size --json "$dir/$name" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')
  [ "$remote" = "$size" ] || { fail "uploaded $name is $remote bytes, expected $size"; return 1; }
  rm -f "$file"
  echo "backup: uploaded backups/$DEPLOY_ENV/$name ($size bytes)"
  prune || { echo "backup: failed: pruning, dumps kept" >&2; return 1; }
}

if [ "${1:-}" = "now" ]; then
  backup
  exit $?
fi

while true; do
  wait=$(((86400 + BACKUP_HOUR_UTC * 3600 - $(date -u +%s) % 86400) % 86400))
  echo "backup: next run in ${wait}s"
  sleep "$wait"
  backup || echo "backup: no new dump today, retrying tomorrow" >&2
  sleep 60
done
