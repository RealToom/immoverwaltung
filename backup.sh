#!/bin/bash
# Datenbank-Backup erstellen (mit 7-Tage-Aufbewahrung)
# Aufruf: ./backup.sh
# Cronjob: täglich um 02:00 Uhr

BACKUP_DIR="/root/immoverwaltung/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/immoverwaltung_$DATE.sql.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "==> Backup wird erstellt: $BACKUP_FILE"
docker exec immoverwaltung-db pg_dump -U postgres immoverwaltung | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo "✓ Backup erstellt ($SIZE)"
else
  echo "FEHLER: Backup fehlgeschlagen!"
  exit 1
fi

# Alte Backups löschen
echo "==> Backups älter als $RETENTION_DAYS Tage werden gelöscht..."
find "$BACKUP_DIR" -name "immoverwaltung_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls "$BACKUP_DIR" | wc -l)
echo "✓ $REMAINING Backup(s) verbleiben in $BACKUP_DIR"
