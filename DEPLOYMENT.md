# Immoverwaltung - Docker Deployment Guide

Anleitung zum Hosten der gesamten App (Frontend + Backend + Datenbank) per Docker auf einem anderen PC.

---

---

## Produktions-Checkliste

Vor dem ersten Go-Live alle Punkte abhaken:

### Pflicht (ohne diese laeuft docker-compose nicht hoch)

- [ ] [Rechtliche Checkliste](file:///c:/Users/tomsc/Documents/Projects/AI-Programming/immoverwaltung/LEGAL_TEMPLATES.md) (Abmahngefahr!)
- [ ] [Server-Absicherung](file:///c:/Users/tomsc/Documents/Projects/AI-Programming/immoverwaltung/SERVER_SECURITY.md) (SSH/Firewall)
- [ ] [DNS-Konfiguration](file:///c:/Users/tomsc/Documents/Projects/AI-Programming/immoverwaltung/DNS_CONFIG.md) (E-Mail Zustellbarkeit)
- [ ] `ENCRYPTION_KEY` generieren und setzen:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] `DB_PASSWORD` — starkes, einzigartiges Passwort (mind. 20 Zeichen)
- [ ] `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` generieren (je 48+ Bytes):
  ```bash
  # Linux/Mac:
  openssl rand -base64 48
  # Windows PowerShell:
  [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
  ```
- [ ] `CORS_ORIGINS` — exakte HTTPS-URL des Frontends (z.B. `https://verwaltung.meine-firma.de`)
- [ ] `NORDIGEN_SECRET_ID` + `NORDIGEN_SECRET_KEY` — PSD2 Bankanbindung (GoCardless/Nordigen)
- [ ] SSL-Zertifikate vorhanden (Let's Encrypt empfohlen, siehe unten)

### Empfohlen

- [ ] `ANTHROPIC_API_KEY` setzen — aktiviert KI-Belegscan (optional, kann leer bleiben)
- [ ] `BCRYPT_COST=12` — Standard, bei sehr starken Servern auf 13 erhoehen
- [ ] `SEED_DB=false` — nur beim allerersten Start auf `true` setzen
- [ ] DATEV-Kategorie-Mappings in den Admin-Einstellungen pflegen
- [ ] SMTP-Daten konfigurieren — aktiviert E-Mail-Benachrichtigungen + Passwort-Reset-E-Mails
- [ ] Automatisches Backup einrichten (Cronjob, siehe Abschnitt "Backup")
- [ ] Monitoring einrichten (UptimeRobot: GET `/health` alle 5 Min, Alert bei Status != 200)
- [ ] Firewall: nur Port 80 + 443 freigeben (DB-Port 5432 ist bereits an 127.0.0.1 gebunden)

### SSL-Zertifikat mit Let's Encrypt (Certbot)

```bash
# Einmalig: Certbot installieren und Zertifikat ausstellen
# (Port 80 muss fuer die Challenge erreichbar sein - frontend noch nicht starten)
sudo apt install certbot
sudo certbot certonly --standalone -d verwaltung.meine-firma.de

# In .env setzen:
SSL_CERT_PATH=/etc/letsencrypt/live/verwaltung.meine-firma.de

# Auto-Renewal pruefen (Certbot richtet Cronjob ein):
sudo certbot renew --dry-run

# Nach Renewal: nginx neu laden
docker compose exec frontend nginx -s reload
```

### Backup-Cronjob einrichten

```bash
# Script ausfuehrbar machen
chmod +x scripts/backup.sh

# Cronjob einrichten (taeglich 3 Uhr):
crontab -e
# Zeile hinzufuegen:
0 3 * * * /opt/immoverwaltung/scripts/backup.sh /opt/backups >> /var/log/immoverwaltung-backup.log 2>&1
```

---

## Lokaler Test (ohne SSL-Zertifikat)

Für Tests auf dem eigenen PC ohne Domain und SSL-Zertifikat:

```bash
# 1. Starten (HTTP, Port 8080, Demo-Daten automatisch geladen)
docker compose -f docker-compose.local.yml up -d --build

# 2. App aufrufen
# http://localhost:8080

# 3. Login
# E-Mail: admin@immoverwalt.de
# Passwort: Admin123!

# 4. Stoppen
docker compose -f docker-compose.local.yml down
```

**Unterschiede zur Produktionsversion:**
- HTTP statt HTTPS (kein SSL nötig)
- Port 8080 statt 80/443
- `SEED_DB=true` — Demo-Daten werden beim ersten Start automatisch geladen
- Vereinfachte Secrets (NICHT für Produktion verwenden!)

---

## Deutsche Cloud — Empfohlene Hoster (DSGVO-konform)

### Hetzner Cloud (empfohlen)

| Paket | vCPU | RAM | Speicher | Preis |
|-------|------|-----|---------|-------|
| CX22 | 2 | 4 GB | 40 GB SSD | ~6 €/Monat |
| CX32 | 4 | 8 GB | 80 GB SSD | ~13 €/Monat |

**Rechenzentren:** Nürnberg, Falkenstein (Deutschland)
**DSGVO:** Auftragsverarbeitungsvertrag (AVV) verfügbar → Art. 28 DSGVO erfüllt
**Buchung:** https://www.hetzner.com/cloud

**Firewall in Hetzner Cloud einrichten:**
1. Hetzner Cloud Console → Firewalls → Firewall erstellen
2. Eingehende Regeln:
   - TCP Port 22 (SSH) — nur eigene IP
   - TCP Port 80 (HTTP)
   - TCP Port 443 (HTTPS)
3. Firewall dem Server zuweisen

### IONOS (günstigste Option)

| Paket | vCPU | RAM | Speicher | Preis |
|-------|------|-----|---------|-------|
| VPS S | 1 | 2 GB | 40 GB SSD | ~2 €/Monat |
| VPS M | 2 | 4 GB | 80 GB SSD | ~4 €/Monat |

**Rechenzentren:** Berlin, Karlsruhe (Deutschland)
**DSGVO:** AVV verfügbar
**Buchung:** https://www.ionos.de/server/vps

### Deployment-Workflow (beide Anbieter)

```bash
# Einmalig: Server einrichten
ssh root@DEINE-SERVER-IP

# Docker installieren (Ubuntu 24.04)
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Repo klonen
git clone <repo-url> /opt/immoverwaltung
cd /opt/immoverwaltung

# .env konfigurieren (alle Pflichtfelder aus Produktions-Checkliste setzen)
cp backend/.env.example backend/.env
nano backend/.env   # Secrets + CORS_ORIGINS + SSL_CERT_PATH anpassen

# SSL-Zertifikat holen (Let's Encrypt)
apt install certbot
certbot certonly --standalone -d deine-domain.de
# SSL_CERT_PATH=/etc/letsencrypt/live/deine-domain.de in .env setzen

# App starten
docker compose up -d --build

# Updates deployen (nach git push)
git pull origin master
docker compose up -d --build
```

---

## Voraussetzungen

- **Docker Desktop** installiert (https://docs.docker.com/desktop/)
  - Windows: Docker Desktop for Windows (WSL2-Backend empfohlen)
  - Mac: Docker Desktop for Mac
  - Linux: Docker Engine + Docker Compose Plugin
- **Git** (um das Repo zu klonen)

---

## 1. Projekt klonen

```bash
git clone <repo-url> immoverwaltung
cd immoverwaltung
```

---

## 2. Konfiguration erstellen

Die `.env`-Datei im Projektroot steuert alle Einstellungen:

```bash
cp .env.example .env
```

Dann `.env` bearbeiten:

```env
# Datenbank-Passwort (AENDERN!)
DB_PASSWORD=mein-sicheres-db-passwort

# JWT Secrets (AENDERN! Am besten zufaellig generieren)
# Beispiel: openssl rand -base64 48
JWT_ACCESS_SECRET=hier-einen-langen-zufaelligen-string
JWT_REFRESH_SECRET=hier-einen-anderen-langen-zufaelligen-string

# Frontend-URL fuer CORS
CORS_ORIGINS=http://localhost

# Beim ERSTEN Start auf true setzen (laedt Demo-Daten)
SEED_DB=true
```

**Secrets generieren** (im Terminal):
```bash
# Linux/Mac:
openssl rand -base64 48

# Windows PowerShell:
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
```

---

## 3. App starten

```bash
docker compose up -d --build
```

Das baut und startet drei Container:
1. **postgres** - PostgreSQL 16 Datenbank
2. **backend** - Express API (Port 3001, nur intern)
3. **frontend** - Nginx mit React-App (Port 80, oeffentlich)

Beim ersten Start:
- PostgreSQL wird initialisiert
- Prisma-Migrationen werden ausgefuehrt
- Demo-Daten werden geseedet (wenn `SEED_DB=true`)

**Dauer:** Erster Build ca. 2-5 Minuten (npm install + Build).

---

## 4. App aufrufen

Oeffne im Browser: **http://localhost**

**Login:**
- E-Mail: `admin@immoverwalt.de`
- Passwort: `Admin123!`

---

## 5. Nach dem ersten Start

`SEED_DB` auf `false` setzen, damit die Datenbank nicht bei jedem Neustart ueberschrieben wird:

```env
SEED_DB=false
```

Danach reicht fuer Neustarts:
```bash
docker compose up -d
```

---

## 6. Nuetzliche Befehle

```bash
# Status pruefen
docker compose ps

# Logs anschauen (alle Container)
docker compose logs -f

# Nur Backend-Logs
docker compose logs -f backend

# Stoppen
docker compose down

# Stoppen + Datenbank loeschen (ACHTUNG: alle Daten weg!)
docker compose down -v

# Neu bauen nach Code-Aenderungen
docker compose up -d --build

# Health-Check
curl http://localhost/health
```

---

## 7. Zugriff von anderen Geraeten im Netzwerk

Wenn andere Geraete im selben Netzwerk auf die App zugreifen sollen:

1. **IP-Adresse des Host-PCs herausfinden:**
   ```bash
   # Windows
   ipconfig
   # Linux/Mac
   ip addr
   ```

2. **CORS_ORIGINS anpassen** in `.env`:
   ```env
   CORS_ORIGINS=http://localhost,http://192.168.1.100
   ```

3. **Firewall-Port 80 freigeben** (Windows: Windows Defender Firewall -> Eingehende Regeln -> Port 80 TCP erlauben)

4. **Neu starten:**
   ```bash
   docker compose up -d --build
   ```

5. Zugriff ueber: `http://192.168.1.100`

---

## 8. Daten sichern (Backup)

```bash
# Backup erstellen
docker compose exec postgres pg_dump -U immo immoverwaltung > backup_$(date +%Y%m%d).sql

# Backup wiederherstellen (ACHTUNG: ueberschreibt aktuelle Daten!)
docker compose exec -T postgres psql -U immo immoverwaltung < backup_20260214.sql
```

---

## Architektur-Uebersicht

```
Browser (Port 80)
    |
    v
┌─────────────────────┐
│  nginx (Frontend)    │  Statische React-App
│  Container: frontend │  + Reverse Proxy fuer /api
└──────────┬──────────┘
           │ /api/*
           v
┌─────────────────────┐
│  Express (Backend)   │  REST-API, JWT Auth
│  Container: backend  │  Port 3001 (nur intern)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  PostgreSQL 16       │  Datenbank
│  Container: postgres │  Port 5432 (nur localhost)
└─────────────────────┘
```

- Frontend (nginx) ist der einzige oeffentliche Einstiegspunkt
- Backend ist nur ueber das Docker-Netzwerk erreichbar
- Datenbank ist nur auf 127.0.0.1:5432 gebunden (nicht oeffentlich)

---

## Troubleshooting

**Container startet nicht:**
```bash
docker compose logs backend
```
Haeufige Ursachen: Datenbank noch nicht bereit (Backend wartet automatisch), fehlende .env-Datei.

**Port 80 belegt:**
```bash
# Anderen Port nutzen - in docker-compose.yml aendern:
# ports: - "8080:80"
# Dann: http://localhost:8080
```

**Datenbank zuruecksetzen:**
```bash
docker compose down -v
# SEED_DB=true in .env setzen
docker compose up -d
```

**Nach Code-Aenderungen:**
```bash
docker compose up -d --build
```
