# syntax=docker/dockerfile:1
# GlucoBuddy admin panel, production image: a static build served by nginx. Build from the repo root:
#   docker build -f admin/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t glucobuddy-admin .
# Behind a TLS-inspecting proxy (Zscaler) add: --secret id=ca,src=certs/extra-ca.pem  (not stored in the image)
FROM node:22-alpine AS build
WORKDIR /app
COPY admin/package.json admin/package-lock.json admin/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; cd admin && npm ci --no-audit --no-fund
COPY packages packages
COPY admin admin
# Vite bakes these into the JavaScript at build time.
ARG VITE_API_URL
ARG VITE_SENTRY_DSN=
ENV VITE_API_URL=$VITE_API_URL VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN test -n "$VITE_API_URL" || (echo "Pass --build-arg VITE_API_URL=https://your-api" && exit 1)
RUN cd admin && npm run build

FROM nginx:1.27-alpine
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/admin/dist /usr/share/nginx/html
EXPOSE 80
