#!/bin/bash
# DSGVO-Datenauskunft: alle Daten einer Kundenfirma exportieren
# Aufruf: ./export-tenant.sh "Firma GmbH"
# Erstellt eine ZIP-Datei mit allen Daten der Firma

set -e

COMPANY_NAME="$1"

if [ -z "$COMPANY_NAME" ]; then
  echo "Aufruf: $0 \"Firma GmbH\""
  exit 1
fi

# Firma-ID ermitteln
COMPANY_ID=$(docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -tAc "
SELECT id FROM \"Company\" WHERE name = '$COMPANY_NAME';
")

if [ -z "$COMPANY_ID" ]; then
  echo "FEHLER: Keine Firma mit dem Namen '$COMPANY_NAME' gefunden."
  exit 1
fi

DATE=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="/tmp/dsgvo_export_${COMPANY_ID}_${DATE}"
mkdir -p "$EXPORT_DIR"

echo "==> Exportiere Daten für '$COMPANY_NAME' (ID: $COMPANY_ID)..."

# Firmendaten
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT id, name, slug, address, tax_number, \"createdAt\" FROM \"Company\" WHERE id = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/firma.csv"

# Benutzer (ohne Passwort-Hash)
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT id, name, email, role, \"createdAt\" FROM \"User\" WHERE \"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/benutzer.csv"

# Immobilien
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT id, name, street, zip, city, status, \"createdAt\" FROM \"Property\" WHERE \"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/immobilien.csv"

# Einheiten
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT u.id, p.name AS immobilie, u.number, u.floor, u.area, u.rent, u.type, u.status FROM \"Unit\" u JOIN \"Property\" p ON p.id = u.\"propertyId\" WHERE p.\"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/einheiten.csv"

# Mieter
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT id, name, email, phone, \"moveIn\", \"moveOut\", \"createdAt\" FROM \"Tenant\" WHERE \"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/mieter.csv"

# Verträge
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT c.id, t.name AS mieter, p.name AS immobilie, u.number AS einheit, c.type, c.\"startDate\", c.\"endDate\", c.\"monthlyRent\", c.deposit, c.status FROM \"Contract\" c JOIN \"Tenant\" t ON t.id = c.\"tenantId\" JOIN \"Property\" p ON p.id = c.\"propertyId\" JOIN \"Unit\" u ON u.id = c.\"unitId\" WHERE c.\"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/vertraege.csv"

# Finanztransaktionen
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT t.id, t.date, t.description, t.amount, t.type, t.category FROM \"Transaction\" t JOIN \"BankAccount\" b ON b.id = t.\"bankAccountId\" WHERE b.\"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/transaktionen.csv"

# Dokumente (nur Metadaten, keine Dateien)
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c \
  "COPY (SELECT id, name, type, \"createdAt\" FROM \"Document\" WHERE \"companyId\" = $COMPANY_ID) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/dokumente.csv"

# README zur Auskunft
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

# ZIP erstellen
ZIPFILE="/root/immoverwaltung/dsgvo_${COMPANY_ID}_${DATE}.zip"
cd /tmp && zip -r "$ZIPFILE" "dsgvo_export_${COMPANY_ID}_${DATE}/" > /dev/null
rm -rf "$EXPORT_DIR"

echo ""
echo "✓ Export abgeschlossen!"
echo "  Datei: $ZIPFILE"
echo ""
echo "  Zum Herunterladen auf deinen PC:"
echo "  scp root@hasverl.xyz:$ZIPFILE ."
