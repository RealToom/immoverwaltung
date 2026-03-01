#!/bin/bash
# Admin-Passwort zurücksetzen + Account entsperren
# Aufruf: ./reset-password.sh "admin@firma.de" "NeuesPasswort123!"

set -e

EMAIL="$1"
NEW_PASSWORD="$2"

if [ -z "$EMAIL" ] || [ -z "$NEW_PASSWORD" ]; then
  echo "Aufruf: $0 \"admin@firma.de\" \"NeuesPasswort123!\""
  exit 1
fi

echo "==> Passwort wird gehasht..."
HASH=$(docker exec immoverwaltung-backend node -e "
const bcrypt = require('bcrypt');
bcrypt.hash(process.argv[1], 12).then(h => { process.stdout.write(h); process.exit(0); });
" "$NEW_PASSWORD")

echo "==> Passwort wird gesetzt und Account entsperrt..."
ROWS=$(docker exec immoverwaltung-db psql -U immo -d immoverwaltung -tAc "
UPDATE users
SET password_hash='$HASH', failed_login_attempts=0, locked_until=NULL, updated_at=NOW()
WHERE email='$EMAIL'
RETURNING id;
")

if [ -z "$ROWS" ]; then
  echo "FEHLER: Kein User mit E-Mail '$EMAIL' gefunden."
  exit 1
fi

echo ""
echo "✓ Passwort zurückgesetzt!"
echo "  Login:     $EMAIL"
echo "  Passwort:  $NEW_PASSWORD"
