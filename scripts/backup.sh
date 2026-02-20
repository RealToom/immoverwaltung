#!/usr/bin/env bash
# Immoverwaltung - Datenbank-Backup
# Verwendung: ./scripts/backup.sh [backup-verzeichnis]
#
# Erstellt einen komprimierten Datenbank-Dump mit Zeitstempel.
# Haelt die letzten 30 Backups (aeltere werden automatisch geloescht).
#
# Cronjob (taeglich um 3 Uhr):
#   0 3 * * * /opt/immoverwaltung/scripts/backup.sh /opt/backups >> /var/log/immoverwaltung-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
CONTAINER="immoverwaltung-db"
DB_USER="immo"
DB_NAME="immoverwaltung"
KEEP_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/immoverwaltung_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starte Backup: $BACKUP_FILE"

# Pruefe ob Container laeuft
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(date -Iseconds)] FEHLER: Container '$CONTAINER' laeuft nicht." >&2
  exit 1
fi

# Datenbank-Dump (komprimiert)
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$BACKUP_FILE"

# Groesse ausgeben
SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup erfolgreich: $BACKUP_FILE ($SIZE)"

# Alte Backups loeschen (aelter als KEEP_DAYS Tage)
DELETED=$(find "$BACKUP_DIR" -name "immoverwaltung_*.sql.gz" -mtime +$KEEP_DAYS -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date -Iseconds)] $DELETED altes Backup(s) geloescht (aelter als $KEEP_DAYS Tage)"
fi

echo "[$(date -Iseconds)] Backup abgeschlossen."
