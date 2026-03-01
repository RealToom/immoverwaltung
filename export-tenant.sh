#!/bin/bash
# DSGVO-Datenauskunft: alle Daten einer Kundenfirma exportieren
# Aufruf: ./export-tenant.sh "Firma GmbH"

set -e

COMPANY_NAME="$1"

if [ -z "$COMPANY_NAME" ]; then
  echo "Aufruf: $0 \"Firma GmbH\""
  exit 1
fi

COMPANY_ID=$(docker exec immoverwaltung-db psql -U immo -d immoverwaltung -tAc "
SELECT id FROM companies WHERE name = '$COMPANY_NAME';
")

if [ -z "$COMPANY_ID" ]; then
  echo "FEHLER: Keine Firma mit dem Namen '$COMPANY_NAME' gefunden."
  exit 1
fi

DATE=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="/tmp/dsgvo_export_${COMPANY_ID}_${DATE}"
mkdir -p "$EXPORT_DIR"

echo "==> Exportiere Daten für '$COMPANY_NAME' (ID: $COMPANY_ID)..."

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT id, name, slug, address, tax_number, created_at FROM companies WHERE id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/firma.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT id, name, email, role, created_at FROM users WHERE company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/benutzer.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT id, name, street, zip, city, status, created_at FROM properties WHERE company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/immobilien.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT u.id, p.name AS immobilie, u.number, u.floor, u.area, u.rent, u.type, u.status FROM units u JOIN properties p ON p.id = u.property_id WHERE p.company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/einheiten.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT id, name, email, phone, move_in, created_at FROM tenants WHERE company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/mieter.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT c.id, t.name AS mieter, p.name AS immobilie, u.number AS einheit, c.type, c.start_date, c.end_date, c.monthly_rent, c.deposit, c.status FROM contracts c JOIN tenants t ON t.id = c.tenant_id JOIN properties p ON p.id = c.property_id JOIN units u ON u.id = c.unit_id WHERE c.company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/vertraege.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT t.id, t.date, t.description, t.amount, t.type, t.category FROM transactions t WHERE t.company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/transaktionen.csv"

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c \
  "COPY (SELECT id, name, type, created_at FROM documents WHERE company_id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/dokumente.csv"

cat > "$EXPORT_DIR/README.txt" << EOF
DSGVO-Datenauskunft
===================
Firma:       $COMPANY_NAME
Firma-ID:    $COMPANY_ID
Erstellt am: $(date '+%d.%m.%Y %H:%M:%S')

Enthaltene Dateien:
  firma.csv          — Firmenstammdaten
  benutzer.csv       — Benutzerkonten (ohne Passwörter)
  immobilien.csv     — Immobilien
  einheiten.csv      — Wohneinheiten / Garagen / Stellplätze
  mieter.csv         — Mieterdaten
  vertraege.csv      — Mietverträge
  transaktionen.csv  — Finanztransaktionen
  dokumente.csv      — Dokumente (Metadaten)
EOF

ZIPFILE="/root/immoverwaltung/dsgvo_${COMPANY_ID}_${DATE}.zip"
cd /tmp && zip -r "$ZIPFILE" "dsgvo_export_${COMPANY_ID}_${DATE}/" > /dev/null
rm -rf "$EXPORT_DIR"

echo ""
echo "✓ Export abgeschlossen!"
echo "  Datei: $ZIPFILE"
echo ""
echo "  Zum Herunterladen auf deinen PC:"
echo "  scp root@hasverl.xyz:$ZIPFILE ."
