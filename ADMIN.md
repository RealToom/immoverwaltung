# Immoverwaltung — Admin-Handbuch

Dieses Dokument beschreibt alle wichtigen Verwaltungsaufgaben für den Betrieb der App.

---

## Server-Infos

| Eigenschaft     | Wert                                       |
|-----------------|--------------------------------------------|
| Anbieter        | Hetzner Cloud                              |
| Server-Typ      | CX21 (2 vCPU, 4 GB RAM)                   |
| Standort        | Nürnberg, Deutschland                      |
| Betriebssystem  | Ubuntu 22.04 LTS                           |
| IP-Adresse      | Hetzner Cloud Console → Server → Details   |
| Domain          | hasverl.xyz                                |
| SSH-Zugang      | `ssh root@hasverl.xyz`                     |
| Verzeichnis     | `/root/immoverwaltung/`                    |
| Repository      | https://github.com/RealToom/immoverwaltung |

---

## Container-Übersicht

```
immoverwaltung-frontend   nginx (Port 80/443) — React-App
immoverwaltung-backend    Node.js (Port 3001) — REST-API
immoverwaltung-db         PostgreSQL 16       — Datenbank
```

---

## Häufige Aufgaben

### App-Status prüfen

```bash
docker compose -f /root/immoverwaltung/docker-compose.yml ps
```

Alle Container sollten `Up` zeigen. Der `frontend`-Container darf **nicht** `Restarting` zeigen.

### Logs anzeigen

```bash
# Alle Container
docker compose -f /root/immoverwaltung/docker-compose.yml logs --tail=50

# Nur Backend
docker compose -f /root/immoverwaltung/docker-compose.yml logs backend --tail=50

# Nur Frontend (nginx)
docker compose -f /root/immoverwaltung/docker-compose.yml logs frontend --tail=50
```

### Update auf neue Version

```bash
cd /root/immoverwaltung
git stash                             # lokale Änderungen sichern
git pull origin master                # neuen Code holen
docker compose up -d --build          # neu bauen und starten
```

### Container neu starten

```bash
cd /root/immoverwaltung
docker compose restart backend
docker compose restart frontend
```

---

## Kundenverwaltung

### Alle Kunden anzeigen

```bash
cd /root/immoverwaltung
./list-tenants.sh
```

### Neue Kundenfirma anlegen

```bash
./new-tenant.sh "Firma GmbH" "admin@firma.de" "Passwort123!"
# Mit Admin-Name:
./new-tenant.sh "Firma GmbH" "admin@firma.de" "Passwort123!" "Max Mustermann"
```

### DSGVO-Datenauskunft exportieren

```bash
./export-tenant.sh "Firma GmbH"
```

Erstellt eine ZIP-Datei mit allen Daten der Firma (Immobilien, Mieter, Verträge, Transaktionen usw.) als CSV-Dateien. Zum Herunterladen auf den eigenen PC:

```bash
scp root@hasverl.xyz:/root/immoverwaltung/dsgvo_*.zip .
```

### Kundenfirma löschen (unwiderruflich!)

```bash
./delete-tenant.sh "Firma GmbH"
```

Das Script fragt zur Bestätigung nochmal den Firmennamen ab und löscht dann alle Daten der Firma (Immobilien, Einheiten, Mieter, Verträge, User usw.).

### Passwort zurücksetzen / Account entsperren

```bash
./reset-password.sh "admin@firma.de" "NeuesPasswort123!"
```

---

## Datenbank-Backup

### Manuelles Backup

```bash
cd /root/immoverwaltung
./backup.sh
```

Backups werden in `/root/immoverwaltung/backups/` gespeichert (gzip-komprimiert).

### Backup wiederherstellen

```bash
zcat backups/immoverwaltung_20260301_020000.sql.gz | docker exec -i immoverwaltung-db psql -U postgres immoverwaltung
```

### Automatisches tägliches Backup einrichten

Einmalig auf dem Server ausführen:

```bash
(crontab -l 2>/dev/null; echo '0 2 * * * /root/immoverwaltung/backup.sh >> /root/immoverwaltung/backups/backup.log 2>&1') | crontab -
```

Backups älter als 7 Tage werden automatisch gelöscht.

---

## SSL-Zertifikate

Zertifikate liegen unter `/etc/letsencrypt/live/hasverl.xyz/` und werden als echte Dateien
nach `/root/immoverwaltung/ssl/` kopiert (Docker kann Let's Encrypt Symlinks nicht folgen).

### Automatische Erneuerung einrichten (einmalig auf Server)

```bash
(crontab -l 2>/dev/null; echo '0 3 1 * * certbot renew --quiet --deploy-hook "cp -L /etc/letsencrypt/live/hasverl.xyz/fullchain.pem /root/immoverwaltung/ssl/ && cp -L /etc/letsencrypt/live/hasverl.xyz/privkey.pem /root/immoverwaltung/ssl/ && docker compose -f /root/immoverwaltung/docker-compose.yml restart frontend"') | crontab -
```

### Manuell erneuern

```bash
certbot renew --quiet
cp -L /etc/letsencrypt/live/hasverl.xyz/fullchain.pem /root/immoverwaltung/ssl/
cp -L /etc/letsencrypt/live/hasverl.xyz/privkey.pem /root/immoverwaltung/ssl/
docker compose -f /root/immoverwaltung/docker-compose.yml restart frontend
```

Zertifikat läuft ab: `certbot certificates` zeigt das Ablaufdatum.

---

## Container-Überwachung (Health Check)

### Automatischen Health Check einrichten (einmalig auf Server)

```bash
chmod +x /root/immoverwaltung/health-check.sh
(crontab -l 2>/dev/null; echo '*/5 * * * * /root/immoverwaltung/health-check.sh >> /root/immoverwaltung/health-check.log 2>&1') | crontab -
```

Das Script prüft alle 5 Minuten ob alle Container laufen. Bei einem Absturz:
- Wird ins Log geschrieben (`health-check.log`)
- Versucht automatisch neu zu starten

### Health Check Log anzeigen

```bash
tail -f /root/immoverwaltung/health-check.log
```

---

## Uptime-Monitoring mit UptimeRobot (kostenlos)

UptimeRobot prüft die Website alle 5 Minuten und schickt eine E-Mail wenn sie nicht erreichbar ist.

1. Kostenloses Konto erstellen: https://uptimerobot.com
2. **Add New Monitor** klicken
3. Einstellungen:
   - Monitor Type: `HTTPS`
   - Friendly Name: `Immoverwaltung`
   - URL: `https://hasverl.xyz`
   - Monitoring Interval: `5 minutes`
4. E-Mail-Benachrichtigung aktivieren
5. **Create Monitor** klicken

---

## Datenbank-Zugang

```bash
docker exec -it immoverwaltung-db psql -U postgres -d immoverwaltung
```

Nützliche SQL-Befehle:
```sql
SELECT id, name, slug FROM "Company";                          -- Alle Firmen
SELECT id, name, email, role, "companyId" FROM "User";        -- Alle User
SELECT pg_size_pretty(pg_database_size('immoverwaltung'));     -- DB-Größe
\q                                                             -- Beenden
```

---

## Speicherplatz & Ressourcen

```bash
df -h                   # Festplattennutzung
docker system df        # Docker-Speicher
htop                    # RAM & CPU
docker system prune -f  # Alte Images löschen
```

---

## Notfall-Checkliste

| Problem                        | Lösung                                                      |
|-------------------------------|-------------------------------------------------------------|
| Website nicht erreichbar       | `docker compose ps` → crashed Container neu starten         |
| SSL-Fehler                     | `cp -L /etc/letsencrypt/live/hasverl.xyz/*.pem ssl/`        |
| Login funktioniert nicht       | `./reset-password.sh email passwort`                        |
| Backend-Fehler                 | `docker compose logs backend --tail=50`                     |
| Datenbank nicht erreichbar     | `docker compose restart postgres`                           |
| Festplatte voll                | `docker system prune -f` dann `./backup.sh` prüfen         |
| Container crasht dauerhaft     | `docker compose logs <name> --tail=100` → Fehler analysieren |
