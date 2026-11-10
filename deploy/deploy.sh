#!/bin/sh
# Builds the API and admin images on this machine and starts them on the server.
# For small servers that cannot build (1 GB RAM). The server needs deploy/server-setup.sh once and ~/sugarsaathi/deploy/.env.
#   SSH_KEY=~/key.pem deploy/deploy.sh
# Settings (environment): SSH_KEY, SSH_HOST (default ubuntu@43.204.115.219), API_DOMAIN (default api.sugarsathi.in),
#   BUILDER (a `docker buildx ls` name; use one whose daemon trusts your proxy's CA, e.g. colima)
#   SKIP_API=1 (reuse the API image already built), SITE_ONLY=1 (only upload website/ and the Caddy config)
set -e
cd "$(dirname "$0")/.."
SSH_HOST=${SSH_HOST:-ubuntu@43.204.115.219}
API_DOMAIN=${API_DOMAIN:-api.sugarsathi.in}
SSH="ssh ${SSH_KEY:+-i $SSH_KEY} -o ServerAliveInterval=30"
SCP="scp ${SSH_KEY:+-i $SSH_KEY}"
REMOTE=sugarsaathi
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"

# Behind a TLS-inspecting proxy (Zscaler), let the build trust its root CA (not stored in the image).
# The colima builder trusts the proxy's CA; use it when present unless BUILDER says otherwise.
if [ -z "$BUILDER" ] && docker buildx inspect colima >/dev/null 2>&1; then BUILDER=colima; fi
CA="${BUILDER:+--builder $BUILDER}"
[ -s certs/extra-ca.pem ] && CA="$CA --secret id=ca,src=certs/extra-ca.pem"

if [ -z "$SITE_ONLY" ]; then
echo "Building images for linux/amd64…"
[ -n "$SKIP_API" ] || docker buildx build --platform linux/amd64 --load $CA -f server/Dockerfile -t sugarsaathi-api:latest .
docker buildx build --platform linux/amd64 --load $CA -f admin/Dockerfile \
  --build-arg VITE_API_URL="https://$API_DOMAIN" --build-arg VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
  -t sugarsaathi-admin:latest .

echo "Uploading images to $SSH_HOST…"
docker save sugarsaathi-api:latest sugarsaathi-admin:latest | gzip -1 | $SSH "$SSH_HOST" 'gunzip | docker load'
fi

$SSH "$SSH_HOST" "mkdir -p $REMOTE/deploy/backups && test -f $REMOTE/deploy/.env" \
  || { echo "Missing ~/$REMOTE/deploy/.env on the server (copy deploy/.env.production.example and fill it in)"; exit 1; }
$SCP deploy/docker-compose.prod.yml deploy/Caddyfile "$SSH_HOST:$REMOTE/deploy/"
echo "Uploading website…"
# Replaced in place: Caddy's bind mount keeps pointing at the same folder.
COPYFILE_DISABLE=1 tar -C website --exclude .DS_Store -czf - . | $SSH "$SSH_HOST" "mkdir -p $REMOTE/website && find $REMOTE/website -mindepth 1 -delete && tar -C $REMOTE/website -xzf -"

echo "Starting…"
$SSH "$SSH_HOST" "cd $REMOTE && $COMPOSE up -d --no-build --remove-orphans && $COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile && docker image prune -f >/dev/null && $COMPOSE ps"
