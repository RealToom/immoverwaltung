# Immoverwaltung - Projektdokumentation

> **Letzte Aktualisierung:** 2026-02-19
> **Status:** Nebenkostenabrechnung (F6) + ROI-Dashboard (F9) implementiert

## Roadmap / Zukünftige Features

### 1. Echte Bankanbindung (PSD2)
- Direkte Anbindung an Bankkonten via PSD2-Schnittstelle (z.B. GoCardless/Nordigen)
- Automatischer Abgleich von Mieteingängen ohne manuellen CSV-Import

### 2. KI-Belegscan (OCR) ✅ IMPLEMENTIERT
- `POST /api/finance/scan` — nimmt Bild (JPEG/PNG/WebP) oder PDF, gibt extrahierte Felder zurück
- Claude Haiku Vision auf dem Server (API-Key serverseitig, SaaS-tauglich)
- Frontend: "Neue Transaktion"-Dialog mit integriertem "Beleg scannen"-Button
- Datei wird temporär verarbeitet (uploads/scan-tmp/), sofort nach dem Scan gelöscht
- Felder: Betrag, Datum, Beschreibung, Kategorie, Typ (EINNAHME/AUSGABE)

### 3. Vermietungs-Plattform Schnittstellen
- Automatischer Export von freien Einheiten zu ImmoScout24 / eBay Kleinanzeigen
- Standard: OpenImmo / Immolab

### 4. Kalender-Synchronisation
- iCal / Google Calendar Integration für Wartungstermine und Besichtigungen
- Push-Benachrichtigungen für Termine

### 5. Automatisches Mahnwesen
- Automatischer Abgleich von Mieteingängen (Bank) mit Soll-Mieten (Vertrag)
- Generierung von Zahlungserinnerungen/Mahnungen bei Verzug

### 6. Nebenkostenabrechnung ✅ IMPLEMENTIERT
- `PATCH /api/finance/transactions/:id` — setzt `allocatable` (und optional `category`)
- `GET /api/finance/utility-statement?propertyId=X&year=Y` — Jahresabrechnung nach Wohnfläche
- Frontend: PropertyDetail → Tab "Nebenkosten" (Ausgaben markieren + Abrechnung generieren)

### 7. Mieter-Portal (App)
- Self-Service Login für Mieter
- Dokumente einsehen, Schäden melden (Tickets), Stammdaten ändern

### 8. DATEV / Steuer-Export
- Export der Finanzdaten für den Steuerberater
- Standardisierte Schnittstelle

### 9. Rendite-Dashboard (ROI) ✅ IMPLEMENTIERT
- `GET /api/finance/roi?year=Y` — Brutto-/Nettorendite + EK-Rendite pro Immobilie
- Property: `purchasePrice` + `equity` Felder im Bearbeiten-Dialog eingetragen
- Frontend: Finanzen → Tab "Rendite" (Tabelle + Portfolio-KPIs)

---

## Changelog

### 2026-02-19: Benutzerverwaltungs-Panel (Admin)

**Neue Backend-Endpunkte (`/api/users`):**
- `GET /api/users` — alle Firmen-Benutzer (ADMIN + VERWALTER)
- `POST /api/users` — Benutzer anlegen (ADMIN; Passwort-Komplexitätsprüfung)
- `PATCH /api/users/:id` — Name, Rolle, Telefon ändern (ADMIN)
- `DELETE /api/users/:id` — Benutzer löschen (ADMIN; nicht sich selbst, nicht letzter Admin)
- `POST /api/users/:id/reset-password` — zufälliges Passwort generieren + einmalig zurückgeben (ADMIN)
- `POST /api/users/:id/unlock` — Account-Sperre aufheben (ADMIN)

**Frontend:**
- Neue Seite `/users` (UsersPage) mit KPI-Kacheln, Tabelle, Dropdown-Aktionen
- Dialoge: Benutzer anlegen, bearbeiten, löschen, Passwort zurücksetzen (mit Kopier-Button), Entsperren
- Sidebar: "Benutzer"-Eintrag nur für ADMIN sichtbar (`useAuth`)
- Rollenübersicht-Karte als Hilfe für Admins

---

### 2026-02-19: Nebenkostenabrechnung (F6) + ROI-Dashboard (F9)

**Datenbankänderungen:**
- `transactions.allocatable BOOLEAN NOT NULL DEFAULT false` — Transaktion umlagefähig markieren
- `properties.purchase_price DOUBLE PRECISION` — Kaufpreis für Renditeberechnung
- `properties.equity DOUBLE PRECISION` — Eigenkapital für EK-Rendite

**Neue Backend-Endpunkte:**
- `PATCH /api/finance/transactions/:id` — `allocatable` und `category` patchen (RBAC: BUCHHALTER+)
- `GET /api/finance/utility-statement?propertyId&year` — Nebenkostenabrechnung nach Wohnfläche
- `GET /api/finance/roi?year` — Renditekennzahlen (Brutto/Netto/EK) pro Immobilie

**Frontend-Änderungen:**
- PropertyDetail → Edit-Dialog: Kaufpreis + Eigenkapital Felder
- PropertyDetail → neuer Tab "Nebenkosten": Ausgaben als umlagefähig markieren + Jahresabrechnung generieren
- Finanzen → neuer Haupt-Tab "Rendite": Portfolio-KPIs + Tabelle mit Renditen pro Objekt

---

### 2026-02-19: Ticket-System Überarbeitung (Bugfixes + vollständige Bearbeitung)

**Probleme behoben:**
1. **Status-Änderungen wurden verworfen** – `updateMaintenanceSchema` hatte kein `status`-Feld (Zod schnitt es still ab). Fix: Standalone `z.object()` ohne `.partial()`.
2. **Zod-Defaults überschrieben Felder** – `createMaintenanceSchema.partial()` erhielt Defaults für `unitLabel` und `reportedBy`, die bei PATCH unveränderte Felder mit "Allgemein" / "Hausverwaltung" überschrieben. Fix: Schema ohne Defaults neu aufgebaut.
3. **Datum-Shift (UTC-Mitternacht-Bug)** – Seed-Daten verwenden lokales Mitternacht (z.B. "2026-02-10T23:00:00Z" für 11. Feb). `toISOString().slice(0,10)` gab UTC-Datum "2026-02-10" zurück, Dialog zeigte einen Tag weniger. Fix: Lokale Datums-Komponenten (`getFullYear/Month/Date`) in `openDetail`. Speichern verwendet Mittag UTC (`T12:00:00Z`).
4. **IIFE-Pattern in JSX** – `{cond && (() => {...})()}` verursachte React-Render-Fehler. Fix: Fragment-Pattern `{cond && (<>...</>)}`.
5. **Dark Mode gebrochen** – `ThemeProvider` war innerhalb `ErrorBoundary`; bei Render-Fehler wurde Provider unmounted und die `dark`-CSS-Klasse entfernt. Fix: `ThemeProvider` in `main.tsx` außerhalb `ErrorBoundary` verschoben.

**Neue Features:**
- Alle Ticket-Felder editierbar: Titel, Beschreibung, Kategorie, Priorität, Status, Zugewiesen, Fälligkeit, Kosten, Notizen
- Löschen-Button im Detail-Dialog
- Read-only Info-Header (Immobilie, Einheit, Gemeldet von, Erstellt am) im Dialog

**Geänderte Dateien:**
- `backend/src/schemas/maintenance.schema.ts` – `updateMaintenanceSchema` neu aufgebaut
- `cozy-estate-central/src/pages/Maintenance.tsx` – vollständiges Edit-Dialog + Bugfixes
- `cozy-estate-central/src/hooks/api/useMaintenanceTickets.ts` – `useDeleteMaintenanceTicket` + `MaintenanceTicketItem` export
- `cozy-estate-central/src/main.tsx` – `ThemeProvider` außerhalb `ErrorBoundary`
- `cozy-estate-central/src/App.tsx` – `ThemeProvider` entfernt (nach main.tsx verschoben)

---

### 2026-02-18: Production-Hardening (Teil 2 - Logging, HTTPS, Rate-Limiting, Tests)

1. **Pino strukturiertes Logging**: Morgan durch Pino + pino-http ersetzt. JSON-Ausgabe fuer Production-Log-Aggregation. `LOG_LEVEL` via Env konfigurierbar. Alle `console.log/error` ersetzt.
2. **HTTPS nginx-Konfiguration**: Port 80 leitet auf HTTPS um. Port 443 mit TLS 1.2/1.3, HSTS (1 Jahr), separater SSL-Zertifikat-Volume-Mount.
3. **Globaler API Rate-Limiter**: `apiLimiter` (200 Req/min pro IP) auf allen `/api`-Routen fuer POST/PATCH/DELETE. Ergaenzt bestehenden `authLimiter`.
4. **RefreshToken-Cleanup**: Stündliche automatische Bereinigung abgelaufener RefreshTokens in `retention.service.ts`.
5. **JWT Lazy-Loading**: JWT-Secrets werden erst bei Aufruf gelesen (nicht mehr beim Modulimport) - ermoeglicht korrekte Test-Isolation.
6. **19 Backend Unit-Tests** (vitest): `errors.test.ts` (AppError-Hierarchie), `jwt.test.ts` (sign/verify), `crypto.test.ts` (encrypt/decrypt), `health.test.ts` (supertest + Prisma-Mock).
7. **9 Frontend Unit-Tests** (vitest + @testing-library): `ErrorBoundary.test.tsx`, `api.test.ts` (ApiError, fetch-Verhalten).
8. **Vitest Setup**: `backend/vitest.config.ts`, `backend/src/test/setup.ts` (Env-Vars vor Modulimport setzen).

### 2026-02-18: Production-Hardening (Teil 1)

1. **Datenbankmigrationen vervollständigt**: Neue Migration `20260218120000_phase7_bank_documents_units` deckt alle Phase-7-Änderungen ab (street/zip/city, UnitType Enum, Multi-Unit, BankAccount Tabelle, Document Felder).
2. **Document.companyId**: Direkte Multi-Tenancy-Absicherung auf Document-Ebene (war vorher Join-basiert). Migration mit automatischem Backfill. Service vereinfacht.
3. **Graceful Shutdown**: SIGTERM/SIGINT Handler in index.ts. DB-Verbindung wird sauber getrennt, laufende Requests abgewartet (10s Timeout).
4. **unhandledRejection Handler**: Server crasht nicht mehr ohne Fehlermeldung bei unbehandelten Promises.
5. **DB-Check beim Start**: Server startet nicht wenn Datenbank nicht erreichbar ist (fail-fast).
6. **nginx Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy.
7. **React Error Boundary**: Globale ErrorBoundary in main.tsx - kein weißer Bildschirm mehr bei Frontend-Fehlern.
8. **docker-compose Secrets gesichert**: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DB_PASSWORD, CORS_ORIGINS ohne Fallback-Defaults - fehlende Werte brechen den Start ab.
9. **Health-Check mit DB-Ping**: `/health` prüft jetzt aktiv die Datenbankverbindung und liefert 503 wenn DB nicht erreichbar.
10. **.env.example vervollständigt**: CORS_ORIGINS, ENCRYPTION_KEY, UPLOAD_DIR dokumentiert mit Generierungshinweisen.

### 2026-02-18: Phase 7 - Dokument-Preview, Ticket-Bearbeitung, Unit-Typen, Adress-Aufspaltung

1. **Dokument-Preview Fix**: Blob-basierter Preview mit Auth-Header (fetch + createObjectURL statt direkter URL in iframe/img). Behebt 401-Fehler bei Dokumenten-Vorschau.
2. **Wartungsticket-Bearbeitung**: Detail-Dialog hat jetzt editierbare Felder (Status, Zugewiesen an, Faelligkeitsdatum, Kosten, Notizen). Nutzt `PATCH /api/maintenance/:id`.
3. **Unit-Typen**: Neues Enum `UnitType` (WOHNUNG, GARAGE, STELLPLATZ). Mieter koennen mehrere Einheiten haben (1:n statt 1:1). Icons (Home/Car) in der Einheiten-Tabelle.
4. **Adresse aufgeteilt**: Property `address` ersetzt durch `street`, `zip`, `city`. Backend liefert berechnetes `address`-Feld fuer Kompatibilitaet. Frontend hat 3-Feld-Formulare.
5. **Seed-Daten**: 32 Einheiten (24 Wohnungen + 8 Stellplaetze/Garagen), einige Parkplaetze an bestehende Mieter zugewiesen.

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
| Logging | Pino + pino-http | 10.x / 11.x |
| Tests | vitest + supertest | 3.x / 7.x |
| File-Upload | multer | 1.x |
| E-Mail | nodemailer | 6.x |
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
│   │   ├── schema.prisma          # 12 Models + UnitType Enum mit Multi-Tenancy
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
| Wartung | `/maintenance` | API | Ticket-Liste, Erstellen-Dialog, Detail-Bearbeitung (Status/Zugewiesen/Kosten/Notizen), Prioritaeten |
| Finanzen | `/finances` | API | Einnahmen/Ausgaben-Charts, Transaktionsliste, KPIs, Zeitraum-Filter, Mieteingangsquote |
| Berichte | `/reports` | API | Belegung, Umsatz, Umsatz/qm, Wartungskosten (Charts) |
| Benachrichtigungen | `/notifications` | API | Vertrags- & Ticket-Benachrichtigungen, Filter nach Typ/Dringlichkeit |
| Bankanbindung | `/bank` | Mock/API | Bankkonten verwalten, Transaktions-Import (CSV), Kontostand-Übersicht |
| Einstellungen | `/settings` | API | Profil, E-Mail/Push-Benachrichtigungen, Theme (localStorage), App-Konfiguration, Firmendaten |

### Backend (abgeschlossen)

- [x] PostgreSQL via Docker + Prisma Schema (12 Models inkl. RentPayment + UnitType Enum)
- [x] REST-API mit Express 5
- [x] JWT-Authentifizierung (Access + Refresh Token)
- [x] CRUD fuer alle Entitaeten (Properties, Units, Tenants, Contracts, Maintenance, Documents)
- [x] Dashboard-Stats & Finance-Endpunkte
- [x] Multi-Tenancy (Shared DB + companyId)
- [x] Seed-Daten mit allen Mock-Daten aus dem Frontend
- [x] Datei-Upload (Dokumente) - multer + diskStorage, Upload/Download/Preview/Delete
- [x] E-Mail-Benachrichtigungen - nodemailer SMTP, event-basiert (Vertraege, Wartung, Finanzen)
- [x] Mieter-Dokumente - Dokumente koennen direkt an Mieter angehaengt werden (Schufa, Mietvertrag etc.)
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
- [x] Phase 7: Dokument-Preview (Blob-basiert mit Auth), Ticket-Bearbeitung, Unit-Typen, Adress-Aufspaltung

### Security-Haertung (abgeschlossen)

- [x] Rate-Limiting auf Auth-Endpunkten (max 10 Anfragen/15 Min pro IP)
- [x] Rate-Limiting auf allen Schreib-Endpunkten (`apiLimiter`: 200 Req/min pro IP)
- [x] Passwort-Komplexitaet (mind. 1 Gross-/Kleinbuchstabe + 1 Ziffer)
- [x] CORS aus Umgebungsvariable (`CORS_ORIGINS`, Fallback auf localhost)
- [x] Strukturiertes JSON-Logging mit Pino + pino-http
- [x] RBAC: `requireRole()` Middleware auf allen Schreib-Endpunkten
- [x] Account-Lockout nach 10 Fehlversuchen (30 Min Sperre)
- [x] Refresh-Token in DB mit Rotation + Revocation bei Logout + automatische Bereinigung abgelaufener Tokens
- [x] `as never` Type-Casts entfernt, typisierte Interfaces in Services

### Production-Hardening (abgeschlossen)

- [x] Datenbankmigrationen vervollstaendigt (Phase-7-Aenderungen in Migration erfasst)
- [x] `Document.companyId` - direkte Multi-Tenancy-Absicherung statt fragiler Join-Kette
- [x] Graceful Shutdown (SIGTERM/SIGINT Handler, 10s Timeout)
- [x] `unhandledRejection` / `uncaughtException` Handler - kein stiller Absturz
- [x] DB-Check beim Start (fail-fast: `SELECT 1` vor `app.listen`)
- [x] Health-Endpoint prueft aktiv DB-Verbindung (503 bei DB-Ausfall)
- [x] HTTPS in nginx konfiguriert (HTTP→HTTPS Redirect, TLS 1.2/1.3, HSTS)
- [x] nginx Security Headers (X-Content-Type-Options, X-Frame-Options, CSP, HSTS, Referrer-Policy)
- [x] React ErrorBoundary in main.tsx (kein weisser Bildschirm bei Frontend-Fehlern)
- [x] docker-compose Secrets mit `:?` Syntax (fehlende Werte brechen Start ab)
- [x] 19 Backend Unit-Tests (errors, jwt, crypto, health via vitest + supertest)
- [x] 9 Frontend Unit-Tests (ErrorBoundary, ApiError via vitest + @testing-library)

---

## 5. Datenmodell

### Property (Immobilie)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| name | String | string | Objektname |
| street | String | string | Strasse + Hausnummer |
| zip | String | string | Postleitzahl |
| city | String | string | Stadt |
| status | Enum (AKTIV, WARTUNG) | string | Objektstatus |
| companyId | Int (FK) | - | Multi-Tenancy |
| _berechnet_ | - | address | Zusammengesetzt: "street, zip city" |
| _berechnet_ | - | totalUnits | Anzahl Einheiten |
| _berechnet_ | - | occupiedUnits | Belegte Einheiten |
| _berechnet_ | - | monthlyRevenue | Monatlicher Umsatz |

### Unit (Einheit)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| number | String | string | Einheits-Nummer |
| type | Enum (WOHNUNG, GARAGE, STELLPLATZ) | string | Einheitstyp (Default: WOHNUNG) |
| floor | Int | number | Stockwerk |
| area | Float | number | Flaeche in qm |
| rent | Float | number | Monatliche Miete |
| status | Enum (RENTED, VACANT, MAINTENANCE) | string | Status |
| propertyId | Int (FK) | number | Zugehoerige Immobilie |
| tenantId | Int? (FK) | number? | Zugewiesener Mieter (nicht mehr unique → Multi-Unit) |

### Tenant (Mieter)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| name | String | string | Vollstaendiger Name |
| email | String | string | E-Mail-Adresse |
| phone | String? | string? | Telefonnummer |
| moveIn | DateTime | string (ISO) | Einzugsdatum |
| companyId | Int (FK) | - | Multi-Tenancy |
| _relation_ | - | units[].number | Einheits-Nummern (1:n, Mieter kann mehrere Units haben) |
| _relation_ | - | units[].property.name | Immobilienname (ueber Unit->Property) |

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
| propertyId | Int? (FK) | number? | Zugehoerige Immobilie |
| tenantId | Int? (FK) | number? | Zugehoeriger Mieter (Mieter-Dokumente) |
| retentionUntil | DateTime? | string? (ISO) | Aufbewahrungsfrist (DSGVO Art. 17) |
| isEncrypted | Boolean | boolean | AES-256-GCM Verschluesselung at-rest |
| companyId | Int (FK) | - | Multi-Tenancy (direkte Absicherung) |

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

### BankAccount (Bankkonto)
| Feld | Typ (DB) | API-Response | Beschreibung |
|------|----------|--------------|--------------|
| id | Int (autoincrement) | number | Eindeutige ID |
| name | String | string | Kontoname |
| iban | String | string | IBAN |
| bic | String | string | BIC |
| balance | Float | number | Aktueller Kontostand |
| status | Enum (connected, error) | string | Verbindungsstatus |
| lastSync | DateTime | string (ISO) | Letzte Synchronisation |
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
| WOHNUNG | Wohnung | Unit Type |
| GARAGE | Garage | Unit Type |
| STELLPLATZ | Stellplatz | Unit Type |

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

### Tenant Documents (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/tenants/:tenantId/documents | Dokumente eines Mieters |
| POST | /api/tenants/:tenantId/documents | Dokument fuer Mieter hochladen |

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

### Bank Accounts (geschuetzt)
| Method | Pfad | Beschreibung |
|--------|------|--------------|
| GET | /api/bank-accounts | Alle Bankkonten auflisten |
| POST | /api/bank-accounts | Bankkonto anlegen |
| DELETE | /api/bank-accounts/:id | Bankkonto loeschen |
| POST | /api/bank-accounts/:id/sync | Bankkonto synchronisieren (Mock) |
| POST | /api/bank-accounts/import | CSV-Transaktionen importieren |

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
| 2026-02-16 | Phase 6: Mieter-Dokumente (Prisma Schema + Backend-API + Frontend Detailansicht mit Upload/Preview/Download) |
| 2026-02-16 | Bankanbindung-Seite erstellt (Mock-Bankkonten, Transaktionsliste, CSV-Import, Sync-Button) |
| 2026-02-16 | Sidebar um Bankanbindung erweitert, Route /bank in App.tsx registriert |
| 2026-02-16 | Quick Actions verifiziert - alle 4 Buttons funktionieren (Properties, Tenants, Contracts, Maintenance) |
| 2026-02-16 | GDPR/DSGVO-Compliance Hinweis in Dokumentation eingefuegt |
| 2026-02-16 | DSGVO: Audit-Logging fuer alle Dokumenten-Operationen (Upload/Download/Preview/Delete) |
| 2026-02-16 | DSGVO: Einwilligungs-Checkbox im Upload-Dialog (Art. 6 Rechtsgrundlage) |
| 2026-02-16 | DSGVO: AES-256-GCM Verschluesselung at-rest fuer Dokumente (Art. 32) |
| 2026-02-16 | DSGVO: Aufbewahrungsfristen mit automatischer Loeschung (Art. 17/Art. 5) |
| 2026-02-16 | DSGVO: Verarbeitungsverzeichnis erstellt (Art. 30) - VERARBEITUNGSVERZEICHNIS.md |
| 2026-02-16 | Roadmap aktualisiert: Phase 8 (Automatiiserung) hinzugefügt |
| 2026-02-16 | Bugfix: Dark Mode Persistenz (ThemeProvider Implementation mit next-themes) |
| 2026-02-18 | Phase 7: Dokument-Preview Fix (Blob-basierter Auth-Ansatz statt direkter URL) |
| 2026-02-18 | Phase 7: Wartungsticket-Bearbeitung (Detail-Dialog mit editierbaren Feldern, PATCH-Endpoint) |
| 2026-02-18 | Phase 7: Unit-Typen (WOHNUNG/GARAGE/STELLPLATZ Enum, Multi-Unit pro Mieter) |
| 2026-02-18 | Phase 7: Adresse aufgeteilt (address -> street/zip/city, berechnetes address-Feld) |
| 2026-02-18 | Phase 7: Seed-Daten erweitert (32 Einheiten: 24 Wohnungen + 8 Stellplaetze/Garagen) |
| 2026-02-18 | Production-Hardening T1: Migrationen, Document.companyId, Graceful Shutdown, DB-Check, Security Headers, ErrorBoundary |
| 2026-02-18 | Production-Hardening T2: Pino Logging, HTTPS nginx, apiLimiter, RefreshToken-Cleanup, 28 Unit-Tests (vitest) |

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

- [x] **HTTPS** - nginx-Config mit HTTP→HTTPS Redirect (Port 80→443), TLS 1.2/1.3, HSTS. SSL-Zertifikat-Pfad via `SSL_CERT_PATH` Env-Variable (`${SSL_CERT_PATH:-./ssl}:/etc/nginx/ssl:ro`).
- [ ] **SSL-Zertifikat bereitstellen** - Zertifikat + Key unter `SSL_CERT_PATH` ablegen (z.B. Let's Encrypt via certbot). Pfade in nginx.conf: `ssl_certificate /etc/nginx/ssl/fullchain.pem`.
- [ ] **Firewall-Regeln** - Nur relevant wenn der PC im oeffentlichen Netz steht. Fuer lokales Netzwerk reicht die Windows/Linux Firewall mit Port 80/443.
- [ ] **Automatisierte Backups** - Manueller `pg_dump` dokumentiert. Fuer regelmaessige Backups: Cronjob einrichten.

---

## 8.2 Datenschutz (GDPR/DSGVO)

Das gesamte Projekt muss sich an die Richtlinien von [https://gdpr.eu/](https://gdpr.eu/) halten. Dies ist bei der Weiterentwicklung und Dokumentation zwingend zu beachten.

---

## 9. Notizen

- Frontend ist komplett auf Deutsch lokalisiert
- React Query Hooks mit automatischer Cache-Invalidierung bei Mutationen
- Seed-Daten: 5 Immobilien, 32 Einheiten (24 Wohnungen + 8 Garagen/Stellplaetze), 17 Mieter, 17 Vertraege, 12 Wartungstickets, 128 Mietzahlungen
- Frontend Dev-Server laeuft auf Port 8080 (Vite Proxy leitet /api an Port 3001 weiter)
- Backend Dev-Server laeuft auf Port 3001
- Dark Mode wird unterstuetzt (next-themes)
- PostgreSQL laeuft via Docker auf Port 5432
- Login: admin@immoverwalt.de / Admin123!
- Backend starten: `cd backend && docker-compose up -d && npm run db:migrate && npm run db:seed && npm run dev`
- Frontend starten: `cd cozy-estate-central && npm install && npm run dev`
- Backend Tests: `cd backend && npm test` (19 Tests in 4 Suites)
- Frontend Tests: `cd cozy-estate-central && npm test` (9 Tests in 2 Suites)
- Backend Test-Coverage: `cd backend && npm run test:coverage`
- API-Client: Automatischer Token-Refresh bei 401, Redirect zu /login bei fehlgeschlagenem Refresh
- Backend-Enums sind SCREAMING_SNAKE_CASE, Frontend zeigt deutsche Labels (Mapping in src/lib/mappings.ts)
- Alle Seiten nutzen API-Daten (Theme/autoSave-Toggle bleiben in localStorage)
