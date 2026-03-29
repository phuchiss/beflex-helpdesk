#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DOMAIN_NAME="${DOMAIN_NAME:?DOMAIN_NAME is required in .env}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL is required in .env}"
STAGING="${CERTBOT_STAGING:-0}"
RSA_KEY_SIZE=4096

if [ -d "./certbot/conf/live/$DOMAIN_NAME" ]; then
  echo "Certificate already exists for $DOMAIN_NAME"
  read -p "Replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit 0
  fi
fi

echo "### Downloading recommended TLS parameters ..."
mkdir -p "./certbot/conf/live/$DOMAIN_NAME"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "./certbot/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./certbot/conf/ssl-dhparams.pem"

echo "### Creating dummy certificate for $DOMAIN_NAME ..."
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Generating nginx config ..."
sed "s/__DOMAIN_NAME__/$DOMAIN_NAME/g" nginx/nginx.conf > nginx/nginx.generated.conf

echo "### Starting nginx ..."
docker compose up --force-recreate -d nginx

echo "### Deleting dummy certificate ..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN_NAME && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN_NAME && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN_NAME.conf" certbot

echo "### Requesting Let's Encrypt certificate for $DOMAIN_NAME ..."

staging_arg=""
if [ "$STAGING" != "0" ]; then
  staging_arg="--staging"
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    --email $CERTBOT_EMAIL \
    --domain $DOMAIN_NAME \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo ""
echo "=== SSL certificate installed successfully! ==="
echo "Site available at: https://$DOMAIN_NAME"
