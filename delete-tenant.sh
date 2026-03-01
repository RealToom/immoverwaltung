#!/bin/bash
# Kundenfirma und alle zugehörigen Daten löschen
# Aufruf: ./delete-tenant.sh "Firma GmbH"
# ACHTUNG: Dieser Vorgang ist nicht rückgängig zu machen!

set -e

COMPANY_NAME="$1"

if [ -z "$COMPANY_NAME" ]; then
  echo "Aufruf: $0 \"Firma GmbH\""
  exit 1
fi

# Firma und Statistik anzeigen
echo "==> Suche Firma: $COMPANY_NAME"
INFO=$(docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -tAc "
SELECT
  c.id || '|' || c.name || '|' ||
  (SELECT COUNT(*) FROM \"User\" WHERE \"companyId\" = c.id) || ' User|' ||
  (SELECT COUNT(*) FROM \"Property\" WHERE \"companyId\" = c.id) || ' Immobilien|' ||
  (SELECT COUNT(*) FROM \"Tenant\" WHERE \"companyId\" = c.id) || ' Mieter'
FROM \"Company\" c
WHERE c.name = '$COMPANY_NAME';
")

if [ -z "$INFO" ]; then
  echo "FEHLER: Keine Firma mit dem Namen '$COMPANY_NAME' gefunden."
  exit 1
fi

COMPANY_ID=$(echo "$INFO" | cut -d'|' -f1)
echo ""
echo "  Gefunden: $INFO" | tr '|' ' · '
echo ""
echo "  ACHTUNG: Alle Daten dieser Firma werden unwiderruflich gelöscht!"
echo "  Firma-ID: $COMPANY_ID"
echo ""
read -p "Zum Bestätigen Firmenname eingeben: " CONFIRM

if [ "$CONFIRM" != "$COMPANY_NAME" ]; then
  echo "Abgebrochen."
  exit 1
fi

echo ""
echo "==> Lösche alle Daten der Firma..."

docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c "
DO \$\$
DECLARE cid INT := $COMPANY_ID;
BEGIN
  DELETE FROM \"AuditLog\"              WHERE \"companyId\" = cid;
  DELETE FROM \"UtilityStatementItem\"  WHERE \"utilityStatementId\" IN (SELECT id FROM \"UtilityStatement\" WHERE \"companyId\" = cid);
  DELETE FROM \"UtilityStatement\"      WHERE \"companyId\" = cid;
  DELETE FROM \"RentPayment\"           WHERE \"contractId\" IN (SELECT id FROM \"Contract\" WHERE \"companyId\" = cid);
  DELETE FROM \"Contract\"              WHERE \"companyId\" = cid;
  DELETE FROM \"Document\"              WHERE \"companyId\" = cid;
  DELETE FROM \"MeterReading\"          WHERE \"meterId\" IN (SELECT id FROM \"Meter\" WHERE \"propertyId\" IN (SELECT id FROM \"Property\" WHERE \"companyId\" = cid));
  DELETE FROM \"Meter\"                 WHERE \"propertyId\" IN (SELECT id FROM \"Property\" WHERE \"companyId\" = cid);
  DELETE FROM \"MaintenanceRequest\"    WHERE \"companyId\" = cid;
  DELETE FROM \"Unit\"                  WHERE \"propertyId\" IN (SELECT id FROM \"Property\" WHERE \"companyId\" = cid);
  DELETE FROM \"Property\"              WHERE \"companyId\" = cid;
  DELETE FROM \"Tenant\"                WHERE \"companyId\" = cid;
  DELETE FROM \"Transaction\"           WHERE \"bankAccountId\" IN (SELECT id FROM \"BankAccount\" WHERE \"companyId\" = cid);
  DELETE FROM \"BankAccount\"           WHERE \"companyId\" = cid;
  DELETE FROM \"RefreshToken\"          WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE \"companyId\" = cid);
  DELETE FROM \"User\"                  WHERE \"companyId\" = cid;
  DELETE FROM \"CompanyAccountingSettings\" WHERE \"companyId\" = cid;
  DELETE FROM \"Company\"               WHERE id = cid;
END \$\$;
" > /dev/null

echo "✓ Firma '$COMPANY_NAME' und alle Daten wurden gelöscht."
