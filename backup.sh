#!/bin/bash
# Datenbank-Backup erstellen (mit 7-Tage-Aufbewahrung)
# Aufruf: ./backup.sh
# Cronjob: täglich um 02:00 Uhr
#
# HINWEIS OFFSITE-BACKUP: Dieses Skript speichert Backups nur lokal.
# Für Produktionsbetrieb empfohlen: Zusätzlich auf externen Speicher sichern,
# z.B.: rclone copy "$BACKUP_FILE" remote:immoverwaltung-backups/
# (Hetzner Storage Box, Backblaze B2, AWS S3 etc.)

BACKUP_DIR="/root/immoverwaltung/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/immoverwaltung_$DATE.sql.gz"
RETENTION_DAYS=7
# DB-User muss mit docker-compose.yml übereinstimmen (POSTGRES_USER: immo)
DB_USER="immo"
DB_NAME="immoverwaltung"

mkdir -p "$BACKUP_DIR"

echo "==> Backup wird erstellt: $BACKUP_FILE"
docker exec immoverwaltung-db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo "✓ Backup erstellt ($SIZE)"
else
  echo "FEHLER: Backup fehlgeschlagen! Abgebrochene Datei wird entfernt."
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Alte Backups löschen (erst NACH erfolgreichem neuen Backup)
echo "==> Backups älter als $RETENTION_DAYS Tage werden gelöscht..."
find "$BACKUP_DIR" -name "immoverwaltung_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls "$BACKUP_DIR" | wc -l)
echo "✓ $REMAINING Backup(s) verbleiben in $BACKUP_DIR"
