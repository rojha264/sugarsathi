# Database export

| File | What it is |
|---|---|
| `glucobuddy-full.sql.gz` | Full PostgreSQL 16 dump: every table and row, including Prisma's migration history. Taken from the local dev stack on 2026-11-04. |
| `schema.sql` | Tables, indexes and constraints only, for reading or diffing. The source of truth is still `server/prisma/schema.prisma` and its migrations. |

> [!CAUTION]
> The full dump has every account in the dev database: demo patients and staff whose password is `Admin@123`, one real phone number with its health logs, OTP requests and audit logs. Keep this repository private. Before the server faces the internet, change every staff password or start from `db:seed:production` instead.

## Use it on another machine

**Local development** (Docker, from the repo root):

```sh
docker compose up -d                  # creates the database, then migrates and seeds it
scripts/db-restore.sh                 # replaces that data with db/glucobuddy-full.sql.gz
```

**VPS** (after following [docs/PUBLISHING.md](../docs/PUBLISHING.md) §3 up to step 3.5):

```sh
scripts/db-restore.sh db/glucobuddy-full.sql.gz prod
```

Skip §3.6 (`db:seed:production`) when you restore, because the dump already has the food catalog and logins.

## Make a new export

```sh
scripts/db-backup.sh          # local stack → db/
scripts/db-backup.sh prod     # VPS stack → db/
```

The VPS also writes a nightly dump to `deploy/backups/`. Restore one with `scripts/db-restore.sh deploy/backups/glucobuddy-YYYY-MM-DD.sql.gz prod`.
