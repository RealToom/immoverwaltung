#!/bin/sh
set -e

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
npx prisma migrate deploy

if [ "$SEED_DB" = "true" ]; then
  echo "Seede Datenbank..."
  npx tsx prisma/seed.ts
fi

echo "Starte Backend..."
exec node dist/index.js
