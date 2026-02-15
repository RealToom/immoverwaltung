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
npx tsc --noEmit              # TypeScript pruefen
```

### Frontend
```bash
cd cozy-estate-central
npm run dev                   # Dev-Server (Port 8080)
npm run build                 # Production Build
```

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Shadcn/UI, React Query, React Router |
| Backend | Node.js, Express 5, TypeScript, Prisma 6, PostgreSQL 16, JWT, Zod, bcrypt, express-rate-limit, morgan |
| DB | PostgreSQL via Docker (`docker-compose.yml` in `backend/`) |

## Backend-Muster

- **Schichten:** Routes → Controllers → Services → Prisma
- **Multi-Tenancy:** Jede Tabelle hat `companyId`. Der `tenantGuard` Middleware setzt `req.companyId` aus dem JWT. Alle Service-Funktionen nehmen `companyId` als ersten Parameter.
- **Auth:** JWT Access Token (15min) + Refresh Token (7d, httpOnly Cookie, DB-gespeichert mit Rotation). Token-Payload: `{ userId, companyId, role }`.
- **RBAC:** `requireRole()` Middleware in Routes. Rollen: ADMIN, VERWALTER (voller Zugriff), BUCHHALTER (Contracts+Finance schreiben), READONLY (nur lesen).
- **Rate-Limiting:** `authLimiter` (10 Req/15min pro IP) auf Login/Register/Refresh.
- **Account-Lockout:** 10 Fehlversuche → 30 Min Sperre. Felder `failedLoginAttempts` + `lockedUntil` auf User.
- **Logging:** Morgan (`dev` in Development, `combined` in Production).
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
- **Prisma-Enums:** SCREAMING_SNAKE_CASE (z.B. `AKTIV`, `SANITAER`). Mapping zu deutschen Strings im Frontend.
- **IDs:** Integer (autoincrement) im Backend. Frontend nutzt jetzt Integer-IDs aus der API (Mock-Daten hatten String-IDs).
- **Kein Prisma 7:** Prisma 7 hat Breaking Changes (`url` in datasource entfernt). Prisma 6.x verwenden.

## Seed-Login

- **E-Mail:** admin@immoverwalt.de
- **Passwort:** Admin123!
- **Firma:** Mustermann Hausverwaltung GmbH

## Aktueller Status

- Phase 1 (Backend): Abgeschlossen - alle CRUD-Endpunkte implementiert
- Phase 2 (Frontend-Integration): Abgeschlossen - Login, Properties, PropertyDetail, Tenants, Contracts, Maintenance auf API umgestellt
- Phase 3 (Mock-Bereinigung): Abgeschlossen - Dashboard, Finances, Reports, Notifications auf API umgestellt
- Security-Haertung: Abgeschlossen - Rate-Limiting, RBAC, Account-Lockout, Refresh-Token-DB, Passwort-Komplexitaet, CORS env, Morgan Logging, Type-Safety
- Phase 4: Abgeschlossen - Settings auf API (Profil, Benachrichtigungen, Firmendaten, App-Config), RentPayment-Model + Mieteingangsquote-Chart auf API. Keine Mock-Daten mehr.
