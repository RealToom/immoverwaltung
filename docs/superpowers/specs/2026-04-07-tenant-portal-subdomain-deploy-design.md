# Design: tenant-portal auf mieter.hasverl.xyz

**Datum:** 2026-04-07  
**Status:** Genehmigt

## Ziel

Das bestehende `tenant-portal/` (React PWA für Mieter) wird unter der Subdomain `mieter.hasverl.xyz` produktiv erreichbar gemacht. Bisher fehlt jegliche Build- und Deploy-Integration.

## Architektur

```
hasverl.xyz          → cozy-estate-central (Verwaltungs-App)
mieter.hasverl.xyz   → tenant-portal (Mieter-App PWA)
                         ↓
               gleicher Backend-Container (backend:3001)
               gleicher nginx-Container (immoverwaltung-frontend)
               SAN-Zertifikat deckt beide Domains
```

## Änderungen lokal (Code)

### 1. `Dockerfile.frontend` (neu, im Root)

Multi-Stage Build:
- Stage 1 (`builder-main`): baut `cozy-estate-central` → `dist`
- Stage 2 (`builder-tenant`): baut `tenant-portal` → `dist`
- Stage 3 (nginx): kopiert beide Dists
  - `/usr/share/nginx/html` → Hauptapp
  - `/usr/share/nginx/tenant-portal` → Mieter-Portal
  - `nginx.conf` mit beiden Server-Blöcken

Build-Kontext ist `.` (Root), damit beide Unterordner erreichbar sind.

### 2. `cozy-estate-central/nginx.conf` erweitern

Neuer `server`-Block für HTTPS 443 mit `server_name mieter.hasverl.xyz`:
- Gleicher SSL-Cert-Pfad (SAN-Cert deckt beide Domains)
- `root /usr/share/nginx/tenant-portal`
- `location /` → `try_files $uri $uri/ /index.html` (SPA)
- `location /api/` → `proxy_pass http://backend:3001` (gleich wie Hauptapp)
- Gleiche Security-Headers

### 3. `docker-compose.yml`

- Frontend-Service: `build.context: .`, `build.dockerfile: Dockerfile.frontend`
- `CORS_ORIGINS` um `https://mieter.hasverl.xyz` erweitern

## Änderungen auf dem Server

### 4. DNS

A-Record anlegen: `mieter.hasverl.xyz → [Server-IP von hasverl.xyz]`

### 5. SSL-Zertifikat erweitern (SAN)

```bash
certbot certonly --nginx -d hasverl.xyz -d mieter.hasverl.xyz
cp -L /etc/letsencrypt/live/hasverl.xyz/fullchain.pem /root/immoverwaltung/ssl/
cp -L /etc/letsencrypt/live/hasverl.xyz/privkey.pem /root/immoverwaltung/ssl/
```

### 6. Deploy

```bash
cd /root/immoverwaltung
git pull origin master
docker compose up -d --build
```

## Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| SSL | SAN-Zertifikat | Ein Certbot-Befehl, kein DNS-Challenge nötig |
| Container | Ein nginx-Container für beide Apps | Kein extra Port, keine Proxy-Kette |
| API-Calls | Relative Pfade (`/api/tenant/...`) | Nginx leitet weiter — kein Umbau im Frontend nötig |
| Subdomain vs. Unterverzeichnis | Subdomain | Professioneller, saubere PWA-Origin, Branding-fähig |
