# syntax=docker/dockerfile:1
# GlucoBuddy API, production image. Build from the repo root (it needs packages/shared and the app's food data):
#   docker build -f server/Dockerfile -t glucobuddy-api .
# Behind a TLS-inspecting proxy (Zscaler) add: --secret id=ca,src=certs/extra-ca.pem  (not stored in the image)
FROM node:22-alpine AS build
WORKDIR /app
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then cat /run/secrets/ca >> /etc/ssl/certs/ca-certificates.crt; fi; apk add --no-cache openssl
COPY server/package.json server/package-lock.json server/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; cd server && npm ci --no-audit --no-fund
COPY packages packages
COPY src src
COPY server server
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; cd server && npx prisma generate && npm run build

FROM node:22-alpine
RUN --mount=type=secret,id=ca,required=false \
    cp /etc/ssl/certs/ca-certificates.crt /tmp/ca.bak; if [ -f /run/secrets/ca ]; then cat /run/secrets/ca >> /etc/ssl/certs/ca-certificates.crt; fi; \
    apk add --no-cache openssl; cp /tmp/ca.bak /etc/ssl/certs/ca-certificates.crt; rm /tmp/ca.bak
ENV NODE_ENV=production PORT=4000
WORKDIR /app/server
# Dev dependencies stay: tsx runs the one-time catalog seed (npm run db:seed:production).
COPY --from=build /app/server/node_modules node_modules
COPY --from=build /app/server/package.json /app/server/tsconfig.json ./
COPY --from=build /app/server/dist dist
COPY --from=build /app/server/prisma prisma
# The seed reuses a few server helpers (stats, messages) from source.
COPY --from=build /app/server/src src
COPY --from=build /app/packages /app/packages
COPY --from=build /app/src /app/src
USER node
EXPOSE 4000
# Database migrations run on every start (safe: only new ones are applied).
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
