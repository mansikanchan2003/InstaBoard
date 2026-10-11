#!/usr/bin/env bash
# Logical backup of the InstaBoard PostgreSQL database (pg_dump custom format, compressed).
#
#   deploy/backup.sh                         # container instaboard-prod-db-1 (prod compose), db/user from deploy/.env.production
#   DB_CONTAINER=instaboard-db PG_USER=instaboard PG_DB=instaboard deploy/backup.sh   # local dev container
#
# Writes backups/instaboard-<UTC timestamp>.dump plus a .sha256 checksum. Copy backups OFF the host (object storage
# with encryption + retention). The dump contains encrypted Instagram tokens; restoring them also needs the same
# INSTAGRAM_TOKEN_ENCRYPTION_KEY(s) — keep the key separately from the backups.
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -f deploy/.env.production ]]; then set -a; . deploy/.env.production; set +a; fi
CONTAINER="${DB_CONTAINER:-instaboard-prod-db-1}"
USER_NAME="${PG_USER:-${POSTGRES_USER:-instaboard}}"
DB_NAME="${PG_DB:-${POSTGRES_DB:-instaboard}}"
OUT_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/instaboard-$STAMP.dump"

docker exec "$CONTAINER" pg_dump -U "$USER_NAME" -d "$DB_NAME" --format=custom --compress=6 --no-owner --no-privileges > "$FILE"
if [[ ! -s "$FILE" ]]; then echo "backup failed: empty file" >&2; rm -f "$FILE"; exit 1; fi
( cd "$OUT_DIR" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
# Sanity check: the archive's table of contents must be readable.
docker exec -i "$CONTAINER" pg_restore --list < "$FILE" > /dev/null
echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"
