#!/usr/bin/env bash
# Restore an InstaBoard backup into a database and verify it.
#
#   deploy/restore.sh backups/instaboard-20261011T120000Z.dump                 # → restores into instaboard_restore_check
#   deploy/restore.sh FILE --target-db instaboard_staging
#   deploy/restore.sh FILE --target-db instaboard --overwrite-live             # DANGER: replaces the live database
#
# Default target is a separate verification database so a restore test never touches live data. Restoring over the
# live database requires --overwrite-live AND typing the database name; stop api/worker/beat first.
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -f deploy/.env.production ]]; then set -a; . deploy/.env.production; set +a; fi
FILE="${1:?usage: deploy/restore.sh BACKUP_FILE [--target-db NAME] [--overwrite-live]}"; shift || true
TARGET="instaboard_restore_check"
OVERWRITE_LIVE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-db) TARGET="$2"; shift 2 ;;
    --overwrite-live) OVERWRITE_LIVE=1; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
CONTAINER="${DB_CONTAINER:-instaboard-prod-db-1}"
USER_NAME="${PG_USER:-${POSTGRES_USER:-instaboard}}"
LIVE_DB="${PG_DB:-${POSTGRES_DB:-instaboard}}"

[[ -s "$FILE" ]] || { echo "backup file not found or empty: $FILE" >&2; exit 1; }
if [[ -f "$FILE.sha256" ]]; then ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" ); fi
if [[ "$TARGET" == "$LIVE_DB" ]]; then
  if [[ "$OVERWRITE_LIVE" != 1 ]]; then echo "refusing to restore over the live database '$LIVE_DB' without --overwrite-live" >&2; exit 3; fi
  read -r -p "This DROPS and replaces '$LIVE_DB'. Type the database name to continue: " answer
  [[ "$answer" == "$LIVE_DB" ]] || { echo "aborted" >&2; exit 4; }
fi

docker exec "$CONTAINER" dropdb -U "$USER_NAME" --if-exists "$TARGET"
docker exec "$CONTAINER" createdb -U "$USER_NAME" "$TARGET"
docker exec -i "$CONTAINER" pg_restore -U "$USER_NAME" -d "$TARGET" --no-owner --no-privileges --exit-on-error < "$FILE"

echo "restored into '$TARGET'. Verification:"
docker exec "$CONTAINER" psql -U "$USER_NAME" -d "$TARGET" -v ON_ERROR_STOP=1 -At -c "
  SELECT 'alembic_version=' || version_num FROM alembic_version;
  SELECT 'workspaces=' || count(*) FROM workspaces;
  SELECT 'users=' || count(*) FROM users;
  SELECT 'campaigns=' || count(*) FROM campaigns;
  SELECT 'instagram_connections=' || count(*) FROM instagram_connections;
  SELECT 'insights=' || count(*) FROM insights;"
