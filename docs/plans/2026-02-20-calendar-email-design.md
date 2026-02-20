# Design: Kalender + E-Mail-Integration + Anfragen-Portal

**Datum:** 2026-02-20
**Status:** Genehmigt
**Ansatz:** C — IMAP-Polling mit node-cron (pragmatisch, keine neue Infrastruktur)

---

## Überblick

Drei neue Feature-Bereiche für die Immoverwaltung:

1. **Kalender** — Monatsansicht mit automatischen Ereignissen aus bestehenden Daten (Verträge, Wartung, Miete) + manuellen Terminen + KI-erkannten Terminen aus E-Mails
2. **Postfach** — IMAP/SMTP-Anbindung eigener E-Mail-Konten, Posteingang in der App, KI-gestütztes Termin-Parsing (Claude Haiku), Antworten & Dokumente senden
3. **Anfragen-Portal** — Interne Verwaltung von Interessentenanfragen (Immoscout, eBay etc.) die per E-Mail eingehen, mit Status-Tracking und Einladungs-Workflow

---

## Architektur-Entscheidung

**Ansatz C: Polling mit node-cron** (statt persistenter IMAP-Verbindung oder Redis-Queue)

- IMAP-Verbindung wird alle 5 Minuten on-demand aufgebaut, neue E-Mails in DB gecacht
- Nutzt bestehende `retention.service.ts` / node-cron-Infrastruktur
- Kein Redis, kein neuer Docker-Container
- Für Hausverwaltungs-Volumen (keine 1000 E-Mails/Minute) vollkommen ausreichend
- Bis zu 5 Min Verzögerung bei neuen E-Mails — für diesen Use-Case kein Problem

---

## Datenmodell (4 neue Prisma-Models)

### CalendarEvent
```prisma
model CalendarEvent {
  id          Int               @id @default(autoincrement())
  title       String
  description String?
  start       DateTime
  end         DateTime?
  allDay      Boolean           @default(false)
  type        CalendarEventType @default(MANUELL)
  sourceId    Int?              // Referenz auf Contract.id / MaintenanceTicket.id etc.
  color       String?           // Benutzerdefinierte Farbe (Hex)
  companyId   Int               @map("company_id")
  createdByUserId Int?          @map("created_by_user_id")
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  company     Company           @relation(...)
  @@map("calendar_events")
}

enum CalendarEventType {
  MANUELL
  AUTO_VERTRAG
  AUTO_WARTUNG
  AUTO_MIETE
  AUTO_EMAIL
}
```

### EmailAccount
```prisma
model EmailAccount {
  id                Int       @id @default(autoincrement())
  label             String    // Anzeigename z.B. "Verwaltungs-Postfach"
  email             String
  imapHost          String    @map("imap_host")
  imapPort          Int       @map("imap_port")
  imapTls           Boolean   @default(true) @map("imap_tls")
  imapUser          String    @map("imap_user")
  encryptedPassword String    @map("encrypted_password") // AES-256 via ENCRYPTION_KEY
  smtpHost          String    @map("smtp_host")
  smtpPort          Int       @map("smtp_port")
  smtpTls           Boolean   @default(true) @map("smtp_tls")
  lastSync          DateTime? @map("last_sync")
  isActive          Boolean   @default(true) @map("is_active")
  companyId         Int       @map("company_id")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  company           Company        @relation(...)
  messages          EmailMessage[]
  @@map("email_accounts")
}
```

### EmailMessage
```prisma
model EmailMessage {
  id               Int                @id @default(autoincrement())
  messageId        String             @unique @map("message_id") // IMAP UID (Duplikat-Schutz)
  fromAddress      String             @map("from_address")
  fromName         String?            @map("from_name")
  toAddress        String             @map("to_address")
  subject          String
  bodyText         String?            @map("body_text")
  bodyHtml         String?            @map("body_html")
  receivedAt       DateTime           @map("received_at")
  isRead           Boolean            @default(false) @map("is_read")
  isInquiry        Boolean            @default(false) @map("is_inquiry")   // KI: Immobilien-Anfrage erkannt
  inquiryStatus    InquiryStatus?     @map("inquiry_status")
  suggestedEventId Int?               @map("suggested_event_id")           // KI-Terminvorschlag
  emailAccountId   Int                @map("email_account_id")
  companyId        Int                @map("company_id")
  createdAt        DateTime           @default(now()) @map("created_at")

  emailAccount     EmailAccount       @relation(...)
  company          Company            @relation(...)
  attachments      EmailAttachment[]
  @@map("email_messages")
}

enum InquiryStatus {
  NEU
  IN_BEARBEITUNG
  AKZEPTIERT
  ABGELEHNT
}
```

### EmailAttachment
```prisma
model EmailAttachment {
  id             Int          @id @default(autoincrement())
  filename       String
  mimeType       String       @map("mime_type")
  size           Int
  storedPath     String?      @map("stored_path")
  emailMessageId Int          @map("email_message_id")
  companyId      Int          @map("company_id")
  createdAt      DateTime     @default(now()) @map("created_at")

  emailMessage   EmailMessage @relation(...)
  company        Company      @relation(...)
  @@map("email_attachments")
}
```

---

## Backend-API

### Kalender — `/api/calendar`
| Method | Path | Beschreibung |
|--------|------|--------------|
| GET | `/` | Alle Events: manuelle + auto-generierte aus Verträgen/Wartung/Miete |
| POST | `/` | Manuellen Termin anlegen |
| PATCH | `/:id` | Termin bearbeiten (nur MANUELL + AUTO_EMAIL) |
| DELETE | `/:id` | Termin löschen (nur MANUELL) |

**GET /api/calendar** liefert Events aus:
- `CalendarEvent` Tabelle (manuelle + KI-Vorschläge)
- Verträge mit `nextReminder` / ablaufendem `endDate`
- `MaintenanceTicket` mit `dueDate`
- `RentPayment` mit `dueDate` und Status `AUSSTEHEND`

### E-Mail-Konten — `/api/email-accounts`
| Method | Path | Beschreibung |
|--------|------|--------------|
| GET | `/` | Verbundene Postfächer |
| POST | `/` | Neues Postfach verbinden (IMAP-Test beim Speichern) |
| PATCH | `/:id` | Konfiguration bearbeiten |
| DELETE | `/:id` | Postfach trennen |
| POST | `/:id/sync` | Manueller Sync auslösen |

### E-Mail-Nachrichten — `/api/email-messages`
| Method | Path | Beschreibung |
|--------|------|--------------|
| GET | `/` | Posteingang (Filter: accountId, isRead, isInquiry) |
| GET | `/:id` | Einzelne E-Mail mit bodyHtml |
| PATCH | `/:id` | isRead setzen, inquiryStatus ändern |
| POST | `/:id/reply` | Antwort senden via SMTP |
| POST | `/:id/create-event` | KI-Terminvorschlag bestätigen → CalendarEvent anlegen |
| POST | `/:id/send-document` | Dokument aus Dokumentenverwaltung anhängen & senden |

---

## Hintergrund-Job: IMAP-Sync

**Datei:** `backend/src/services/imap-sync.service.ts`
**Cron:** Alle 5 Minuten (via bestehender node-cron in `retention.service.ts`)

**Ablauf pro Sync-Zyklus:**
1. Alle aktiven `EmailAccount`s aus DB laden
2. Pro Account: IMAP-Verbindung aufbauen (`imap-simple`)
3. Neue Nachrichten seit `lastSync` abrufen (`mailparser` für HTML/Attachments)
4. `EmailMessage` in DB speichern (`messageId` verhindert Duplikate)
5. Claude Haiku analysiert jede neue Mail:
   - Enthält die Mail einen Termin (Datum/Uhrzeit)? → `CalendarEvent` mit Status VORSCHLAG + `suggestedEventId` auf `EmailMessage`
   - Ist es eine Immobilien-Anfrage? → `isInquiry = true`
6. `lastSync` auf Account aktualisieren
7. IMAP-Verbindung schließen

**Neue npm-Pakete:**
- `imap-simple` — IMAP-Verbindung
- `mailparser` — E-Mail-Parsing (HTML → Text, Attachments)
- (`nodemailer` bereits vorhanden für SMTP)

---

## Frontend — 3 neue Seiten

### `/kalender` — Kalender-Seite
- Library: `react-big-calendar` mit deutscher Lokalisierung
- Ansichten: Monat / Woche / Tag (Tab-Umschalter)
- Farbkodierung nach Event-Typ:
  - 🔵 Blau — Manuell
  - 🟠 Orange — Vertrags-Ereignis (Kündigung, Ablauf, Mietanpassung)
  - 🔴 Rot — Wartungs-Fälligkeit
  - 🟢 Grün — Mietzahlung fällig
  - 🟣 Lila — KI-Vorschlag (unbestätigt, aus E-Mail)
- Klick auf Ereignis → Detail-Dialog
- KI-Vorschläge: zusätzlich "Bestätigen / Verwerfen"-Buttons
- "Kommende Termine"-Panel rechts (nächste 5–10 Events)
- "Neuer Termin"-Button → Formular-Dialog

### `/postfach` — Postfach-Seite
- Zwei-Spalten-Layout: E-Mail-Liste links (360px) + Detailansicht rechts
- Filter: Alle / Ungelesen / Anfragen / Postfach-Auswahl
- Aktionsleiste in Detailansicht:
  - "Antworten" → Reply-Dialog
  - "Termin erstellen" → KI-Vorschlag übernehmen oder manuell
  - "Dokument senden" → Dokument aus Dokumentenverwaltung auswählen & senden
  - "Als Anfrage markieren"
- KI-Terminvorschlag-Banner (violett) mit "Bestätigen / Verwerfen"
- Hook: `useEmailMessages` (React Query)

### `/anfragen` — Anfragen-Seite
- Gleiche Basis wie Postfach, gefiltert auf `isInquiry=true`
- Status-Tabs: Alle / Neu / In Bearbeitung / Akzeptiert / Abgelehnt
- Tabelle mit Spalten: Absender, Betreff, Immobilie (KI-erkannt), Datum, Status, Aktionen
- Status-Badges farblich: Neu=gelb, In Bearbeitung=blau, Akzeptiert=grün, Abgelehnt=rot
- Aktionen: "Öffnen" → öffnet Detailansicht, "Einladen" → Dokument + Besichtigungstermin senden

### Settings → neuer Tab "Postfächer"
- IMAP-Konfigurationsformular: Label, E-Mail, IMAP-Host/Port/TLS, Passwort, SMTP
- "Verbindung testen"-Button
- Liste verbundener Postfächer mit Letzter-Sync-Zeitstempel
- RBAC: nur ADMIN und VERWALTER dürfen Postfächer verwalten

---

## Sicherheit

- IMAP-Passwörter: AES-256 verschlüsselt mit bestehendem `ENCRYPTION_KEY`
- RBAC: Postfach-Verwaltung nur ADMIN/VERWALTER, Lesen für alle Rollen
- Rate-Limiting: `apiLimiter` auf allen neuen POST/PATCH/DELETE-Endpunkten
- AuditLog: `EMAIL_ACCOUNT_CREATED`, `EMAIL_ACCOUNT_DELETED` Events
- HTML-E-Mails: im Frontend gesandboxed (iframe mit sandbox-Attribut) → kein XSS
- Attachment-Download: nur für authentifizierte User (Bearer Token)

---

## Neue npm-Pakete

### Backend
| Paket | Zweck |
|-------|-------|
| `imap-simple` | IMAP-Verbindung und E-Mail-Abruf |
| `mailparser` | Parsen von E-Mail-Inhalten (HTML, Attachments) |

### Frontend
| Paket | Zweck |
|-------|-------|
| `react-big-calendar` | Kalender-Komponente (Monat/Woche/Tag) |
| `date-fns` | Datum-Utilities (ggf. bereits vorhanden) |

---

## Implementierungsreihenfolge (empfohlen)

1. **DB-Migration** — 4 neue Models, Prisma migrate
2. **Backend: Kalender-API** — CalendarEvent CRUD + Auto-Generierung aus bestehenden Daten
3. **Frontend: Kalender-Seite** — react-big-calendar, manuelle Termine, Auto-Events
4. **Backend: EmailAccount CRUD** — IMAP-Konfiguration speichern/testen
5. **Backend: IMAP-Sync-Job** — imap-simple + mailparser + node-cron
6. **Backend: Claude Haiku Analyse** — Termin-Erkennung + Anfragen-Erkennung
7. **Backend: E-Mail-Messages-API** — Lesen, Antworten, Dokument senden
8. **Frontend: Postfach-Seite** — Inbox, Detailansicht, KI-Banner, Reply
9. **Frontend: Anfragen-Seite** — Tabelle, Status-Workflow
10. **Frontend: Settings → Postfächer-Tab** — IMAP-Konfiguration

---

## Erfolgskriterien

- [ ] Verbundenes E-Mail-Konto empfängt neue Mails innerhalb von 5 Min in der App
- [ ] Handwerker-Mail mit Terminangabe → KI schlägt automatisch CalendarEvent vor
- [ ] Immobilien-Anfrage-Mail → wird als Anfrage erkannt und taucht in `/anfragen` auf
- [ ] Kalender zeigt alle Auto-Events aus Verträgen, Wartung, Miete korrekt an
- [ ] Dokument aus Dokumentenverwaltung kann per E-Mail an Interessenten gesendet werden
- [ ] IMAP-Passwort wird AES-256-verschlüsselt in DB gespeichert
- [ ] TypeScript kompiliert clean, alle bestehenden Tests weiterhin grün
