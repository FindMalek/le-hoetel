#!/bin/sh
# Restores a dump made by the backup service into a database on the compose postgres. Runs inside the backup container,
# which has pg_restore, the PG* connection (no password on the command line) and the bucket settings:
#   docker exec -it <backup container> db-restore [--prod] <dump name|latest> <target database name>
#   docker exec <backup container> db-restore list
# Production refuses without --prod. With a terminal it asks you to type the target database name.
# Steps and checks: docs page deploy-runbook, "Restore a backup".
set -eu

usage="usage: db-restore list | db-restore [--prod] <dump name|latest> <target database name>"
prod=false
if [ "${1:-}" = "--prod" ]; then
  prod=true
  shift
fi
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

case "$target" in
  *[!A-Za-z0-9_]*) echo "restore: the target is a database name, not a url (the connection comes from PG* env)" >&2; exit 1 ;;
esac
if [ "$DEPLOY_ENV" = "production" ] && [ "$prod" != true ]; then
  echo "restore: DEPLOY_ENV is production, pass --prod to restore here" >&2
  exit 1
fi
if [ -t 0 ]; then
  printf 'restore into database "%s" on %s (%s)? type the database name to confirm: ' "$target" "${PGHOST:-local}" "$DEPLOY_ENV"
  read -r typed
  [ "$typed" = "$target" ] || { echo "restore: not confirmed, nothing changed" >&2; exit 1; }
fi

if [ "$name" = "latest" ]; then
  name=$(rclone lsf --files-only "$dir" | grep '\.dump$' | sort | tail -n 1) || true
  [ -n "$name" ] || { echo "restore: no dump in backups/$DEPLOY_ENV/" >&2; exit 1; }
fi

file="/tmp/$name"
trap 'rm -f "$file"' EXIT
rclone copyto "$dir/$name" "$file"
echo "restore: downloaded backups/$DEPLOY_ENV/$name ($(wc -c <"$file") bytes)"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error -d "$target" "$file"
echo "restore: done into $target"
