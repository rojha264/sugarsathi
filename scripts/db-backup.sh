#!/bin/sh
# Dumps the database to db/glucobuddy-full.sql.gz (all data) and db/schema.sql (tables only).
#   scripts/db-backup.sh                 # local stack (docker-compose.yml)
#   scripts/db-backup.sh prod            # VPS stack (deploy/docker-compose.prod.yml + deploy/.env)
set -e
cd "$(dirname "$0")/.."
C=""
[ "$1" = prod ] && C="-f deploy/docker-compose.prod.yml --env-file deploy/.env"
mkdir -p db
dump() { docker compose $C exec -T db pg_dump -U glucobuddy -d glucobuddy --no-owner --no-privileges "$@"; }
dump --schema-only > db/schema.sql.tmp && mv db/schema.sql.tmp db/schema.sql
dump --clean --if-exists | gzip -9 > db/glucobuddy-full.sql.gz.tmp && mv db/glucobuddy-full.sql.gz.tmp db/glucobuddy-full.sql.gz
echo "db/schema.sql $(wc -l < db/schema.sql | tr -d ' ') lines · db/glucobuddy-full.sql.gz $(du -h db/glucobuddy-full.sql.gz | cut -f1)"
