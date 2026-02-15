# Immoverwaltung - Local Docker Deployment Guide

Anleitung zum Hosten der gesamten App (Frontend + Backend + Datenbank) per Docker auf einem anderen PC.

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
