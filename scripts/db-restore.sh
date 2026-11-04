#!/bin/sh
# Replaces the database with a dump made by scripts/db-backup.sh (or a nightly deploy/backups/*.sql.gz).
# Everything currently in the database is overwritten.
#   scripts/db-restore.sh [dump.sql.gz]          # local stack
#   scripts/db-restore.sh [dump.sql.gz] prod     # VPS stack
set -e
cd "$(dirname "$0")/.."
file=${1:-db/glucobuddy-full.sql.gz}
[ -f "$file" ] || { echo "No dump at $file"; exit 1; }
C=""
[ "$2" = prod ] && C="-f deploy/docker-compose.prod.yml --env-file deploy/.env"
# Only the database runs during the restore, so the API cannot write half-way through.
docker compose $C stop api 2>/dev/null || true
docker compose $C up -d --wait db
gunzip -c "$file" | docker compose $C exec -T db psql -U glucobuddy -d glucobuddy -q -v ON_ERROR_STOP=1 > /dev/null
docker compose $C up -d
echo "Restored $file: $(docker compose $C exec -T db psql -U glucobuddy -d glucobuddy -tAc 'select count(*) from "User"') users"
