# Mieter-Portal (Tenant Portal) — Design Spec

**Datum:** 2026-04-01
**Status:** Approved
**Roadmap-Referenz:** Projektdokumentation Punkt 7

---

## Zusammenfassung

PWA (Progressive Web App) als eigenständiges Vite/React-Projekt (`tenant-portal/`) im bestehenden Repo. Mieter erhalten per E-Mail-Einladung Zugang zu ihrem persönlichen Portal. Das Portal ist White-Label: jede Hausverwaltungsfirma hat eigenes Branding (Logo, Farbe), gesteuert über einen Company-Slug in der URL.

---

## Projekt-Setup

- **Verzeichnis:** `tenant-portal/` im Repo-Root
- **Stack:** Vite + React 18 + TypeScript + Tailwind CSS + Shadcn/UI
- **PWA:** `vite-plugin-pwa` — Manifest, Service Worker, installierbar
- **Offline:** Statische Assets gecacht, Offline-Fallback-Seite
- **URL-Muster:** `/:companySlug/*` — lädt beim Start Branding via API

---

## URL-Struktur

| Route | Seite |
|-------|-------|
| `/:slug/login` | Login |
| `/:slug/invite/:token` | Einladung annehmen / Passwort setzen |
| `/:slug/dashboard` | Dashboard (nach Login) |
| `/:slug/documents` | Dokumente |
| `/:slug/documents/sign/:id` | Dokument unterschreiben |
| `/:slug/documents/upload` | Dokument hochladen |
| `/:slug/tickets` | Tickets |
| `/:slug/tickets/new` | Neues Ticket / Schaden melden |
| `/:slug/finances` | Miethistorie & Finanzen |
| `/:slug/messages` | Nachrichten |
| `/:slug/profile` | Profil / Stammdaten |

---

## Datenmodell (Backend)

### Neues Prisma-Modell: `TenantUser`

```prisma
model TenantUser {
  id               Int       @id @default(autoincrement())
  email            String
  passwordHash     String
  tenantId         Int
  companyId        Int
  inviteToken      String?
  inviteExpiresAt  DateTime?
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  tenant   Tenant  @relation(fields: [tenantId], references: [id])
  company  Company @relation(fields: [companyId], references: [id])

  @@unique([email, companyId])
}
```

### Neues Prisma-Modell: `TenantMessage`

```prisma
model TenantMessage {
  id           Int      @id @default(autoincrement())
  companyId    Int
  tenantUserId Int
  direction    MessageDirection  // TENANT_TO_ADMIN | ADMIN_TO_TENANT
  body         String
  createdAt    DateTime @default(now())
  readAt       DateTime?
}
```

### Neues Prisma-Modell: `TenantDocument` (Uploads vom Mieter)

```prisma
model TenantDocument {
  id           Int      @id @default(autoincrement())
  companyId    Int
  tenantUserId Int
  filename     String
  mimeType     String
  sizeBytes    Int
  category     String
  description  String?
  storagePath  String
  createdAt    DateTime @default(now())
}
```

### Erweiterung: `Company`

Bestehendes `Company`-Modell bekommt neues Pflichtfeld:
- `slug String @unique` — URL-sicherer Bezeichner (z.B. `mustermann-hv`), wird bei Firmenerstellung gesetzt
- `logoUrl String?` — öffentlich zugängliche URL für das Firmenlogo
- `primaryColor String @default("#2563eb")` — Hex-Farbe für White-Label

### Erweiterung: `Document` (Signatur-Anfragen vom Verwalter)

Bestehende `Document`-Tabelle bekommt neue Felder:
- `requiresSignature Boolean @default(false)`
- `signatureType SignatureType?` — `SIMPLE | SIGNATURE_PAD`
- `signedAt DateTime?`
- `signedByTenantUserId Int?`
- `signatureData String?` — Base64 SVG/PNG bei SIGNATURE_PAD

---

## Backend-API

### Auth (`/api/tenant/auth/`)

| Method | Path | Beschreibung | Auth |
|--------|------|-------------|------|
| `POST` | `/login` | E-Mail + Passwort → Access Token (15min) + Refresh Cookie (7d) | — |
| `POST` | `/refresh` | Refresh Token rotieren | Cookie |
| `POST` | `/logout` | Refresh Token invalidieren | JWT |
| `POST` | `/accept-invite` | `{ token, password }` → Account aktivieren | — |

JWT-Payload: `{ tenantUserId, tenantId, companyId, role: 'TENANT' }`

### Branding (public)

| Method | Path | Beschreibung |
|--------|------|-------------|
| `GET` | `/api/tenant/company/:slug` | `{ name, logoUrl, primaryColor, slug }` |

### Mieter-Daten (`/api/tenant/` — TENANT JWT required)

| Method | Path | Beschreibung |
|--------|------|-------------|
| `GET` | `/me` | Stammdaten + aktive Units |
| `PATCH` | `/me` | Telefon / E-Mail ändern |
| `GET` | `/documents` | Alle Dokumente (vom Verwalter) inkl. Signatur-Status |
| `POST` | `/documents/:id/sign` | Dokument unterschreiben (`{ type: 'SIMPLE' \| 'SIGNATURE_PAD', signatureData? }`) |
| `GET` | `/uploads` | Vom Mieter hochgeladene Dokumente |
| `POST` | `/uploads` | Dokument hochladen (multipart/form-data) |
| `GET` | `/tickets` | Eigene Tickets |
| `POST` | `/tickets` | Neues Ticket (`title`, `description`, `category`, optional `photo`) |
| `GET` | `/finances` | Mietzahlungen + offene Beträge |
| `GET` | `/messages` | Nachrichtenverlauf |
| `POST` | `/messages` | Neue Nachricht senden |

### Admin-Erweiterungen

| Method | Path | Beschreibung | Rolle |
|--------|------|-------------|-------|
| `POST` | `/api/tenants/:id/invite` | Einladungs-E-Mail senden (generiert Token) | VERWALTER+ |
| `POST` | `/api/messages/tenant/:tenantUserId` | Antwort an Mieter senden | VERWALTER+ |

---

## Frontend-Architektur (`tenant-portal/`)

### Verzeichnisstruktur

```
tenant-portal/
├── public/
│   ├── manifest.json        # PWA Manifest
│   └── icons/               # 192px, 512px Icons
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Router mit /:slug Prefix
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Access Token (memory), Refresh (cookie)
│   │   └── BrandingContext.tsx
│   ├── hooks/
│   │   ├── useBranding.ts   # Lädt company/:slug beim Start
│   │   ├── useAuth.ts
│   │   └── api/             # React Query Hooks
│   ├── lib/
│   │   └── api.ts           # Fetch-Client mit Auto-Refresh bei 401
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── AcceptInvite.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Documents.tsx
│   │   ├── SignDocument.tsx
│   │   ├── UploadDocument.tsx
│   │   ├── Tickets.tsx
│   │   ├── NewTicket.tsx
│   │   ├── Finances.tsx
│   │   ├── Messages.tsx
│   │   └── Profile.tsx
│   └── components/
│       ├── BottomNav.tsx    # SVG-Icons, kein Emoji
│       ├── ProtectedRoute.tsx
│       └── ui/              # Shadcn/UI Komponenten
├── vite.config.ts           # vite-plugin-pwa konfiguriert
└── package.json
```

### White-Label

- `useBranding()` Hook: beim App-Start `GET /api/tenant/company/:slug` aufrufen
- CSS-Variablen: `--color-primary`, `--color-primary-foreground` per JS gesetzt
- Logo-URL im Header anzeigen, Firmenname im `<title>` und Login-Screen
- Fallback: Mustermann-Branding als Platzhalter

### Auth-Flow

1. Verwalter klickt "Einladung senden" in `Tenants.tsx` → `POST /api/tenants/:id/invite`
2. Backend generiert `inviteToken` (UUID, 7d gültig), sendet E-Mail mit Link
3. Link öffnet `/:slug/invite/:token` → Mieter setzt Passwort
4. Mieter kann sich nun einloggen → JWT mit `role: TENANT`
5. Access Token im Memory, Refresh Token als httpOnly Cookie
6. `ProtectedRoute` + automatischer Token-Refresh bei 401

### Signatur-Flow

- Verwalter markiert Dokument als `requiresSignature: true` + wählt Typ
- Mieter sieht im Dokumente-Screen "Zur Unterschrift ausstehend"-Banner
- Tippen öffnet `SignDocument.tsx`:
  - **SIMPLE:** PDF-Vorschau + Checkbox-Zustimmung → `POST /api/tenant/documents/:id/sign { type: 'SIMPLE' }`
  - **SIGNATURE_PAD:** Zeichenfläche (Canvas) → Base64-PNG → `POST .../sign { type: 'SIGNATURE_PAD', signatureData }`
- Backend speichert `signedAt`, `signedByTenantUserId`, optional `signatureData`

### PWA

- `manifest.json`: Name, Icons, `theme_color` aus Company-Branding dynamisch generiert
- Service Worker (Workbox via vite-plugin-pwa): Cache-First für Assets, Network-First für API
- Offline-Fallback-Seite: "Keine Verbindung — bitte prüfen Sie Ihre Internetverbindung"

---

## Screens (visuell approved)

1. Login
2. Einladung annehmen (Passwort setzen)
3. Dashboard (Hero-Card, Quick Actions, Tickets, letzte Zahlung)
4. Dokumente (Signatur-Banner, Upload-Button, Dokumentenliste)
5. Tickets (Filterliste + FAB)
6. Finanzen (Nächste Miete + Zahlungshistorie)
7. Nachrichten (Chat-UI)
8. Profil (Stammdaten, Sicherheit, Abmelden)
9. Unterschreiben — Einfach
10. Unterschreiben — Signatur-Pad
11. Dokument hochladen

---

## Sicherheit

- Separate JWT-Signatur-Keys für TENANT vs. ADMIN (kein Cross-Role-Zugriff möglich)
- Alle `/api/tenant/`-Routen prüfen `role === 'TENANT'` + `companyId` aus JWT
- Dokumente werden nach `companyId` + `tenantId` gefiltert (kein Cross-Tenant-Zugriff)
- Upload: Magic-Bytes-Prüfung (wie im bestehenden Backend), max. 10 MB
- Invite-Token: Single-use, 7 Tage TTL, nach Verwendung invalidiert

---

## Nicht im Scope

- Native Mobile App (iOS/Android)
- Push-Benachrichtigungen (kann später via Web Push API ergänzt werden)
- Zahlungs-Integration (Mietzahlungen werden nur angezeigt, nicht ausgelöst)
- Mehrsprachigkeit
