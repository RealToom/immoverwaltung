#!/bin/bash
# Neue Kundenfirma + Admin-User anlegen
# Aufruf: ./new-tenant.sh "Firma GmbH" "admin@firma.de" "Passwort123!"

set -e

COMPANY_NAME="$1"
ADMIN_EMAIL="$2"
ADMIN_PASSWORD="$3"
ADMIN_NAME="${4:-Admin}"

if [ -z "$COMPANY_NAME" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "Aufruf: $0 \"Firma GmbH\" \"admin@firma.de\" \"Passwort123!\" [\"Admin Name\"]"
  exit 1
fi

# Slug aus Firmenname generieren (lowercase, nur a-z0-9, Bindestriche)
SLUG=$(echo "$COMPANY_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')

echo "==> Firmenname:  $COMPANY_NAME"
echo "==> Slug:        $SLUG"
echo "==> Admin-Email: $ADMIN_EMAIL"
echo ""

# Passwort hashen
echo "==> Passwort wird gehasht..."
HASH=$(docker exec immoverwaltung-backend node -e "
const bcrypt = require('bcrypt');
bcrypt.hash(process.argv[1], 12).then(h => { process.stdout.write(h); process.exit(0); });
" "$ADMIN_PASSWORD")

echo "==> Firma wird angelegt..."
COMPANY_ID=$(docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -tAc "
INSERT INTO \"Company\" (name, slug, address, tax_number, \"createdAt\", \"updatedAt\")
VALUES ('$COMPANY_NAME', '$SLUG', '', '', NOW(), NOW())
RETURNING id;
")

if [ -z "$COMPANY_ID" ]; then
  echo "FEHLER: Firma konnte nicht angelegt werden (Slug bereits vergeben?)"
  exit 1
fi

echo "==> User wird angelegt..."
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c "
INSERT INTO \"User\" (email, password_hash, name, role, \"companyId\", \"createdAt\", \"updatedAt\")
VALUES ('$ADMIN_EMAIL', '$HASH', '$ADMIN_NAME', 'ADMIN', $COMPANY_ID, NOW(), NOW());
" > /dev/null

echo ""
echo "✓ Erfolgreich angelegt!"
echo "  Firma-ID:  $COMPANY_ID"
echo "  Firma:     $COMPANY_NAME"
echo "  Login:     $ADMIN_EMAIL"
echo "  Passwort:  $ADMIN_PASSWORD"
