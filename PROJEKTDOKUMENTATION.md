# Immoverwaltung - Projektdokumentation

> **Letzte Aktualisierung:** 2026-02-13
> **Status:** Phase 4 abgeschlossen (Settings + Zahlungs-Tracking auf API)

---

## 1. Projektbeschreibung

**Immoverwaltung** ist eine webbasierte Property-Management-Software zur Verwaltung von Immobilien, Mietern, Vertraegen, Finanzen und Wartungsauftraegen. Das Frontend wurde mit Lovable erstellt und wird nun um ein Backend ergaenzt.

---

## 2. Technologie-Stack

### Frontend (vorhanden)

| Komponente | Technologie | Version |
|------------|-------------|---------|
| Framework | React + TypeScript | 18.3.1 / 5.8.3 |
| Build Tool | Vite (SWC) | 5.4.19 |
| Styling | Tailwind CSS | 3.4.17 |
| UI-Bibliothek | Shadcn/UI + Radix UI | - |
| Routing | React Router DOM | 6.30.1 |
| Server State | TanStack React Query | 5.83.0 |
| Formulare | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| Charts | Recharts | 2.15.4 |
| Icons | Lucide React | 0.462.0 |
| Notifications | Sonner | 1.7.4 |
| Datumslib | date-fns | 3.6.0 |
| Theme | next-themes | 0.3.0 |

### Backend (implementiert)

| Komponente | Technologie | Version |
|------------|-------------|---------|
| Runtime | Node.js + TypeScript | 22+ / 5.9.3 |
| Framework | Express | 5.2.1 |
| ORM | Prisma | 6.19.2 |
| Datenbank | PostgreSQL (Docker) | 16-alpine |
| Auth | JWT (Access + Refresh) | jsonwebtoken 9.x |
| Validierung | Zod | 4.3.6 |
| Passwort | bcrypt | 6.x |
| Rate-Limiting | express-rate-limit | 7.x |
| Logging | Morgan | 1.x |
| Dev-Server | tsx (watch mode) | 4.x |

### Multi-Tenancy

| Aspekt | Umsetzung |
|--------|-----------|
| Strategie | Shared DB + companyId Spalte |
| Isolation | tenantGuard Middleware + companyId Filter |
| Skalierung | Erweiterbar auf Schema-basierte Trennung |

---

## 3. Projektstruktur

```
immoverwaltung/
├── PROJEKTDOKUMENTATION.md
├── CLAUDE.md
├── backend/                       # Backend (Express + Prisma + PostgreSQL)
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.yml         # PostgreSQL Container
│   ├── prisma/
│   │   ├── schema.prisma          # 12 Models mit Multi-Tenancy
│   │   ├── seed.ts                # Seed-Daten (alle Mock-Daten)
│   │   └── migrations/            # Prisma Migrationen
│   └── src/
│       ├── index.ts               # Server Entry Point (Port 3001)
│       ├── app.ts                 # Express App Setup
│       ├── routes/                # Route-Definitionen
│       ├── controllers/           # Request-Handler
│       ├── services/              # Business-Logik + Prisma-Queries
│       ├── middleware/            # Auth, Validation, Error-Handler
│       ├── schemas/               # Zod-Validierungsschemas
│       └── lib/                   # Prisma Client, Errors, JWT Utils
└── cozy-estate-central/           # Frontend (React + Vite)
    ├── package.json
    ├── vite.config.ts             # Dev-Server Port 8080, Proxy /api -> :3001
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── index.html
    └── src/
        ├── main.tsx               # Entry Point
        ├── App.tsx                # Router + AuthProvider + QueryClient
        ├── index.css              # Globale Styles + CSS Variables
        ├── components/
        │   ├── AppSidebar.tsx     # Navigations-Sidebar
        │   ├── ProtectedRoute.tsx # Route Guard (Auth-Check)
        │   ├── KpiCard.tsx        # KPI-Metrik-Karte
        │   ├── NavLink.tsx        # Navigations-Link
        │   ├── PropertyTable.tsx  # Immobilien-Tabelle
        │   ├── QuickActions.tsx   # Schnellaktionen
        │   ├── RecentActivity.tsx # Aktivitaets-Feed
        │   └── ui/               # 56+ Shadcn/UI Komponenten
        ├── contexts/
        │   └── AuthContext.tsx    # Auth State (Login/Logout/Register)
        ├── pages/
        │   ├── Index.tsx          # Dashboard (Startseite) [API]
        │   ├── Properties.tsx     # Immobilienliste + Grid [API]
        │   ├── PropertyDetail.tsx # Immobilien-Detailansicht [API]
        │   ├── Tenants.tsx        # Mieterverwaltung [API]
        │   ├── Contracts.tsx      # Vertragsverwaltung [API]
        │   ├── Finances.tsx       # Finanzanalysen [API]
        │   ├── Maintenance.tsx    # Wartungsauftraege [API]
        │   ├── Reports.tsx        # Berichte & Analysen [API]
        │   ├── Notifications.tsx  # Benachrichtigungen [API]
        │   ├── Settings.tsx       # Einstellungen [API]
        │   ├── Login.tsx          # Authentifizierung [API]
        │   └── NotFound.tsx       # 404-Seite
        ├── hooks/
        │   ├── api/
        │   │   ├── useDashboard.ts          # Dashboard + Recent Activity Hooks
        │   │   ├── useFinance.ts            # Finance Summary, Revenue, Expenses, Transactions
        │   │   ├── useProperties.ts         # Property React Query Hooks
        │   │   ├── useTenants.ts            # Tenant React Query Hooks
        │   │   ├── useContracts.ts          # Contract React Query Hooks
        │   │   ├── useMaintenanceTickets.ts # Maintenance React Query Hooks
        │   │   └── useSettings.ts            # Profile, Notifications, Company Hooks
        │   ├── use-toast.ts
        │   └── use-mobile.tsx
        └── lib/
            ├── api.ts             # Fetch-basierter API-Client mit Token-Refresh
            ├── mappings.ts        # Enum/Datum Konvertierung (Backend <-> Frontend)
            └── utils.ts           # Tailwind Merge Utility
```

---

## 4. Features & Module

### Frontend (mit Backend-Integration)

| Modul | Seite | Datenquelle | Funktionen |
|-------|-------|-------------|------------|
| Login | `/login` | API | Login + Registrierung mit JWT Auth |
| Dashboard | `/` | API | 4 KPI-Karten, Immobilien-Tabelle, Schnellaktionen, Aktivitaets-Feed |
| Immobilien | `/properties` | API | Liste/Grid-Ansicht, Suche, Statusfilter, Belegungsstatistik |
| Immobilien-Detail | `/properties/:id` | API | Tabs: Einheiten, Mieter, Dokumente |
| Mieter | `/tenants` | API | Mieterliste, Suche, Immobilien-Filter, Mieter-Hinzufuegen-Dialog |
| Vertraege | `/contracts` | API | Vertragsliste, Filter (Status/Typ/Objekt), Erinnerungen, Vertrag-Anlegen-Dialog |
| Wartung | `/maintenance` | API | Ticket-Liste, Erstellen-Dialog, Prioritaeten, Status-Tracking |
| Finanzen | `/finances` | API | Einnahmen/Ausgaben-Charts, Transaktionsliste, KPIs, Zeitraum-Filter, Mieteingangsquote |
| Berichte | `/reports` | API | Belegung, Umsatz, Umsatz/qm, Wartungskosten (Charts) |
| Benachrichtigungen | `/notifications` | API | Vertrags- & Ticket-Benachrichtigungen, Filter nach Typ/Dringlichkeit |
| Einstellungen | `/settings` | API | Profil, E-Mail/Push-Benachrichtigungen, Theme (localStorage), App-Konfiguration, Firmendaten |

### Backend (abgeschlossen)

- [x] PostgreSQL via Docker + Prisma Schema (12 Models inkl. RentPayment)
- [x] REST-API mit Express 5
- [x] JWT-Authentifizierung (Access + Refresh Token)
- [x] CRUD fuer alle Entitaeten (Properties, Units, Tenants, Contracts, Maintenance, Documents)
- [x] Dashboard-Stats & Finance-Endpunkte
- [x] Multi-Tenancy (Shared DB + companyId)
- [x] Seed-Daten mit allen Mock-Daten aus dem Frontend
- [ ] Datei-Upload (Dokumente)
- [ ] E-Mail-Benachrichtigungen
- [ ] PDF-Export (Berichte)

### Frontend-Backend-Integration (Phase 2 - abgeschlossen)

- [x] Vite Proxy (`/api` -> `http://localhost:3001`)
- [x] API-Client mit automatischem Token-Refresh (`src/lib/api.ts`)
- [x] Auth-Context mit Login/Register/Logout (`src/contexts/AuthContext.tsx`)
- [x] ProtectedRoute-Komponente (`src/components/ProtectedRoute.tsx`)
- [x] Enum/Datum-Mapping Utilities (`src/lib/mappings.ts`)
- [x] React Query Hooks fuer Properties, Tenants, Contracts, Maintenance, Dashboard, Finance
- [x] Seiten umgestellt: Login, Properties, PropertyDetail, Tenants, Contracts, Maintenance
- [x] Phase 3: Dashboard (RecentActivity), Finances (Ausgabenverteilung), Reports, Notifications auf API umgestellt
- [x] Mock-Daten-Datei (data/properties.ts) geloescht — wird nirgends mehr importiert
- [x] Phase 4: Settings auf API umgestellt (Profil, Benachrichtigungen, Firmendaten, App-Config)
- [x] Phase 4: Zahlungs-Tracking (RentPayment-Model) + Mieteingangsquote-Chart auf API
- [x] Keine verbleibenden Mock-Daten (Darstellungs-Tab nutzt localStorage — geraetespezifisch)

### Security-Haertung (abgeschlossen)

- [x] Rate-Limiting auf Auth-Endpunkten (max 10 Anfragen/15 Min pro IP)
- [x] Passwort-Komplexitaet (mind. 1 Gross-/Kleinbuchstabe + 1 Ziffer)
- [x] CORS aus Umgebungsvariable (`CORS_ORIGINS`, Fallback auf localhost)
- [x] Request-Logging mit Morgan (combined/dev je nach Umgebung)
- [x] RBAC: `requireRole()` Middleware auf allen Schreib-Endpunkten
- [x] Account-Lockout nach 10 Fehlversuchen (30 Min Sperre)
- [x] Refresh-Token in DB mit Rotation + Revocation bei Logout
- [x] `as never` Type-Casts entfernt, typisierte Interfaces in Services

---

## 5. Datenmodell

### Property (Immobilie)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| name | String | string | Objektname |
| address | String | string | Adresse |
| status | Enum (AKTIV, WARTUNG) | string | Objektstatus |
| companyId | Int (FK) | - | Multi-Tenancy |
| _berechnet_ | - | totalUnits | Anzahl Einheiten |
| _berechnet_ | - | occupiedUnits | Belegte Einheiten |
| _berechnet_ | - | monthlyRevenue | Monatlicher Umsatz |

### Unit (Einheit)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| number | String | string | Einheits-Nummer |
| floor | Int | number | Stockwerk |
| area | Float | number | Flaeche in qm |
| rent | Float | number | Monatliche Miete |
| status | Enum (RENTED, VACANT, MAINTENANCE) | string | Status |
| propertyId | Int (FK) | number | Zugehoerige Immobilie |
| tenantId | Int? (FK) | number? | Zugewiesener Mieter |

### Tenant (Mieter)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| name | String | string | Vollstaendiger Name |
| email | String | string | E-Mail-Adresse |
| phone | String? | string? | Telefonnummer |
| moveIn | DateTime | string (ISO) | Einzugsdatum |
| companyId | Int (FK) | - | Multi-Tenancy |
| _relation_ | - | unit.number | Einheits-Nummer (ueber Unit) |
| _relation_ | - | unit.property.name | Immobilienname (ueber Unit->Property) |

### Contract (Vertrag)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| type | Enum (WOHNRAUM, GEWERBE, STAFFEL, INDEX) | string | Vertragstyp |
| startDate | DateTime | string (ISO) | Vertragsbeginn |
| endDate | DateTime? | string? (ISO) | Vertragsende |
| noticePeriod | Int | number | Kuendigungsfrist (Monate) |
| monthlyRent | Float | number | Monatliche Miete |
| deposit | Float | number | Kaution |
| status | Enum (AKTIV, GEKUENDIGT, AUSLAUFEND, ENTWURF) | string | Status |
| nextReminder | DateTime? | string? (ISO) | Naechste Erinnerung |
| reminderType | Enum? | string? | Erinnerungstyp |
| notes | String? | string? | Notizen |
| tenantId | Int (FK) | number | Mieter |
| propertyId | Int (FK) | number | Immobilie |
| unitId | Int (FK) | number | Einheit |

### MaintenanceTicket (Wartungsauftrag)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| title | String | string | Titel |
| description | String | string | Beschreibung |
| reportedBy | String | string | Gemeldet von |
| category | Enum (SANITAER, ELEKTRIK, ...) | string | Kategorie |
| priority | Enum (NIEDRIG, MITTEL, HOCH, DRINGEND) | string | Prioritaet |
| status | Enum (OFFEN, IN_BEARBEITUNG, WARTEND, ERLEDIGT) | string | Status |
| dueDate | DateTime? | string? (ISO) | Faelligkeitsdatum |
| assignedTo | String? | string? | Zugewiesen an |
| cost | Float? | number? | Kosten |
| notes | String? | string? | Notizen |
| propertyId | Int (FK) | number | Immobilie |
| unitId | Int? (FK) | number? | Einheit |

### Document (Dokument)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| name | String | string | Dateiname |
| fileType | String | string | Dateityp |
| fileSize | String | string | Dateigroesse |
| propertyId | Int (FK) | number | Zugehoerige Immobilie |

### RentPayment (Mietzahlung)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| month | DateTime | string (ISO) | 1. des Monats |
| amountDue | Float | number | Faelliger Betrag |
| amountPaid | Float | number | Gezahlter Betrag |
| status | Enum (PUENKTLICH, VERSPAETET, AUSSTEHEND) | string | Zahlungsstatus |
| dueDate | DateTime | string (ISO) | Faelligkeitsdatum |
| paidDate | DateTime? | string? (ISO) | Zahlungsdatum |
| contractId | Int (FK) | number | Zugehoeriger Vertrag |
| companyId | Int (FK) | - | Multi-Tenancy |

### Enum-Mapping (Backend -> Frontend)

| Backend (DB) | Frontend (UI) | Kontext |
|-------------|---------------|---------|
| AKTIV | aktiv | Property/Contract Status |
| WARTUNG | wartung | Property Status |
| RENTED | vermietet | Unit Status |
| VACANT | frei | Unit Status |
| MAINTENANCE | wartung | Unit Status |
| WOHNRAUM | Wohnraum | Contract Type |
| GEWERBE | Gewerbe | Contract Type |
| SANITAER | Sanitaer | Maintenance Category |
| NIEDRIG | niedrig | Maintenance Priority |
| OFFEN | offen | Maintenance Status |
| IN_BEARBEITUNG | in_bearbeitung | Maintenance Status |

Vollstaendige Mapping-Tabellen in `src/lib/mappings.ts`.

---

## 6. API-Endpunkte

Base-URL: `http://localhost:3001/api`

### Auth (oeffentlich)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| POST | /api/auth/register | Registrierung (erstellt Firma + Admin) |
| POST | /api/auth/login | Login, gibt Access+Refresh Token |
| POST | /api/auth/refresh | Access Token erneuern |
| POST | /api/auth/logout | Abmelden |
| GET | /api/auth/me | Eigenes Profil abrufen |
| PATCH | /api/auth/me | Profil aktualisieren |
| GET | /api/auth/me/notifications | Benachrichtigungs-Einstellungen |
| PATCH | /api/auth/me/notifications | Benachrichtigungen aktualisieren |

### Properties (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/properties | Alle Immobilien (mit berechneten KPIs) |
| GET | /api/properties/:id | Einzelne Immobilie mit Units, Docs |
| POST | /api/properties | Immobilie anlegen |
| PATCH | /api/properties/:id | Immobilie aktualisieren |
| DELETE | /api/properties/:id | Immobilie loeschen |

### Units (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/properties/:id/units | Einheiten einer Immobilie |
| POST | /api/properties/:id/units | Einheit anlegen |
| GET | /api/units/:id | Einzelne Einheit |
| PATCH | /api/units/:id | Einheit aktualisieren |
| DELETE | /api/units/:id | Einheit loeschen |

### Tenants, Contracts, Maintenance (geschuetzt)
Jeweils: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id

### Documents (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/properties/:id/documents | Dokumente einer Immobilie |
| POST | /api/properties/:id/documents | Dokument anlegen |
| DELETE | /api/documents/:id | Dokument loeschen |

### Company (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/company | Firmendaten + App-Einstellungen |
| PATCH | /api/company | Firmendaten aktualisieren (ADMIN, VERWALTER) |

### Dashboard + Finance (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/dashboard/stats | KPI-Uebersicht |
| GET | /api/dashboard/recent-activity | Letzte Aktivitaeten (Zahlungen, Mieter, Tickets) |
| GET | /api/finance/summary | Einnahmen/Ausgaben Zusammenfassung |
| GET | /api/finance/monthly | Monatliche Umsatzdaten (Charts) |
| GET | /api/finance/by-property | Umsatz pro Immobilie |
| GET | /api/finance/expense-breakdown | Ausgaben gruppiert nach Kategorie |
| GET | /api/finance/transactions | Transaktionsliste |
| POST | /api/finance/transactions | Transaktion anlegen |
| GET | /api/finance/rent-collection | Mieteingangsquote (pro Monat % puenktlich/verspaetet/ausstehend) |

---

## 7. Aenderungsprotokoll

| Datum | Aenderung |
|-------|-----------|
| 2026-02-11 | Projekt initialisiert, Dokumentationsdatei erstellt |
| 2026-02-11 | Lovable-Frontend importiert (cozy-estate-central) |
| 2026-02-11 | Vollstaendige Frontend-Analyse durchgefuehrt |
| 2026-02-11 | Backend Phase 1 implementiert: Express + Prisma + PostgreSQL |
| 2026-02-11 | Multi-Tenancy Architektur (Company + companyId) |
| 2026-02-11 | Alle CRUD-Endpunkte: Auth, Properties, Units, Tenants, Contracts, Maintenance, Documents, Finance, Dashboard |
| 2026-02-11 | Seed-Datei mit allen Mock-Daten |
| 2026-02-11 | Phase 2: Frontend-Backend-Integration abgeschlossen |
| 2026-02-11 | API-Client mit automatischem Token-Refresh (src/lib/api.ts) |
| 2026-02-11 | Auth-Context: Login, Register, Logout, Session-Check (src/contexts/AuthContext.tsx) |
| 2026-02-11 | ProtectedRoute-Komponente fuer geschuetzte Seiten |
| 2026-02-11 | Enum/Datum-Mapping Utilities (Backend SCREAMING_CASE <-> Frontend deutsch) |
| 2026-02-11 | React Query Hooks: useProperties, useTenants, useContracts, useMaintenanceTickets |
| 2026-02-11 | Seiten migriert: Login, Properties, PropertyDetail, Tenants, Contracts, Maintenance |
| 2026-02-11 | Vite Proxy konfiguriert (/api -> localhost:3001) |
| 2026-02-11 | Security-Audit: helmet, Body-Size-Limit, String-Max-Length, Cookie-Secure-Flag, Error-Handler gehaertet |
| 2026-02-11 | SECURITY.md erstellt mit 14 dokumentierten Sicherheitspunkten (6 behoben, 8 offen) |
| 2026-02-12 | Phase 3: Mock-Daten-Bereinigung - Dashboard RecentActivity + Finance Ausgabenverteilung auf API |
| 2026-02-12 | Neue Backend-Endpunkte: /api/dashboard/recent-activity, /api/finance/expense-breakdown |
| 2026-02-12 | Mock-Daten-Datei data/properties.ts geloescht |
| 2026-02-12 | Verbleibend statisch: Mieteingangsquote (rentCollection) in Finances, Settings-Seite |
| 2026-02-12 | Security-Haertung: Rate-Limiting, RBAC, Account-Lockout, Refresh-Token-DB, Passwort-Komplexitaet, CORS env, Morgan Logging, as-never entfernt |
| 2026-02-13 | Phase 4: Prisma-Schema erweitert (Company-Settings, User.notificationPrefs, RentPayment-Model) |
| 2026-02-13 | Phase 4: Backend-Endpunkte: /auth/me/notifications, /company, /finance/rent-collection |
| 2026-02-13 | Phase 4: Settings-Seite komplett auf API umgestellt (Profil, Benachrichtigungen, App-Config, Firmendaten) |
| 2026-02-13 | Phase 4: Mieteingangsquote-Chart in Finances auf API umgestellt (128 Seed-RentPayment-Records) |
| 2026-02-13 | Keine Mock-Daten mehr im gesamten Frontend (nur localStorage fuer Theme/autoSave) |
| 2026-02-14 | Docker-Deployment: Dockerfiles (Backend + Frontend), docker-compose.yml, nginx Reverse Proxy, DEPLOYMENT.md Guide |

---

## 8. Offene Fragen & Entscheidungen

- [x] ~~Welche Features soll die Immoverwaltung umfassen?~~ -> Frontend definiert Features
- [x] ~~Welcher Frontend-Stack wird verwendet?~~ -> React + TypeScript + Vite + Tailwind
- [x] ~~Web-App, Desktop-App oder beides?~~ -> Web-App
- [x] ~~Welche Backend-Technologie?~~ -> Node.js + Express + TypeScript
- [x] ~~Welche Datenbank?~~ -> PostgreSQL (Docker)
- [x] ~~Authentifizierungsmethode?~~ -> JWT (Access + Refresh Token)
- [x] ~~Multi-Tenancy Strategie?~~ -> Shared DB + companyId
- [x] ~~Frontend-Integration (Phase 2): Mock-Daten durch API-Calls ersetzen~~ -> Abgeschlossen
- [x] ~~Hosting/Deployment-Strategie?~~ -> Docker Compose (3 Container: postgres + backend + nginx-frontend), siehe DEPLOYMENT.md
- [x] ~~Phase 3: Dashboard, Finanzen, Reports auf API umstellen~~ -> Abgeschlossen
- [x] ~~Phase 4: Settings-Seite auf API umstellen, Zahlungs-Tracking (Mieteingangsquote)~~ -> Abgeschlossen

---

## 8.1 Production-Deployment Checkliste

Docker-Deployment ist eingerichtet (siehe `DEPLOYMENT.md`). Status der einzelnen Punkte:

### Erledigt durch Docker-Setup

- [x] **CORS_ORIGINS setzen** - In `.env` konfigurierbar, `.env.example` dokumentiert es. Docker-Compose uebergibt es ans Backend.
- [x] **NODE_ENV=production** - Docker-Compose setzt `NODE_ENV=production` automatisch. Morgan `combined`, Error-Handler ohne Stacks, Cookie `Secure` Flag aktiv.
- [x] **Secure + HttpOnly Cookies** - Funktioniert automatisch da `NODE_ENV=production` in Docker gesetzt.
- [x] **Reverse Proxy** - nginx im Frontend-Container leitet `/api/*` ans Backend weiter. Backend ist nicht direkt erreichbar.
- [x] **DB nicht oeffentlich erreichbar** - Port 5432 nur auf `127.0.0.1` gebunden. DB-Passwort ueber `.env` konfigurierbar.
- [x] **Backup-Strategie** - `pg_dump` Befehl in DEPLOYMENT.md dokumentiert.
- [x] **Logging in Production** - Morgan `combined` Format auf stdout. Docker faengt Logs (`docker compose logs`).

### Noch offen (je nach Einsatz)

- [ ] **HTTPS (N1)** - Docker-Setup nutzt HTTP (Port 80). Fuer oeffentliches Hosting: Caddy/Traefik als weiteren Reverse Proxy vorschalten oder nginx-Config um SSL erweitern.
- [ ] **Firewall-Regeln** - Nur relevant wenn der PC im oeffentlichen Netz steht. Fuer lokales Netzwerk reicht die Windows/Linux Firewall mit Port 80.
- [ ] **Automatisierte Backups** - Manueller `pg_dump` dokumentiert. Fuer regelmaessige Backups: Cronjob einrichten.

---

## 9. Notizen

- Frontend ist komplett auf Deutsch lokalisiert
- React Query Hooks mit automatischer Cache-Invalidierung bei Mutationen
- Seed-Daten: 5 Immobilien, 24 Einheiten, 17 Mieter, 17 Vertraege, 12 Wartungstickets, 128 Mietzahlungen
- Frontend Dev-Server laeuft auf Port 8080 (Vite Proxy leitet /api an Port 3001 weiter)
- Backend Dev-Server laeuft auf Port 3001
- Dark Mode wird unterstuetzt (next-themes)
- PostgreSQL laeuft via Docker auf Port 5432
- Login: admin@immoverwalt.de / Admin123!
- Backend starten: `cd backend && docker-compose up -d && npm run db:migrate && npm run db:seed && npm run dev`
- Frontend starten: `cd cozy-estate-central && npm install && npm run dev`
- API-Client: Automatischer Token-Refresh bei 401, Redirect zu /login bei fehlgeschlagenem Refresh
- Backend-Enums sind SCREAMING_SNAKE_CASE, Frontend zeigt deutsche Labels (Mapping in src/lib/mappings.ts)
- Alle Seiten nutzen API-Daten (Theme/autoSave-Toggle bleiben in localStorage)
