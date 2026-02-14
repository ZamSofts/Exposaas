#!/bin/bash
# Daily PostgreSQL backup script
# Usage: Add to crontab on production server:
#   0 3 * * * /path/to/exposaas/extra/scripts/backup-db.sh
#
# Requires DATABASE_URL environment variable or edit the values below.

BACKUP_DIR="${BACKUP_DIR:-/var/backups/exposaas}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

FILENAME="exposaas_$(date +%Y%m%d_%H%M%S).sql.gz"

# Extract connection details from DATABASE_URL if set, otherwise use defaults
if [ -n "$DATABASE_URL" ]; then
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$FILENAME"
else
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ $? -eq 0 ]; then
  echo "Backup created: $BACKUP_DIR/$FILENAME"
  # Delete backups older than KEEP_DAYS
  find "$BACKUP_DIR" -name "exposaas_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
  echo "Cleaned up backups older than $KEEP_DAYS days"
else
  echo "ERROR: Backup failed"
  exit 1
fi
