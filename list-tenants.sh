#!/bin/bash
# Alle Kundenfirmen mit ihren Admin-Usern anzeigen

docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c "
SELECT
  c.id AS \"Firma-ID\",
  c.name AS \"Firmenname\",
  u.email AS \"Admin-Email\",
  u.name AS \"Admin-Name\",
  u.role AS \"Rolle\",
  TO_CHAR(c.\"createdAt\", 'DD.MM.YYYY') AS \"Angelegt am\"
FROM \"Company\" c
LEFT JOIN \"User\" u ON u.\"companyId\" = c.id AND u.role = 'ADMIN'
ORDER BY c.id;
"
