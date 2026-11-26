# Keep the major in step with the postgres service in docker-compose.deploy.yml: pg_dump refuses a newer server.
FROM postgres:17-alpine
RUN apk add --no-cache rclone
COPY docker/backup/backup.sh /usr/local/bin/db-backup
COPY scripts/db-restore.sh /usr/local/bin/db-restore
ENTRYPOINT []
CMD ["db-backup"]
