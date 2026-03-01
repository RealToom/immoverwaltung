# Immoverwaltung — Admin-Handbuch

Dieses Dokument beschreibt alle wichtigen Verwaltungsaufgaben für den Betrieb der App.

---

## Server-Infos

| Eigenschaft     | Wert                                      |
|-----------------|-------------------------------------------|
| Anbieter        | Hetzner Cloud                             |
| Server-Typ      | CX21 (2 vCPU, 4 GB RAM)                  |
| Standort        | Nürnberg, Deutschland                     |
| Betriebssystem  | Ubuntu 22.04 LTS                          |
| IP-Adresse      | Hetzner Cloud Console → Server → Details  |
| Domain          | hasverl.xyz                               |
| SSH-Zugang      | `ssh root@hasverl.xyz`                    |
| Verzeichnis     | `/root/immoverwaltung/`                   |
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

## Neue Kundenfirma anlegen

```bash
cd /root/immoverwaltung
./new-tenant.sh "Firma GmbH" "admin@firma.de" "Passwort123!"
```

Optional kann ein Admin-Name als 4. Parameter übergeben werden:
```bash
./new-tenant.sh "Firma GmbH" "admin@firma.de" "Passwort123!" "Max Mustermann"
```

Das Script legt automatisch an:
- Neue Firma in der Datenbank
- Admin-User mit gehashtem Passwort

---

## Passwort zurücksetzen / Account entsperren

Wenn sich ein Admin ausgesperrt hat (falsches Passwort, Account gesperrt):

```bash
cd /root/immoverwaltung
./reset-password.sh "admin@firma.de" "NeuesPasswort123!"
```

Das Script:
- Setzt das Passwort neu (bcrypt-gehasht)
- Entsperrt den Account (Fehlversuche zurücksetzen)

---

## SSL-Zertifikate

Zertifikate liegen auf dem Host unter `/etc/letsencrypt/live/hasverl.xyz/` und werden
als echte Dateien nach `/root/immoverwaltung/ssl/` kopiert (da Docker Let's Encrypt
Symlinks nicht folgen kann).

### Zertifikat manuell erneuern

```bash
certbot renew --standalone --pre-hook "docker compose -f /root/immoverwaltung/docker-compose.yml stop frontend" --post-hook "cp -L /etc/letsencrypt/live/hasverl.xyz/fullchain.pem /root/immoverwaltung/ssl/ && cp -L /etc/letsencrypt/live/hasverl.xyz/privkey.pem /root/immoverwaltung/ssl/ && docker compose -f /root/immoverwaltung/docker-compose.yml start frontend"
```

### Automatische Erneuerung (Cronjob)

Eingerichtet am 2026-03-01. Läuft jeden 1. des Monats um 03:00 Uhr:
```
0 3 1 * * cp -L /etc/letsencrypt/live/hasverl.xyz/fullchain.pem /root/immoverwaltung/ssl/ && ...
```

Cronjobs anzeigen: `crontab -l`

---

## Datenbank-Zugang

Direkt in die Datenbank verbinden:

```bash
docker exec -it immoverwaltung-db psql -U postgres -d immoverwaltung
```

Nützliche SQL-Befehle:
```sql
-- Alle Firmen anzeigen
SELECT id, name, slug FROM "Company";

-- Alle User anzeigen
SELECT id, name, email, role, "companyId" FROM "User";

-- Datenbank verlassen
\q
```

---

## Speicherplatz & Ressourcen

```bash
# Festplattennutzung
df -h

# Docker-Speicher
docker system df

# RAM & CPU
htop

# Datenbankgröße
docker exec immoverwaltung-db psql -U postgres -d immoverwaltung -c "SELECT pg_size_pretty(pg_database_size('immoverwaltung'));"
```

### Aufräumen (alte Docker-Images löschen)

```bash
docker system prune -f
```

---

## Datenbank-Backup

Backup erstellen:
```bash
docker exec immoverwaltung-db pg_dump -U postgres immoverwaltung > backup_$(date +%Y%m%d).sql
```

Backup wiederherstellen:
```bash
docker exec -i immoverwaltung-db psql -U postgres immoverwaltung < backup_20260301.sql
```

---

## Notfall-Checkliste

| Problem                        | Lösung                                               |
|-------------------------------|------------------------------------------------------|
| Website nicht erreichbar       | `docker compose ps` → crashed Container neu starten  |
| SSL-Fehler                     | `cp -L /etc/letsencrypt/live/hasverl.xyz/*.pem ssl/` |
| Login funktioniert nicht       | `./reset-password.sh email passwort`                 |
| Backend-Fehler                 | `docker compose logs backend --tail=50`              |
| Datenbank nicht erreichbar     | `docker compose restart postgres`                    |
| Festplatte voll                | `docker system prune -f`                             |
