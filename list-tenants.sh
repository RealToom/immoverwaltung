#!/bin/bash
# Alle Kundenfirmen mit ihren Admin-Usern anzeigen

docker exec immoverwaltung-db psql -U immo -d immoverwaltung -c "
SELECT
  c.id AS \"Firma-ID\",
  c.name AS \"Firmenname\",
  u.email AS \"Admin-Email\",
  u.name AS \"Admin-Name\",
  u.role AS \"Rolle\",
  TO_CHAR(c.created_at, 'DD.MM.YYYY') AS \"Angelegt am\"
FROM companies c
LEFT JOIN users u ON u.company_id = c.id AND u.role = 'ADMIN'
ORDER BY c.id;
"
