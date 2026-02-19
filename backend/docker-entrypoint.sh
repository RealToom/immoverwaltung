#!/bin/sh

echo "Warte auf PostgreSQL..."
until node -e "
  const net = require('net');
  const s = net.createConnection(5432, 'postgres');
  s.on('connect', () => { s.end(); process.exit(0); });
  s.on('error', () => process.exit(1));
" 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL ist bereit."

echo "Fuehre Migrationen aus..."
npx prisma migrate deploy > /tmp/migrate.log 2>&1
MIGRATE_RC=$?
cat /tmp/migrate.log

if [ $MIGRATE_RC -ne 0 ]; then
  if grep -q "P3005" /tmp/migrate.log; then
    echo "Keine Migrationshistorie gefunden (DB wurde mit db push erstellt)."
    echo "Erstelle Baseline fuer alle vorhandenen Migrationen..."
    for dir in prisma/migrations/*/; do
      name=$(basename "$dir")
      echo "  Baseline: $name"
      npx prisma migrate resolve --applied "$name" 2>/dev/null || true
    done
    echo "Baseline abgeschlossen. Deploye verbleibende Migrationen..."
    npx prisma migrate deploy
  else
    echo "Migration fehlgeschlagen - unbekannter Fehler"
    exit 1
  fi
fi

if [ "$SEED_DB" = "true" ]; then
  echo "Seede Datenbank..."
  npx tsx prisma/seed.ts
fi

echo "Starte Backend..."
exec node dist/index.js
