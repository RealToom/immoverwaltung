# Administration-Bereich Design

**Datum:** 2026-03-01
**Status:** Genehmigt

---

## Ziel

Einen zentralen, ADMIN-only Bereich `/administration` schaffen, der alle firmenweiten Einstellungen bündelt:
- Pro-Firma SMTP für System-E-Mails (neu)
- Benutzerverwaltung mit konfigurierbaren Custom Roles (neu)
- Bankanbindung (verschoben von `/bank`)
- DATEV-Einstellungen (verschoben aus Finanzen)
- Firmendaten + App-Config (verschoben aus Settings)

---

## Architektur

### Neue Route

```
/administration   → Administration.tsx  (ADMIN-Guard)
/users            → Redirect → /administration (Tab: mitarbeiter)
/bank             → Redirect → /administration (Tab: bank)
```

### Tabs

| Tab-Key | Label | Inhalt |
|---------|-------|--------|
| `firma` | Firma | Name, Adresse, Steuernummer, Website, Währung, Sprache, Datumsformat |
| `mitarbeiter` | Mitarbeiter | User-Tabelle + Custom Roles verwalten |
| `email` | E-Mail | SMTP-Konfiguration (neu) |
| `bank` | Bankanbindung | Bankkonten verbinden (von /bank) |
| `datev` | DATEV | Beraternummer, Mandantennummer, Konten-Mapping |

---

## 1. Custom Roles (Berechtigungssystem)

### Neues Prisma-Model `CustomRole`

```prisma
model CustomRole {
  id        Int      @id @default(autoincrement())
  companyId Int      @map("company_id")
  name      String
  pages     String[] @default([])
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  company Company  @relation(fields: [companyId], references: [id])
  users   User[]

  @@map("custom_roles")
}
```

### User-Erweiterung

```prisma
model User {
  // ... bestehende Felder ...
  customRoleId Int?       @map("custom_role_id")
  customRole   CustomRole? @relation(fields: [customRoleId], references: [id])
}
```

### Erlaubte Seiten-Keys

```typescript
export const PAGE_KEYS = [
  "dashboard",
  "properties",
  "tenants",
  "contracts",
  "finances",
  "maintenance",
  "calendar",
  "postfach",
  "anfragen",
  "vorlagen",
  "berichte",
  "notifications",
  "import",
] as const;

export type PageKey = typeof PAGE_KEYS[number];
```

### Zugriffslogik (Frontend)

```typescript
// User hat ADMIN-Rolle → immer voller Zugriff
// User hat customRoleId → nur pages[] aus CustomRole
// User hat Legacy-Rolle (VERWALTER etc.) → bisherige Logik als Fallback

function canAccess(user: User, page: PageKey): boolean {
  if (user.role === "ADMIN") return true;
  if (user.customRole) return user.customRole.pages.includes(page);
  // Legacy-Fallback
  if (user.role === "READONLY") return true; // alle Seiten lesend
  return true; // VERWALTER/BUCHHALTER — bisheriges Verhalten
}
```

### Backend-Endpunkte Custom Roles (alle ADMIN-only)

```
GET    /api/administration/roles           → alle Custom Roles der Firma
POST   /api/administration/roles           → neue Rolle anlegen
PATCH  /api/administration/roles/:id       → Name / Pages ändern
DELETE /api/administration/roles/:id       → Rolle löschen (Guard: keine User zugewiesen)
PATCH  /api/administration/users/:id/role  → customRoleId eines Users setzen
```

---

## 2. Pro-Firma SMTP

### Neues Prisma-Model `CompanySmtpSettings`

```prisma
model CompanySmtpSettings {
  id              Int     @id @default(autoincrement())
  companyId       Int     @unique @map("company_id")
  host            String
  port            Int     @default(587)
  secure          Boolean @default(false)
  user            String
  encryptedPass   String  @map("encrypted_pass")  // AES-256-GCM wie EmailAccount
  fromAddress     String  @map("from_address")
  fromName        String  @map("from_name")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id])

  @@map("company_smtp_settings")
}
```

### Backend-Endpunkte (alle ADMIN-only)

```
GET   /api/administration/smtp       → Konfiguration (Passwort nie zurückgegeben)
PUT   /api/administration/smtp       → Speichern (Passwort wird verschlüsselt)
POST  /api/administration/smtp/test  → Test-Mail an eingeloggten Admin senden
```

### Fallback-Logik in `email.service.ts`

```typescript
async function getSmtpTransport(companyId: number) {
  // 1. Firmen-SMTP aus DB
  const settings = await prisma.companySmtpSettings.findUnique({ where: { companyId } });
  if (settings) {
    return nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: decrypt(settings.encryptedPass) },
    });
  }
  // 2. Server-.env Fallback
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({ /* env-basiert wie heute */ });
}
```

Alle E-Mail-Funktionen (Passwort-Reset, Mahnung, Benachrichtigungen) rufen `getSmtpTransport(companyId)` auf.

---

## 3. Frontend-Struktur

### Neue / geänderte Dateien

```
cozy-estate-central/src/
├── pages/
│   └── Administration.tsx              (neu — Haupt-Seite mit 5 Tabs)
├── hooks/api/
│   ├── useAdminSmtp.ts                 (neu — SMTP CRUD)
│   └── useCustomRoles.ts               (neu — Roles + User-Zuweisung)
├── components/
│   └── ProtectedRoute.tsx              (erweitert — canAccess-Logik)
├── contexts/
│   └── AuthContext.tsx                 (erweitert — customRole im User-Typ)
└── lib/
    └── permissions.ts                  (neu — PAGE_KEYS + canAccess Funktion)
```

### Mitarbeiter-Tab (zwei Sektionen)

**Sektion 1 — Rollen:**
- Tabelle mit allen Custom Roles: Name + Anzahl zugewiesener User + Bearbeiten/Löschen
- "Neue Rolle"-Button → Dialog mit Namensfeld + Checkliste aller 13 Seiten

**Sektion 2 — Mitarbeiter:**
- Gleicher Inhalt wie aktuelle `Users.tsx`
- Zusätzliche Spalte "Benutzerdefinierte Rolle" mit Dropdown (Custom Roles der Firma)
- Inline-Zuweisung ohne extra Dialog

### E-Mail-Tab

- Formular: Host, Port, TLS-Toggle, Benutzername, Passwort (Show/Hide), Absender-Name, Absender-E-Mail
- "Speichern"-Button
- "Test-Mail senden"-Button → zeigt Erfolg/Fehler inline
- Hinweistext: "Wenn kein SMTP konfiguriert, wird der Server-Standard verwendet."

---

## 4. Zugriffskontrolle — Übersicht

| Rolle | Administration | /users direkt | /bank direkt |
|-------|---------------|---------------|--------------|
| ADMIN | ✅ alle Tabs | Redirect → Admin | Redirect → Admin |
| Custom Role | ❌ 403-Seite | ❌ | ❌ |
| VERWALTER | ❌ 403-Seite | ❌ | ✅ bleibt |
| BUCHHALTER | ❌ 403-Seite | ❌ | ✅ bleibt |
| READONLY | ❌ 403-Seite | ❌ | ❌ |

**Sidebar:**
- "Administration" (Shield-Icon) — nur wenn `role === "ADMIN"`
- "Benutzer"-Eintrag entfernen (konsolidiert)
- "Bankanbindung"-Eintrag: nur noch für VERWALTER+ sichtbar (nicht ADMIN, der nutzt Administration)

---

## 5. Was unverändert bleibt

- Backend `requireRole()` für API-Endpunkte — Custom Roles sind rein Frontend-seitig (Seiten-Sichtbarkeit)
- `Role`-Enum (ADMIN, VERWALTER, BUCHHALTER, READONLY) bleibt in Prisma für API-RBAC
- VERWALTER/BUCHHALTER können `/bank` weiterhin direkt aufrufen
- Bestehende Postfach-SMTP-Konfiguration (`EmailAccount`) bleibt unberührt
