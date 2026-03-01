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
INFO=$(docker exec immoverwaltung-db psql -U immo -d immoverwaltung -tAc "
SELECT
  c.id || '|' || c.name || '|' ||
  (SELECT COUNT(*) FROM users WHERE company_id = c.id) || ' User|' ||
  (SELECT COUNT(*) FROM properties WHERE company_id = c.id) || ' Immobilien|' ||
  (SELECT COUNT(*) FROM tenants WHERE company_id = c.id) || ' Mieter'
FROM companies c
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

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c "
DO \$\$
DECLARE cid INT := $COMPANY_ID;
BEGIN
  DELETE FROM audit_logs                WHERE company_id = cid;
  DELETE FROM dunning_records           WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = cid);
  DELETE FROM rent_payments             WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = cid);
  DELETE FROM contracts                 WHERE company_id = cid;
  DELETE FROM documents                 WHERE company_id = cid;
  DELETE FROM document_templates        WHERE company_id = cid;
  DELETE FROM meter_readings            WHERE meter_id IN (SELECT id FROM meters WHERE property_id IN (SELECT id FROM properties WHERE company_id = cid));
  DELETE FROM meters                    WHERE property_id IN (SELECT id FROM properties WHERE company_id = cid);
  DELETE FROM maintenance_tickets       WHERE property_id IN (SELECT id FROM properties WHERE company_id = cid);
  DELETE FROM maintenance_schedules     WHERE property_id IN (SELECT id FROM properties WHERE company_id = cid);
  DELETE FROM handover_protocols        WHERE unit_id IN (SELECT id FROM units WHERE property_id IN (SELECT id FROM properties WHERE company_id = cid));
  DELETE FROM units                     WHERE property_id IN (SELECT id FROM properties WHERE company_id = cid);
  DELETE FROM properties                WHERE company_id = cid;
  DELETE FROM tenants                   WHERE company_id = cid;
  DELETE FROM bank_transactions         WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE company_id = cid);
  DELETE FROM transactions              WHERE company_id = cid;
  DELETE FROM recurring_transactions    WHERE company_id = cid;
  DELETE FROM bank_accounts             WHERE company_id = cid;
  DELETE FROM calendar_events           WHERE company_id = cid;
  DELETE FROM email_attachments         WHERE message_id IN (SELECT id FROM email_messages WHERE account_id IN (SELECT id FROM email_accounts WHERE company_id = cid));
  DELETE FROM email_messages            WHERE account_id IN (SELECT id FROM email_accounts WHERE company_id = cid);
  DELETE FROM email_accounts            WHERE company_id = cid;
  DELETE FROM company_accounting_settings WHERE company_id = cid;
  DELETE FROM refresh_tokens            WHERE user_id IN (SELECT id FROM users WHERE company_id = cid);
  DELETE FROM users                     WHERE company_id = cid;
  DELETE FROM companies                 WHERE id = cid;
END \$\$;
" > /dev/null

echo "✓ Firma '$COMPANY_NAME' und alle Daten wurden gelöscht."
