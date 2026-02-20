# CLAUDE.md - Immoverwaltung

## Projekt

Webbasierte Immobilienverwaltung (Property Management) mit Multi-Tenancy. Jede Hausverwaltungsfirma hat eigene, isolierte Daten.

## Architektur

```
immoverwaltung/
├── cozy-estate-central/   # Frontend (React + TypeScript + Vite)
├── backend/               # Backend (Express + Prisma + PostgreSQL)
└── PROJEKTDOKUMENTATION.md  # Fortlaufende Projektdoku (immer aktualisieren!)
```

## Befehle

### Backend
```bash
cd backend
docker-compose up -d          # PostgreSQL starten
npm run dev                   # Dev-Server (Port 3001, watch mode)
npm run db:migrate            # Prisma Migrationen ausfuehren
npm run db:seed               # Seed-Daten laden
npm run db:studio             # Prisma Studio (DB-Browser)
npm run db:reset              # DB zuruecksetzen + neu seeden
npm test                      # Unit-Tests ausfuehren (vitest)
npm run test:coverage         # Tests mit Coverage-Report
npx tsc --noEmit              # TypeScript pruefen
```

### Frontend
```bash
cd cozy-estate-central
npm run dev                   # Dev-Server (Port 8080)
npm run build                 # Production Build
npm test                      # Unit-Tests ausfuehren (vitest)
```

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Shadcn/UI, React Query, React Router |
| Backend | Node.js, Express 5, TypeScript, Prisma 6, PostgreSQL 16, JWT, Zod, bcrypt, express-rate-limit, pino, pino-http |
| DB | PostgreSQL via Docker (`docker-compose.yml` in `backend/`) |

## Backend-Muster

- **Schichten:** Routes → Controllers → Services → Prisma
- **Multi-Tenancy:** Jede Tabelle hat `companyId`. Der `tenantGuard` Middleware setzt `req.companyId` aus dem JWT. Alle Service-Funktionen nehmen `companyId` als ersten Parameter.
- **Auth:** JWT Access Token (15min) + Refresh Token (7d, httpOnly Cookie, DB-gespeichert mit Rotation). Token-Payload: `{ userId, companyId, role }`.
- **RBAC:** `requireRole()` Middleware in Routes. Rollen: ADMIN, VERWALTER (voller Zugriff), BUCHHALTER (Contracts+Finance schreiben), READONLY (nur lesen).
- **Rate-Limiting:** `authLimiter` (10 Req/15min pro IP) auf Login/Register/Refresh. `apiLimiter` (200 Req/min pro IP) auf allen Schreib-Endpunkten (POST/PATCH/DELETE).
- **Account-Lockout:** 10 Fehlversuche → 30 Min Sperre. Felder `failedLoginAttempts` + `lockedUntil` auf User.
- **Logging:** Pino (strukturiertes JSON-Logging via pino-http). Log-Level per `LOG_LEVEL` Env-Variable konfigurierbar.
- **Validierung:** Zod-Schemas in `src/schemas/`. Middleware `validate()` prueft body/query/params (query ist read-only in Express 5).
- **Fehlerbehandlung:** Custom `AppError`-Klassen in `src/lib/errors.ts`. Globaler `errorHandler` in Middleware.
- **API-Format:** `{ data: ... }` fuer Einzelobjekte, `{ data: [...], meta: { total, page, limit, totalPages } }` fuer Listen.
- **Imports:** Immer `.js` Extension (ESM). Beispiel: `import { prisma } from "../lib/prisma.js"`

## Frontend-Muster

- **Routing:** React Router in `App.tsx`. Seiten in `src/pages/`. Geschuetzt durch `ProtectedRoute`.
- **UI:** Shadcn/UI Komponenten in `src/components/ui/`. Business-Komponenten in `src/components/`.
- **Auth:** `AuthContext` in `src/contexts/AuthContext.tsx`. Access Token in localStorage, Refresh Token als httpOnly Cookie.
- **API-Client:** `src/lib/api.ts` - Fetch-basiert, automatischer Token-Refresh bei 401.
- **Daten:** React Query Hooks in `src/hooks/api/`. Alle Seiten nutzen API-Daten (nur Theme/autoSave in localStorage).
- **Enum-Mapping:** `src/lib/mappings.ts` - Backend SCREAMING_CASE <-> Frontend deutsch. Bidirektional.
- **Formulare:** useState mit inline Validierung. Spaeter React Hook Form + Zod.
- **Notifications:** Toast via `use-toast` Hook und Sonner.
- **Sprache:** Alles auf Deutsch. Datumsformat: DD.MM.YYYY. Waehrung: EUR.

## Wichtige Konventionen

- **Sprache:** User kommuniziert auf Deutsch. Code, Variablen und Kommentare auf Englisch. UI-Texte auf Deutsch.
- **PROJEKTDOKUMENTATION.md:** Bei jeder signifikanten Aenderung aktualisieren (neue Features, neue Endpunkte, Architekturentscheidungen).
- **Prisma-Enums:** SCREAMING_SNAKE_CASE (z.B. `AKTIV`, `SANITAER`, `WOHNUNG`). Mapping zu deutschen Strings im Frontend.
- **Property-Adresse:** Aufgeteilt in `street`, `zip`, `city`. Backend liefert berechnetes `address`-Feld.
- **Unit-Typen:** `UnitType` Enum (WOHNUNG, GARAGE, STELLPLATZ). Mieter koennen mehrere Units haben (1:n).
- **IDs:** Integer (autoincrement) im Backend. Frontend nutzt jetzt Integer-IDs aus der API (Mock-Daten hatten String-IDs).
- **Kein Prisma 7:** Prisma 7 hat Breaking Changes (`url` in datasource entfernt). Prisma 6.x verwenden.

## Seed-Login

- **E-Mail:** admin@immoverwalt.de
- **Passwort:** Admin123!
- **Firma:** Mustermann Hausverwaltung GmbH

## Aktueller Status

- Phase 1 (Backend): Abgeschlossen - alle CRUD-Endpunkte implementiert
- Phase 2 (Frontend-Integration): Abgeschlossen - alle Seiten auf API umgestellt, keine Mock-Daten
- Phase 3 (Mock-Bereinigung): Abgeschlossen
- Phase 4 (Settings + RentPayment): Abgeschlossen
- Phase 7 (Dokument-Preview, Ticket-Bearbeitung, Unit-Typen, Adress-Aufspaltung): Abgeschlossen
- Production-Hardening: Abgeschlossen - Migrationen, Graceful Shutdown, HTTPS+nginx, Tests (19+9)
- Security-Haertung Runde 1+2: Abgeschlossen - Rate-Limiting (auth/api/admin), RBAC, Account-Lockout, Refresh-Token-DB, Passwort-Komplexitaet, CORS, Pino, HSTS, BCRYPT_COST, MIME-Whitelist, Magic-Bytes, SameSite=Strict, AuditLog-DB
- KI-Belegscan: Abgeschlossen - POST /api/finance/scan (Claude Haiku Vision)
- F6 Nebenkostenabrechnung: Abgeschlossen - allocatable, utility-statement
- F9 ROI-Dashboard: Abgeschlossen - purchasePrice+equity, /finance/roi, Rendite-Tab
- Benutzerverwaltung: Abgeschlossen - /api/users CRUD + reset-password + unlock, Users.tsx
- Production-Readiness: Abgeschlossen - docker-compose Haertung, GitHub Actions CI, backup.sh, E-Mail Passwort-Reset, DEPLOYMENT.md Checkliste
- Passwort-Aendern: Abgeschlossen - PATCH /api/auth/me/password + Settings Sicherheit-Tab
