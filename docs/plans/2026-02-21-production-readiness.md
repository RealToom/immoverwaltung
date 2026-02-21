# Production Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix alle blockierenden Produktionsprobleme, lokales Docker-Setup ohne SSL-Zwang, Frontend-Bundle aufteilen und Seed-Daten für neue Features ergänzen.

**Architecture:** Keine neuen Features — nur Konfigurationsänderungen, Tooling-Fixes und Dokumentation. Jede Aufgabe ist unabhängig und kann ohne Abhängigkeiten ausgeführt werden.

**Tech Stack:** GitHub Actions, Docker Compose, nginx, Vite (manualChunks), Prisma (seed)

---

### Task 1: CI-Workflow reparieren — prisma generate fehlt

**Files:**
- Modify: `.github/workflows/ci.yml:39-45`

**Step 1: Füge `prisma generate` Step ein**

In `.github/workflows/ci.yml` nach Zeile 41 (`run: npm ci`) einen neuen Step einfügen:

```yaml
      - name: Install backend dependencies
        working-directory: backend
        run: npm ci

      - name: Generate Prisma client
        working-directory: backend
        run: npx prisma generate

      - name: TypeScript check
        working-directory: backend
        run: npx tsc --noEmit
```

**Step 2: Verifikation**

Datei prüfen — der neue Step muss zwischen "Install backend dependencies" und "TypeScript check" stehen:
```bash
grep -n "prisma generate\|TypeScript check\|Install backend" .github/workflows/ci.yml
```
Erwartete Ausgabe:
```
39:      - name: Install backend dependencies
42:      - name: Generate Prisma client
45:        run: npx prisma generate
47:      - name: TypeScript check
49:        run: npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix: add prisma generate step to CI before tsc check"
```

---

### Task 2: Backend postinstall — prisma generate automatisch nach npm install

**Files:**
- Modify: `backend/package.json:6-19`

**Step 1: postinstall-Script hinzufügen**

In `backend/package.json` im `scripts`-Block ergänzen:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "postinstall": "prisma generate",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 2: Verifikation — TypeScript-Check nach frischem prisma generate**

```bash
cd backend && npx tsc --noEmit
```
Erwartete Ausgabe: leer (keine Fehler)

**Step 3: Commit**

```bash
git add backend/package.json
git commit -m "fix: add postinstall prisma generate to backend package.json"
```

---

### Task 3: nul-Datei löschen

**Files:**
- Delete: `nul` (Windows-Artefakt im Projekt-Root, nicht in Git getrackt)

**Step 1: Datei löschen**

```bash
rm nul
```

**Step 2: Verifikation**

```bash
ls nul 2>&1 || echo "OK — nul deleted"
git status
```
Erwartete Ausgabe: "OK — nul deleted", git status zeigt keine Änderungen (war nicht getrackt).

---

### Task 4: nginx.local.conf — HTTP-only für lokalen Docker-Test

**Files:**
- Create: `cozy-estate-central/nginx.local.conf`

**Step 1: Datei erstellen**

`cozy-estate-central/nginx.local.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Security Headers (ohne HSTS, da kein HTTPS)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;

    # SPA: Alle Routen auf index.html umleiten
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API-Requests an Backend weiterleiten
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health-Check weiterleiten
    location /health {
        proxy_pass http://backend:3001;
    }

    # Caching fuer statische Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Step 2: Verifikation**

```bash
grep -c "listen 80" cozy-estate-central/nginx.local.conf
grep "return 301" cozy-estate-central/nginx.local.conf || echo "OK — kein HTTPS-Redirect"
```
Erwartete Ausgabe: `1`, dann `OK — kein HTTPS-Redirect`

**Step 3: Commit**

```bash
git add cozy-estate-central/nginx.local.conf
git commit -m "feat: add nginx.local.conf for HTTP-only local docker setup"
```

---

### Task 5: docker-compose.local.yml — lokales Docker ohne SSL

**Files:**
- Create: `docker-compose.local.yml`

**Step 1: Datei erstellen**

`docker-compose.local.yml`:

```yaml
# Lokales Docker-Setup ohne SSL-Zertifikate
# Start: docker compose -f docker-compose.local.yml up -d --build
# App:   http://localhost:8080
# Login: admin@immoverwalt.de / Admin123!

services:
  postgres:
    image: postgres:16-alpine
    container_name: immoverwaltung-db-local
    restart: unless-stopped
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_DB: immoverwaltung
      POSTGRES_USER: immo
      POSTGRES_PASSWORD: immo_local_2026
    volumes:
      - postgres_data_local:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U immo -d immoverwaltung"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: immoverwaltung-backend-local
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://immo:immo_local_2026@postgres:5432/immoverwaltung?schema=public"
      JWT_ACCESS_SECRET: "local-dev-access-secret-not-for-production-use"
      JWT_REFRESH_SECRET: "local-dev-refresh-secret-not-for-production-use"
      PORT: "3001"
      NODE_ENV: production
      CORS_ORIGINS: "http://localhost:8080"
      SEED_DB: "true"
      UPLOAD_DIR: /app/uploads
      ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
      BCRYPT_COST: "10"
      ANTHROPIC_API_KEY: ""
      SMTP_HOST: ""
      SMTP_PORT: "587"
      SMTP_USER: ""
      SMTP_PASS: ""
      SMTP_FROM: "noreply@immoverwalt.de"
    volumes:
      - uploads_data_local:/app/uploads
    entrypoint: ["sh", "docker-entrypoint.sh"]
    expose:
      - "3001"

  frontend:
    build:
      context: ./cozy-estate-central
      dockerfile: Dockerfile
    container_name: immoverwaltung-frontend-local
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "8080:80"
    volumes:
      - ./cozy-estate-central/nginx.local.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  postgres_data_local:
  uploads_data_local:
```

**Step 2: Verifikation — YAML syntax**

```bash
docker compose -f docker-compose.local.yml config --quiet && echo "YAML OK"
```
Erwartete Ausgabe: `YAML OK`

**Step 3: Commit**

```bash
git add docker-compose.local.yml
git commit -m "feat: add docker-compose.local.yml for local testing without SSL"
```

---

### Task 6: Bundle-Splitting in vite.config.ts

**Files:**
- Modify: `cozy-estate-central/vite.config.ts`

**Step 1: manualChunks hinzufügen**

`cozy-estate-central/vite.config.ts` komplett ersetzen:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react-big-calendar")) return "vendor-calendar";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("react-router-dom")) return "vendor-react";
          if (id.includes("@radix-ui") || id.includes("class-variance-authority") || id.includes("clsx") || id.includes("tailwind-merge") || id.includes("lucide-react")) return "vendor-ui";
          if (id.includes("@tanstack") || id.includes("date-fns")) return "vendor-query";
        },
      },
    },
  },
}));
```

**Step 2: Build ausführen und Chunk-Größen prüfen**

```bash
cd cozy-estate-central && npm run build 2>&1 | grep "dist/assets"
```
Erwartete Ausgabe: Mehrere Chunks, keiner größer als 500 KB. Beispiel:
```
dist/assets/vendor-react-xxx.js      ~150 kB
dist/assets/vendor-calendar-xxx.js   ~250 kB
dist/assets/vendor-charts-xxx.js     ~200 kB
dist/assets/vendor-ui-xxx.js         ~300 kB
dist/assets/vendor-query-xxx.js      ~100 kB
dist/assets/index-xxx.js             ~200 kB
```
Wenn noch Chunks > 500 KB: Prüfe welcher Chunk das ist und füge ihn zu den passenden manualChunks-Regeln hinzu.

**Step 3: Commit**

```bash
git add cozy-estate-central/vite.config.ts
git commit -m "perf: add bundle splitting via vite manualChunks"
```

---

### Task 7: Seed-Daten für neue Features

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Cleanup-Block am Anfang erweitern**

Im `main()`-Block, im Cleanup-Abschnitt (Zeile ~14), die neuen Modelle hinzufügen. Die neuen Deletes müssen VOR den bestehenden stehen (wegen FK-Constraints):

```typescript
async function main() {
  console.log("Seeding database...");

  // Clean existing data — neue Modelle zuerst (FK-abhängig)
  await prisma.documentTemplate.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.handoverProtocol.deleteMany();
  await prisma.dunningRecord.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  // ... bestehende deleteMany() folgen danach
  await prisma.rentPayment.deleteMany();
  await prisma.transaction.deleteMany();
  // ... etc.
```

**Step 2: Seed-Daten für neue Features einfügen — direkt vor `console.log("Seeding completed.")`**

Am Ende der `main()`-Funktion, kurz vor dem letzten `console.log`, folgenden Block einfügen:

```typescript
  // ─── Meter (Zähler) ────────────────────────────────────────
  // Referenz: units1[0] = "1A" in Residenz Am Park
  const meter1 = await prisma.meter.create({
    data: {
      label: "Stromzähler 1A",
      type: "STROM",
      unitId: units1[0].id,
      propertyId: p1.id,
      companyId: company.id,
    },
  });
  const meter2 = await prisma.meter.create({
    data: {
      label: "Wasserzähler 1A",
      type: "WASSER",
      unitId: units1[0].id,
      propertyId: p1.id,
      companyId: company.id,
    },
  });
  await prisma.meterReading.createMany({
    data: [
      { value: 4320.5, readAt: new Date("2026-01-01T12:00:00Z"), note: "Jahresablesung", meterId: meter1.id, companyId: company.id },
      { value: 4489.2, readAt: new Date("2026-02-01T12:00:00Z"), note: "Monatsablesung", meterId: meter1.id, companyId: company.id },
      { value: 112.3, readAt: new Date("2026-01-01T12:00:00Z"), note: "Jahresablesung", meterId: meter2.id, companyId: company.id },
      { value: 118.9, readAt: new Date("2026-02-01T12:00:00Z"), note: "Monatsablesung", meterId: meter2.id, companyId: company.id },
    ],
  });
  console.log("Meters + readings seeded");

  // ─── RecurringTransactions (Wiederkehrende Buchungen) ──────
  await prisma.recurringTransaction.createMany({
    data: [
      {
        description: "Hausverwaltungsgebühr",
        type: "AUSGABE",
        amount: 180.0,
        category: "Verwaltung",
        interval: "MONATLICH",
        dayOfMonth: 1,
        startDate: new Date("2025-01-01T12:00:00Z"),
        propertyId: p1.id,
        companyId: company.id,
      },
      {
        description: "Gebäudeversicherung Jahresprämie",
        type: "AUSGABE",
        amount: 1240.0,
        category: "Versicherung",
        interval: "JAEHRLICH",
        dayOfMonth: 15,
        startDate: new Date("2025-03-15T12:00:00Z"),
        propertyId: p1.id,
        companyId: company.id,
      },
      {
        description: "Gartenpflege Quartalsrechnung",
        type: "AUSGABE",
        amount: 420.0,
        category: "Instandhaltung",
        interval: "VIERTELJAEHRLICH",
        dayOfMonth: 1,
        startDate: new Date("2025-01-01T12:00:00Z"),
        propertyId: p1.id,
        companyId: company.id,
      },
    ],
  });
  console.log("RecurringTransactions seeded");

  // ─── DunningRecord (Mahnung) ────────────────────────────────
  // Referenz: contract für Thomas Wolf (GEKUENDIGT)
  const wolfContract = contracts.find((c) => c.tenantId === tenantByName["Thomas Wolf"].id)!;
  if (wolfContract) {
    await prisma.dunningRecord.create({
      data: {
        level: 1,
        sentAt: new Date("2026-01-15T12:00:00Z"),
        dueDate: new Date("2026-01-31T12:00:00Z"),
        totalAmount: 950.0,
        status: "OFFEN",
        contractId: wolfContract.id,
        companyId: company.id,
      },
    });
    console.log("DunningRecord seeded");
  }

  // ─── HandoverProtocol (Übergabeprotokoll) ──────────────────
  // Referenz: units1[0] = "1A" (Martin Schmidt eingezogen)
  await prisma.handoverProtocol.create({
    data: {
      type: "EINZUG",
      date: new Date("2022-03-01T12:00:00Z"),
      tenantName: "Martin Schmidt",
      notes: "Einzug ohne Mängel. Schlüssel übergeben (2× Haustür, 1× Keller).",
      rooms: [
        { name: "Wohnzimmer", condition: "GUT", notes: "" },
        { name: "Schlafzimmer", condition: "GUT", notes: "" },
        { name: "Küche", condition: "GUT", notes: "Neue Einbauküche vorhanden" },
        { name: "Bad", condition: "GUT", notes: "" },
        { name: "Flur", condition: "GUT", notes: "" },
      ],
      meterData: [
        { label: "Strom", value: 4320.5, type: "STROM" },
        { label: "Wasser", value: 112.3, type: "WASSER" },
      ],
      unitId: units1[0].id,
      companyId: company.id,
    },
  });
  console.log("HandoverProtocol seeded");

  // ─── MaintenanceSchedule (Wartungsplan) ────────────────────
  await prisma.maintenanceSchedule.createMany({
    data: [
      {
        title: "Heizungsanlage Jahreswartung",
        description: "Komplette Inspektion und Wartung der Heizungsanlage inkl. Brenner und Pumpen",
        category: "HEIZUNG",
        interval: "JAEHRLICH",
        nextDue: new Date("2026-10-01T12:00:00Z"),
        assignedTo: "Heizungsfirma Müller GmbH",
        propertyId: p1.id,
        companyId: company.id,
      },
      {
        title: "Rauchmelder Quartalscheck",
        description: "Funktionstest aller Rauchmelder (Drücken des Testknopfs, Batteriewechsel falls nötig)",
        category: "GEBAEUDE",
        interval: "VIERTELJAEHRLICH",
        nextDue: new Date("2026-04-01T12:00:00Z"),
        propertyId: p1.id,
        companyId: company.id,
      },
      {
        title: "Aufzug TÜV-Prüfung",
        description: "Gesetzlich vorgeschriebene Hauptuntersuchung des Aufzugs",
        category: "GEBAEUDE",
        interval: "JAEHRLICH",
        nextDue: new Date("2026-06-15T12:00:00Z"),
        assignedTo: "TÜV Rheinland",
        propertyId: p1.id,
        companyId: company.id,
      },
    ],
  });
  console.log("MaintenanceSchedules seeded");

  // ─── DocumentTemplate (Vorlagen) ───────────────────────────
  await prisma.documentTemplate.createMany({
    data: [
      {
        name: "Mietvertrag Standard",
        category: "Mietvertrag",
        content: `Mietvertrag

zwischen

{{landlord}} (Vermieter)

und

{{tenantName}} (Mieter)

§ 1 Mietobjekt
Das Mietobjekt befindet sich in der Immobilie "{{propertyName}}", Einheit {{unitNumber}}.

§ 2 Mietbeginn
Das Mietverhältnis beginnt am {{date}}.

§ 3 Miete
Die monatliche Kaltmiete beträgt {{amount}} EUR.

Datum: {{date}}

___________________________       ___________________________
{{landlord}} (Vermieter)          {{tenantName}} (Mieter)`,
        companyId: company.id,
      },
      {
        name: "Mahnung Stufe 1",
        category: "Mahnung",
        content: `Zahlungserinnerung

An: {{tenantName}}
Immobilie: {{propertyName}}, Einheit {{unitNumber}}
Datum: {{date}}

Sehr geehrte/r {{tenantName}},

hiermit erinnern wir Sie freundlich an die ausstehende Zahlung
in Höhe von {{amount}} EUR.

Bitte überweisen Sie den Betrag bis spätestens 14 Tage nach
Erhalt dieser Mahnung.

Mit freundlichen Grüßen
{{landlord}}`,
        companyId: company.id,
      },
      {
        name: "Übergabeprotokoll",
        category: "Übergabeprotokoll",
        content: `Wohnungsübergabeprotokoll

Datum: {{date}}
Mieter: {{tenantName}}
Immobilie: {{propertyName}}, Einheit {{unitNumber}}
Vermieter: {{landlord}}

Die Übergabe der Wohnung erfolgt in ordnungsgemäßem Zustand.
Die Zählerstände wurden notiert und von beiden Parteien bestätigt.

___________________________       ___________________________
{{landlord}} (Vermieter)          {{tenantName}} (Mieter)`,
        companyId: company.id,
      },
    ],
  });
  console.log("DocumentTemplates seeded");
```

**Step 3: Seed-Test ausführen**

```bash
cd backend && npm run db:reset
```
Erwartete Ausgabe: Alle `console.log`-Zeilen erscheinen, kein Fehler. Letzte Zeile: `Seeding completed.`

**Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add seed data for all new feature-backlog models"
```

---

### Task 8: DEPLOYMENT.md — Lokal- und Cloud-Abschnitte ergänzen

**Files:**
- Modify: `DEPLOYMENT.md`

**Step 1: Neuen Abschnitt "Lokaler Test (ohne SSL)" direkt nach der Produktions-Checkliste einfügen**

Nach dem Abschnitt `## Produktions-Checkliste` und vor `## Voraussetzungen` folgendes einfügen:

```markdown
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

**Rechenzentren:** Nürnberg, Falkenstein, Falkenstein (Deutschland)
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
# → SSL_CERT_PATH=/etc/letsencrypt/live/deine-domain.de in .env setzen

# App starten
docker compose up -d --build

# Updates deployen (nach git push)
git pull origin master
docker compose up -d --build
```
```

**Step 2: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: add local docker test + German cloud deployment guide"
```

---

### Task 9: Finale Verifikation

**Step 1: Alle Tests**

```bash
cd backend && npm test
```
Erwartete Ausgabe: `Tests: 21 passed`

```bash
cd ../cozy-estate-central && npm test
```
Erwartete Ausgabe: `Tests: 9 passed`

**Step 2: TypeScript-Check**

```bash
cd ../backend && npx tsc --noEmit && echo "Backend TS: OK"
cd ../cozy-estate-central && npx tsc --noEmit && echo "Frontend TS: OK"
```
Erwartete Ausgabe: je `Backend TS: OK` und `Frontend TS: OK`

**Step 3: Frontend-Build**

```bash
cd cozy-estate-central && npm run build 2>&1 | grep -E "dist/assets|built in|error"
```
Erwartete Ausgabe: Mehrere Chunk-Zeilen, kein Chunk > 500 KB, kein `error`.

**Step 4: Docker Compose Syntax prüfen**

```bash
docker compose -f docker-compose.local.yml config --quiet && echo "local: OK"
docker compose config --quiet && echo "prod: OK"
```
Erwartete Ausgabe: `local: OK` und `prod: OK`

**Step 5: Seed-Daten testen**

```bash
cd backend && npm run db:reset 2>&1 | grep -E "seeded|Seeding completed|error"
```
Erwartete Ausgabe: Alle neuen `seeded`-Zeilen erscheinen, `Seeding completed.` am Ende, kein Fehler.

**Step 6: Summary-Commit falls noch Änderungen offen**

```bash
git status
# Falls sauber: nichts zu tun
# Falls Änderungen: git add + git commit
```
