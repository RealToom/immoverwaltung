# tenant-portal Subdomain Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das `tenant-portal/` als separate React PWA unter `mieter.hasverl.xyz` produktiv deployen, serviert vom gleichen nginx-Container wie die Hauptapp.

**Architecture:** Ein neues `Dockerfile.frontend` im Root baut beide Apps (cozy-estate-central + tenant-portal) in getrennten Stages und kopiert beide Dists in denselben nginx-Container. nginx bekommt einen zweiten Server-Block für `mieter.hasverl.xyz`. Ein SAN-Zertifikat deckt beide Domains ab.

**Tech Stack:** Docker multi-stage builds, nginx:alpine, Node 22 Alpine, Let's Encrypt / certbot

---

## Dateien-Übersicht

| Aktion | Datei | Zweck |
|---|---|---|
| Neu | `Dockerfile.frontend` | Multi-stage: baut beide Apps, nginx-Image |
| Neu | `.dockerignore` | Schließt node_modules/dist/backend vom Build-Kontext aus |
| Ändern | `cozy-estate-central/nginx.conf` | Zweiter Server-Block für mieter.hasverl.xyz |
| Ändern | `docker-compose.yml` | Build-Kontext auf Root umstellen |
| Ändern | `.env.example` | CORS_ORIGINS Beispiel aktualisieren |

---

## Task 1: Root `.dockerignore` erstellen

**Warum:** Ohne `.dockerignore` sendet Docker den gesamten Root (inkl. aller `node_modules`) als Build-Kontext. Das dauert Minuten. Mit `.dockerignore` werden irrelevante Pfade ausgeschlossen.

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: `.dockerignore` anlegen**

Datei `immoverwaltung/.dockerignore` erstellen:

```
# Dependencies (werden im Dockerfile neu installiert)
node_modules/
*/node_modules/

# Build-Artefakte
dist/
*/dist/

# Backend (wird in eigenem Image gebaut)
backend/

# Git
.git/
.gitignore

# Docs & Media
docs/
*.png
*.pdf

# Scripts (nicht im Frontend-Image gebraucht)
*.sh
scripts/

# IDE / Tools
.claude/
.playwright-mcp/
.worktrees/
.github/

# Secrets
.env
*.env.local

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add root .dockerignore for multi-app frontend build"
```

---

## Task 2: `Dockerfile.frontend` im Root erstellen

**Warum:** Das bisherige `cozy-estate-central/Dockerfile` kann nur die Hauptapp bauen. Wir brauchen ein Root-Level-Dockerfile, das auf beide Unterverzeichnisse zugreifen kann.

**Files:**
- Create: `Dockerfile.frontend`

- [ ] **Step 1: `Dockerfile.frontend` anlegen**

Datei `immoverwaltung/Dockerfile.frontend` erstellen:

```dockerfile
# ============================================================
# Stage 1: Hauptapp (cozy-estate-central) bauen
# ============================================================
FROM node:22-alpine AS builder-main

WORKDIR /app

COPY cozy-estate-central/package.json cozy-estate-central/package-lock.json ./
RUN npm ci --prefer-offline

COPY cozy-estate-central/ .
RUN npm run build

# ============================================================
# Stage 2: Mieter-Portal (tenant-portal) bauen
# ============================================================
FROM node:22-alpine AS builder-tenant

WORKDIR /app

COPY tenant-portal/package.json tenant-portal/package-lock.json ./
RUN npm ci --prefer-offline

COPY tenant-portal/ .
RUN npm run build

# ============================================================
# Stage 3: nginx – beide Apps ausliefern
# ============================================================
FROM nginx:alpine

# Hauptapp
COPY --from=builder-main /app/dist /usr/share/nginx/html

# Mieter-Portal
COPY --from=builder-tenant /app/dist /usr/share/nginx/tenant-portal

# nginx-Konfiguration (wird in Task 3 erweitert)
COPY cozy-estate-central/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile.frontend
git commit -m "feat(docker): root Dockerfile.frontend – multi-stage build für Haupt- und Mieter-App"
```

---

## Task 3: nginx.conf um Mieter-Portal-Server-Block erweitern

**Warum:** nginx muss wissen, dass Requests an `mieter.hasverl.xyz` aus dem Ordner `/usr/share/nginx/tenant-portal` bedient werden sollen (SPA-Routing + API-Proxy).

**Files:**
- Modify: `cozy-estate-central/nginx.conf`

- [ ] **Step 1: nginx.conf lesen**

Aktuelle Datei `cozy-estate-central/nginx.conf` lesen um den genauen Inhalt zu kennen.

- [ ] **Step 2: Zweiten HTTPS-Server-Block hinzufügen**

Am Ende der Datei `cozy-estate-central/nginx.conf` folgenden Block ergänzen (nach dem letzten schließenden `}`):

```nginx
# ============================================================
# Mieter-Portal: mieter.hasverl.xyz
# ============================================================
server {
    listen 443 ssl;
    server_name mieter.hasverl.xyz;
    root /usr/share/nginx/tenant-portal;
    index index.html;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;

    # SPA: alle Routen auf index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API-Calls an Backend weiterleiten
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Caching für statische Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add cozy-estate-central/nginx.conf
git commit -m "feat(nginx): server-block für mieter.hasverl.xyz (tenant-portal)"
```

---

## Task 4: `docker-compose.yml` Build-Kontext aktualisieren

**Warum:** Der Frontend-Service zeigt bisher auf `./cozy-estate-central` als Build-Kontext. Das muss auf Root (`.`) umgestellt werden, damit `Dockerfile.frontend` auf beide Unterordner zugreifen kann.

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: docker-compose.yml lesen**

Aktuelle `docker-compose.yml` lesen.

- [ ] **Step 2: Build-Konfiguration des frontend-Service ändern**

Den Eintrag:

```yaml
  frontend:
    build: ./cozy-estate-central
```

ersetzen durch:

```yaml
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker-compose): frontend build-kontext auf root umgestellt (Dockerfile.frontend)"
```

---

## Task 5: `.env.example` aktualisieren

**Warum:** Die Beispieldatei soll zeigen, dass `CORS_ORIGINS` mehrere Origins enthält.

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `.env.example` lesen**

Aktuelle `.env.example` lesen.

- [ ] **Step 2: CORS_ORIGINS-Zeile aktualisieren**

Die Zeile:
```
CORS_ORIGINS=http://localhost
```

ersetzen durch:
```
CORS_ORIGINS=https://hasverl.xyz,https://mieter.hasverl.xyz
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: CORS_ORIGINS Beispiel um mieter-subdomain erweitern"
```

---

## Task 6: Lokaler Build-Test

**Warum:** Vor dem Push sicherstellen, dass das Dockerfile fehlerfrei baut.

**Files:** keine Änderungen

- [ ] **Step 1: Build lokal ausführen**

```bash
cd /pfad/zum/repo
docker build -f Dockerfile.frontend -t immo-frontend-test .
```

Erwartetes Ergebnis: Build läuft durch alle 3 Stages ohne Fehler. Letzter Output:
```
Successfully tagged immo-frontend-test:latest
```

- [ ] **Step 2: Prüfen ob beide Dists im Image vorhanden sind**

```bash
docker run --rm immo-frontend-test ls /usr/share/nginx/html
docker run --rm immo-frontend-test ls /usr/share/nginx/tenant-portal
```

Erwartetes Ergebnis: Beide Verzeichnisse enthalten `index.html` und JS/CSS-Dateien.

- [ ] **Step 3: Test-Image aufräumen**

```bash
docker rmi immo-frontend-test
```

---

## Task 7: Push + Server-Deploy vorbereiten

**Files:** keine Änderungen

- [ ] **Step 1: Alle Commits pushen**

```bash
git push origin master
```

---

## Task 8: Server-seitige Schritte (manuell)

**Warum:** DNS, SSL und Umgebungsvariablen können nur auf dem Server angepasst werden.

> Diese Schritte werden auf dem Hetzner-Server ausgeführt (`ssh root@hasverl.xyz`).

- [ ] **Step 1: DNS-Eintrag anlegen**

Im DNS-Provider (Hetzner DNS oder wo die Domain liegt) einen neuen A-Record anlegen:

```
Name:  mieter
Type:  A
Value: [gleiche IP wie hasverl.xyz]
TTL:   300
```

Warten bis DNS propagiert (prüfen mit: `nslookup mieter.hasverl.xyz`).

- [ ] **Step 2: SSL-Zertifikat erweitern (SAN)**

Auf dem Server:

```bash
# Certbot-Zertifikat um die Subdomain erweitern
certbot certonly --nginx -d hasverl.xyz -d mieter.hasverl.xyz

# Symlinks in den Docker-SSL-Ordner kopieren (Docker kann keine Symlinks folgen)
cp -L /etc/letsencrypt/live/hasverl.xyz/fullchain.pem /root/immoverwaltung/ssl/
cp -L /etc/letsencrypt/live/hasverl.xyz/privkey.pem /root/immoverwaltung/ssl/
```

Erwartetes Ergebnis: `Certificate and chain saved at: /etc/letsencrypt/live/hasverl.xyz/fullchain.pem`

- [ ] **Step 3: CORS_ORIGINS in `.env` auf dem Server aktualisieren**

```bash
nano /root/immoverwaltung/.env
```

Die Zeile `CORS_ORIGINS=...` auf folgendes ändern:

```
CORS_ORIGINS=https://hasverl.xyz,https://mieter.hasverl.xyz
```

- [ ] **Step 4: Code pullen und Container neu bauen**

```bash
cd /root/immoverwaltung
git pull origin master
docker compose up -d --build
```

Erwartetes Ergebnis: Docker baut das neue `Dockerfile.frontend` (alle 3 Stages), Container starten ohne Fehler.

- [ ] **Step 5: Verifikation**

```bash
# Health-Check Hauptapp
curl -k https://hasverl.xyz/health

# Mieter-Portal erreichbar?
curl -I https://mieter.hasverl.xyz
# Erwartung: HTTP/2 200
```

Browser öffnen: `https://mieter.hasverl.xyz` → Login-Seite des Mieter-Portals erscheint.
