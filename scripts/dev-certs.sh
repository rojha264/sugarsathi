#!/bin/sh
# Writes certs/extra-ca.pem for containers behind a corporate TLS proxy (Zscaler on macOS).
# Without a proxy the file stays empty and nothing changes.
set -e
cd "$(dirname "$0")/.."
mkdir -p certs
security find-certificate -a -p -c "Zscaler Root CA" /Library/Keychains/System.keychain > certs/extra-ca.pem 2>/dev/null || : > certs/extra-ca.pem
echo "certs/extra-ca.pem: $(grep -c 'BEGIN CERT' certs/extra-ca.pem || true) certificate(s)"
