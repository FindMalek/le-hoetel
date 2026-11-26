#!/bin/sh
# Daily pg_dump -Fc of the compose database to s3://$S3_BUCKET/backups/$DEPLOY_ENV/, keeps BACKUP_KEEP_DAYS days.
# Connection from PG* env, bucket from S3_*. Logs object names and sizes only.
set -eu

: "${BACKUP_HOUR_UTC:=3}"
: "${BACKUP_KEEP_DAYS:=14}"

if [ -z "${S3_BUCKET:-}" ] || [ -z "${S3_ACCESS_KEY_ID:-}" ] || [ -z "${S3_SECRET_ACCESS_KEY:-}" ]; then
  echo "backup: S3_BUCKET and S3 keys not set, no backups"
  exec sleep infinity
fi

export RCLONE_LOG_LEVEL=ERROR RCLONE_CONFIG_S3_TYPE=s3 RCLONE_CONFIG_S3_PROVIDER=Other RCLONE_CONFIG_S3_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_S3_ENDPOINT="${S3_ENDPOINT:-}" RCLONE_CONFIG_S3_REGION="${S3_REGION:-auto}"
export RCLONE_CONFIG_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export RCLONE_S3_NO_CHECK_BUCKET=true
dir="s3:$S3_BUCKET/backups/${DEPLOY_ENV:?}"

backup() {
  file="/tmp/$PGDATABASE-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
  pg_dump -Fc --no-owner --no-privileges -f "$file"
  rclone copyto "$file" "$dir/${file##*/}"
  echo "backup: uploaded backups/$DEPLOY_ENV/${file##*/} ($(wc -c <"$file") bytes)"
  rm -f "$file"
  rclone delete --min-age "${BACKUP_KEEP_DAYS}d" "$dir"
}

if [ "${1:-}" = "now" ]; then
  backup
  exit 0
fi

while true; do
  wait=$(((86400 + BACKUP_HOUR_UTC * 3600 - $(date -u +%s) % 86400) % 86400))
  echo "backup: next run in ${wait}s"
  sleep "$wait"
  backup || echo "backup: failed, retrying tomorrow"
  sleep 60
done
