#!/bin/bash
# Container-Überwachung — sendet E-Mail wenn ein Container nicht läuft
# Cronjob: alle 5 Minuten
# Voraussetzung: SMTP in backend/.env konfiguriert (SMTP_HOST, SMTP_USER, SMTP_PASS)
# Optional: ALERT_EMAIL in /root/immoverwaltung/.env setzen

COMPOSE_DIR="/root/immoverwaltung"
LOG_FILE="/root/immoverwaltung/health-check.log"
ALERT_EMAIL="${ALERT_EMAIL:-}"

CONTAINERS=("immoverwaltung-frontend" "immoverwaltung-backend" "immoverwaltung-db")
FAILED=()

for CONTAINER in "${CONTAINERS[@]}"; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null)
  if [ "$STATUS" != "running" ]; then
    FAILED+=("$CONTAINER (Status: ${STATUS:-nicht gefunden})")
  fi
done

if [ ${#FAILED[@]} -gt 0 ]; then
  MESSAGE="ALARM: Folgende Container laufen nicht:\n"
  for F in "${FAILED[@]}"; do
    MESSAGE+="  - $F\n"
  done
  MESSAGE+="\nZeitpunkt: $(date '+%d.%m.%Y %H:%M:%S')"
  MESSAGE+="\n\nNeustarten mit:\n  docker compose -f $COMPOSE_DIR/docker-compose.yml up -d"

  # In Log schreiben
  echo -e "$(date '+%Y-%m-%d %H:%M:%S') ALARM: ${FAILED[*]}" >> "$LOG_FILE"

  # E-Mail senden (wenn ALERT_EMAIL gesetzt und msmtp verfügbar)
  if [ -n "$ALERT_EMAIL" ] && command -v msmtp &>/dev/null; then
    echo -e "To: $ALERT_EMAIL\nSubject: [Immoverwaltung] Container-Alarm\n\n$MESSAGE" | msmtp "$ALERT_EMAIL"
    echo "==> Alarm-E-Mail gesendet an $ALERT_EMAIL"
  else
    echo -e "$MESSAGE"
  fi

  # Versuche automatisch neu zu starten
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" up -d >> "$LOG_FILE" 2>&1
  echo "$(date '+%Y-%m-%d %H:%M:%S') Auto-Restart ausgeführt" >> "$LOG_FILE"
fi
