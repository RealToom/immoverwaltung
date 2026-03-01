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

# Willkommens-E-Mail senden (nur wenn SMTP konfiguriert)
echo ""
echo "==> Willkommens-E-Mail wird gesendet..."
docker exec immoverwaltung-backend node -e "
import('nodemailer').then(({ default: nodemailer }) => {
  if (!process.env.SMTP_HOST) { console.log('SMTP nicht konfiguriert, E-Mail übersprungen.'); process.exit(0); }
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return t.sendMail({
    from: process.env.SMTP_FROM,
    to: process.argv[1],
    subject: 'Willkommen bei Immoverwalt – Ihre Zugangsdaten',
    html: \`
      <div style=\"font-family:sans-serif;max-width:520px;margin:0 auto\">
        <h2 style=\"color:#1a1a1a\">Willkommen bei Immoverwalt!</h2>
        <p>Hallo ${ADMIN_NAME},</p>
        <p>Ihr Zugang für <strong>${COMPANY_NAME}</strong> wurde eingerichtet. Sie können sich ab sofort einloggen:</p>
        <div style=\"background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0\">
          <p style=\"margin:4px 0\"><strong>Login-Seite:</strong> <a href=\"https://hasverl.xyz\">https://hasverl.xyz</a></p>
          <p style=\"margin:4px 0\"><strong>E-Mail:</strong> ${ADMIN_EMAIL}</p>
          <p style=\"margin:4px 0\"><strong>Passwort:</strong> ${ADMIN_PASSWORD}</p>
        </div>
        <p style=\"color:#666;font-size:13px\">Bitte ändern Sie Ihr Passwort nach dem ersten Login unter Einstellungen → Sicherheit.</p>
        <p style=\"color:#666;font-size:13px\">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
      </div>
    \`,
  });
}).then(() => console.log('✓ E-Mail gesendet')).catch(e => console.log('E-Mail fehlgeschlagen:', e.message));
" "$ADMIN_EMAIL"
