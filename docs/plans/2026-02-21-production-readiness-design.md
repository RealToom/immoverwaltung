# Production Readiness Design — 2026-02-21

## Kontext

Alle Features sind implementiert und auf `master` gemergt. Alle 30 Tests (21 Backend + 9 Frontend)
bestehen. Vor dem ersten Produktionseinsatz sind 5 Bereiche zu adressieren.

## Ziel

Die App soll:
1. Lokal per `docker compose -f docker-compose.local.yml up` testbar sein (kein SSL)
2. Produktionsbereit für Cloud-Hosting in Deutschland (Hetzner/IONOS) sein
3. CI auf GitHub Actions zuverlässig grün sein
4. Schnelle Ladezeiten durch Bundle-Splitting haben
5. Demo-Daten für alle neuen Features bereitstellen

---

## Abschnitt 1: Kritische Fixes

### 1a. CI-Workflow (`.github/workflows/ci.yml`)

Problem: Beim `npx tsc --noEmit` im Backend-Job fehlt ein vorheriges `npx prisma generate`.
Auf frischem Checkout fehlen die generierten Prisma-Typen → CI schlägt fehl.

Fix: Zwischen `npm ci` und `npx tsc --noEmit` einen neuen Step einfügen:
```yaml
- name: Generate Prisma client
  working-directory: backend
  run: npx prisma generate
```

### 1b. Backend postinstall (`backend/package.json`)

Problem: Nach `npm ci` ist der Prisma-Client nicht generiert. Entwickler müssen manuell
`npx prisma generate` ausführen.

Fix: `"postinstall": "prisma generate"` in `scripts` einfügen. Dann läuft `npm ci`
in CI und lokal automatisch durch.

Hinweis: Der Dockerfile macht das bereits explizit — `postinstall` ist dort also
redundant aber schadet nicht.

### 1c. nul-Datei löschen

Windows-Artefakt im Projekt-Root. Nicht in Git getrackt. Einfach löschen.

---

## Abschnitt 2: Lokal-freundliches Docker

### `docker-compose.local.yml` (neu im Root)

Für lokale Entwicklung ohne SSL-Zertifikate. Unterschiede zum Produktions-Compose:
- Frontend-Port: `8080:80` (statt 80+443)
- Kein SSL-Volume-Mount
- Alle Pflicht-Env-Vars als Dev-Defaults gesetzt (kein `:?` Fehler)
- `SEED_DB=true` standardmäßig
- Verwendet `nginx.local.conf` statt `nginx.conf`

Benutzung:
```bash
docker compose -f docker-compose.local.yml up -d --build
# App: http://localhost:8080
# Login: admin@immoverwalt.de / Admin123!
```

### `cozy-estate-central/nginx.local.conf` (neu)

Wie `nginx.conf`, aber:
- Kein HTTPS-Redirect-Block
- Kein SSL-Listener
- Nur HTTP auf Port 80

---

## Abschnitt 3: Bundle-Splitting

### `cozy-estate-central/vite.config.ts`

Ziel: 1 × 1.32 MB → 5–6 kleinere Chunks für besseres Browser-Caching.

`build.rollupOptions.output.manualChunks` Konfiguration:

```
vendor-react     → react, react-dom, react-router-dom
vendor-calendar  → react-big-calendar
vendor-charts    → recharts
vendor-ui        → @radix-ui/*, class-variance-authority, clsx, tailwind-merge, lucide-react
vendor-query     → @tanstack/react-query, date-fns
```

Alle anderen Imports landen im Standard-Chunk (`index`).

---

## Abschnitt 4: Seed-Daten

### `backend/prisma/seed.ts`

Neue Demo-Daten für alle 7 Feature-Backlog-Features, verknüpft mit bestehenden Seed-Einträgen
(Property "Musterstraße 1", Tenant "Max Mustermann", Unit 1):

| Model | Beispiele |
|-------|-----------|
| `Meter` | Stromzähler + Wasserzähler für Unit 1 |
| `MeterReading` | Je 2 Ablesungen pro Zähler (Jan + Feb 2026) |
| `RecurringTransaction` | Hausverwaltungsgebühr monatlich, Versicherung jährlich, Gartenpflege quartalsweise |
| `DunningRecord` | 1 Demo-Mahnung Stufe 1 für Referenz-Contract |
| `HandoverProtocol` | 1 Einzugsprotokoll (3 Räume mit Zustand, 2 Zählerstände) |
| `MaintenanceSchedule` | Heizungswartung jährlich, Rauchmelder-Check quartalsweise |
| `DocumentTemplate` | Mietvertrag-Vorlage, Mahnungs-Vorlage, Übergabe-Vorlage (je mit Handlebars-Vars) |

---

## Abschnitt 5: DEPLOYMENT.md Ergänzungen

### Neuer Abschnitt: Lokaler Test

```bash
# Schnellstart ohne SSL:
cp .env.local.example .env.local   # (wird durch docker-compose.local.yml gelesen)
docker compose -f docker-compose.local.yml up -d --build
```

### Neuer Abschnitt: Deutsche Cloud (Hetzner / IONOS)

**Empfohlene Server:**
- Hetzner Cloud CX22: 2 vCPU, 4 GB RAM, 40 GB SSD — ~6 €/Monat, Rechenzentrum Nürnberg/Falkenstein
- IONOS VPS S: 1 vCPU, 2 GB RAM — ~2 €/Monat (minimale Option)

**DSGVO:**
- Hetzner: Auftragsverarbeitungsvertrag (AVV) verfügbar → konform mit DSGVO Art. 28
- IONOS: ebenfalls AVV verfügbar, Rechenzentrum in Berlin
- Keine Datentransfers in Drittländer → Art. 44 DSGVO erfüllt

**Firewall (Hetzner Cloud):**
```bash
# In Hetzner Cloud Console: Firewall anlegen
# Eingehend erlauben: TCP 80, TCP 443
# Alles andere blockieren
```

**Deployment-Workflow nach Ersteinrichtung:**
```bash
git pull origin master
docker compose up -d --build
```

---

## Dateien geändert / erstellt

| Datei | Aktion |
|-------|--------|
| `.github/workflows/ci.yml` | Ergänzt: `prisma generate` Step |
| `backend/package.json` | Ergänzt: `postinstall` Script |
| `docker-compose.local.yml` | Neu: HTTP-only local compose |
| `cozy-estate-central/nginx.local.conf` | Neu: nginx ohne HTTPS |
| `cozy-estate-central/vite.config.ts` | Ergänzt: `manualChunks` |
| `backend/prisma/seed.ts` | Ergänzt: Seed für neue Features |
| `DEPLOYMENT.md` | Ergänzt: Lokal-Section + Cloud-Section |
| `nul` | Gelöscht |

---

## Verifikation

Nach der Implementierung:
1. `npx tsc --noEmit` in backend/ → 0 Fehler
2. `npm run build` in cozy-estate-central/ → kein Chunk > 500 KB
3. `npm test` in backend/ → 21/21 ✅
4. `npm test` in cozy-estate-central/ → 9/9 ✅
5. `npm run db:reset` in backend/ → Seed läuft durch ohne Fehler
6. `docker compose -f docker-compose.local.yml up -d --build` → http://localhost:8080 erreichbar
