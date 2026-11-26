#!/bin/sh
# Restores a dump made by the backup service into a database. Runs inside the backup container, which has pg_restore
# and the bucket settings: docker exec <backup container> db-restore <dump name|latest> <target database url>
# `db-restore list` prints the dumps of this environment.
# Steps and checks: docs page deploy-runbook, "Restore a backup".
set -eu

usage="usage: db-restore list | db-restore <dump name|latest> <target database url>"
name="${1:?$usage}"

export RCLONE_LOG_LEVEL=ERROR RCLONE_CONFIG_S3_TYPE=s3 RCLONE_CONFIG_S3_PROVIDER=Other RCLONE_CONFIG_S3_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_S3_ENDPOINT="${S3_ENDPOINT:-}" RCLONE_CONFIG_S3_REGION="${S3_REGION:-auto}"
export RCLONE_CONFIG_S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:?}" RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:?}"
dir="s3:${S3_BUCKET:?}/backups/${DEPLOY_ENV:?}"

if [ "$name" = "list" ]; then
  rclone lsl "$dir"
  exit 0
fi
target="${2:?$usage}"

if [ "$name" = "latest" ]; then
  name=$(rclone lsf --files-only "$dir" | grep '\.dump$' | sort | tail -n 1)
  [ -n "$name" ] || { echo "restore: no dump in backups/$DEPLOY_ENV/" >&2; exit 1; }
fi

file="/tmp/$name"
rclone copyto "$dir/$name" "$file"
echo "restore: downloaded backups/$DEPLOY_ENV/$name ($(wc -c <"$file") bytes)"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error -d "$target" "$file"
rm -f "$file"
echo "restore: done"
