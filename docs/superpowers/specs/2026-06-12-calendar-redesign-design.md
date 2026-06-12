# Kalender-Redesign — Design-Spec

**Datum:** 2026-06-12
**Status:** Vom User freigegeben (Layout A, react-big-calendar als Basis, einfache Wiederholungs-Presets, Erinnerungen per E-Mail + In-App)

## Ziel

Den bestehenden Kalender (`cozy-estate-central/src/pages/Calendar.tsx` + `backend/src/services/calendar.service.ts`) zu einem vollwertigen, modernen Terminwerkzeug ausbauen: bessere Optik und Bedienung, fehlende Grundfunktionen (Bearbeiten/Löschen im UI), wiederkehrende Termine, Erinnerungen und echte Datenverknüpfungen.

**Nicht im Scope (bewusst):** Team-Zuweisungen, Ausnahmen pro Wiederholungs-Instanz, externer Kalender-Sync über das vorhandene iCal hinaus, Push-Notifications (nur E-Mail + In-App), Umbau der bestehenden Notifications-Seite.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Layout | A — Vollbild-Kalender, Filter-Chips in Toolbar, Agenda als Ansicht + Drawer |
| Tech-Basis | react-big-calendar behalten, Optik via Custom Components + CSS |
| Wiederholungen | Einfache Presets (täglich/wöchentlich/monatlich/jährlich + Intervall + Enddatum) |
| Erinnerungen | E-Mail + In-App (Glocke), Presets 1h/1d/3d/1w vorher |

## 1. Datenmodell (Prisma-Migration)

### CalendarEvent — neue Felder

```prisma
// Wiederholung (einfache Presets, server-seitig expandiert)
recurrenceFreq     RecurrenceFreq?  // TAEGLICH | WOECHENTLICH | MONATLICH | JAEHRLICH
recurrenceInterval Int              @default(1)
recurrenceUntil    DateTime?        // exklusive Obergrenze; null = max. Horizont (2 Jahre ab start)

// Erinnerung
reminderMinutes    Int?             // null = keine Erinnerung; Presets: 60, 1440, 4320, 10080
reminderSentFor    DateTime?        // start der Occurrence, für die zuletzt erinnert wurde (Dedupe)

// Echte Verknüpfungen
propertyId         Int?             // FK -> Property (onDelete: SetNull)
tenantId           Int?             // FK -> Tenant (onDelete: SetNull)
visitorName        String?          // Besichtigung: Interessent
visitorContact     String?          // Besichtigung: Telefon/E-Mail
```

Bestehende Besichtigungs-Daten im `description`-String bleiben unangetastet; das Frontend behält den Fallback-Parser für Alt-Termine. Neue Termine nutzen die echten Spalten.

### Notification — neues Modell

```prisma
model Notification {
  id        Int       @id @default(autoincrement())
  companyId Int       // Multi-Tenancy-Pflichtfeld
  userId    Int       // Empfänger
  type      String    // z.B. "TERMIN_ERINNERUNG"
  title     String
  body      String?
  link      String?   // Frontend-Route, z.B. "/calendar"
  readAt    DateTime?
  createdAt DateTime  @default(now())
  // Relations: company, user (onDelete: Cascade)
  @@index([userId, readAt])
}
```

## 2. Backend

### calendar.service.ts

- **`expandRecurrence(event, from, to)`** (pure Funktion, exportiert für Tests): liefert Occurrence-Starts eines wiederkehrenden Events im Fenster. Datumsarithmetik mit date-fns (addDays/addWeeks/addMonths/addYears — Monatsende-Verhalten von date-fns wird akzeptiert: 31.01. + 1 Monat = 28.02.). Harter Horizont: max. 2 Jahre ab `event.start`, max. 500 Instanzen.
- **`listEvents`**: expandiert wiederkehrende Events im from/to-Fenster zu virtuellen Instanzen mit `id: "evt-<dbId>-<ISO-Datum>"`, `seriesId: <dbId>`, Dauer = Dauer des Originals. Einmalige Events und Auto-Events unverändert.
- **create/update**: nehmen die neuen Felder entgegen (Zod-Schema erweitert: recurrenceFreq-Enum, recurrenceInterval 1-99, reminderMinutes aus Preset-Liste, propertyId/tenantId positive Ints). `update`/`delete` auf eine virtuelle Instanz-ID ist nicht möglich — das Frontend schickt immer die `seriesId` (Bearbeiten/Löschen wirkt auf die Serie; der Dialog sagt das klar an).
- **Ownership-Validierung**: propertyId/tenantId müssen zur companyId gehören (sonst 404), wie bei `assignEmail`.

### reminder.service.ts (neu)

- `startReminderScheduler()` / `stopReminderScheduler()` nach dem Muster von `retention.service.ts`; Aufruf in `index.ts` beim Start/Shutdown. Intervall: 5 Minuten.
- Logik pro Lauf: alle CalendarEvents mit `reminderMinutes != null` laden (nur Typen MANUELL/BESICHTIGUNG). Für einmalige Events: fällig wenn `start - reminderMinutes <= now < start` und `reminderSentFor != start`. Für wiederkehrende: nächste Occurrence via `expandRecurrence(now, now + reminderMinutes)` bestimmen, gleiche Dedupe-Regel gegen `reminderSentFor`.
- Bei Fälligkeit: `Notification` für `createdByUserId` anlegen (Fallback: ältester ADMIN der Firma, falls Ersteller gelöscht) **und** E-Mail über `sendMailForCompany` (Misserfolg = Warn-Log, Notification bleibt). Danach `reminderSentFor` setzen.
- Die Fälligkeitsprüfung ist eine pure, exportierte Funktion (`isReminderDue(event, now)`) für Unit-Tests.

### notification.service/controller/routes (neu)

- `GET /api/notifications?unread=true` → `{ data, meta: { unreadCount } }` (max. 50, neueste zuerst)
- `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
- Alle hinter `requireAuth + tenantGuard + subscriptionGuard` (einheitlich wie alle anderen Fach-Routen), gefiltert auf `userId = req.userId` — Notifications sind persönlich, kein User sieht fremde Einträge.

## 3. Frontend (cozy-estate-central)

### Calendar.tsx — Layout A

- **Toolbar:** ‹ › Heute | Zeitraum-Titel | Typ-Filter-Chips (Manuell, Vertrag, Wartung, Miete, E-Mail, Besichtigung — klickbar, Zustand in localStorage `calendarTypeFilters`) | Suchfeld (filtert Titel client-seitig) | Ansicht Monat/Woche/Tag/Agenda | iCal | + Termin.
- **Kalender-Optik:** Custom `components.event` (Pill: Typ-Icon + Uhrzeit + Titel, Serie-Indikator ↻), Custom Date-Header, `popup` für Overflow („+n weitere"), Heute-Hervorhebung. Alle rbc-Farb-Overrides über CSS-Variablen in `index.css` → funktioniert im Dark Mode. Die feste „Kommende Termine"-Spalte entfällt.
- **Agenda-Ansicht:** eigene Komponente (`CalendarAgenda.tsx`), nach Tagen gruppiert, mit Uhrzeit/ganztägig, Typ-Badge, Objekt-/Personen-Kontext, Klick öffnet Detail. Zusätzlich als Drawer (Sheet) aus der Toolbar.
- **Detail-Dialog:** Für MANUELL/BESICHTIGUNG: Bearbeiten (öffnet Termin-Dialog vorbefüllt) + Löschen (mit Confirm; bei Serie Hinweis „löscht die ganze Serie"). Für Auto-Events: Deep-Link-Button (Wartung → `/maintenance`, Miete → `/finances`, Vertrag → `/contracts`, E-Mail → `/postfach`). Zeigt Wiederholung, Erinnerung, verknüpftes Objekt/Mieter.
- **Termin-Dialog (neu/bearbeiten):** Titel, Typ, Datum/Uhrzeit, Dauer (bestehende Abendtermin-Logik bleibt), Wiederholung-Select (Keine/Täglich/Wöchentlich/Monatlich/Jährlich + Intervall + Bis-Datum), Erinnerung-Select (Keine/1h/1d/3d/1w), Objekt-Dropdown (useProperties), Mieter-Dropdown (useTenants, optional), bei Besichtigung: visitorName/visitorContact als echte Felder, Notizen (description).

### Glocke (NotificationBell.tsx)

- In der Sidebar/Header-Leiste: Bell-Icon mit Unread-Badge, Popover mit Liste (Titel, Zeit, Link), „Alle gelesen". Polling via React Query `refetchInterval: 60s`. Neuer Hook `useNotifications.ts`.

### Hooks

- `useCalendarEvents.ts`: Typen um neue Felder erweitern, `useDeleteCalendarEvent` ergänzen (fehlt bisher).

## 4. Fehlerbehandlung

- Serien-Instanz bearbeiten/löschen → Frontend mappt auf seriesId, Backend lehnt String-IDs der Auto-Events weiter mit 403 ab.
- Scheduler-Fehler werden geloggt und brechen den Intervall-Loop nicht ab (try/catch pro Lauf, wie Retention).
- E-Mail-Versand ohne SMTP: Warn-Log, In-App-Notification entsteht trotzdem.

## 5. Tests

- **Unit (Backend):** `expandRecurrence` (alle Frequenzen, Intervall, Until, Horizont-Kappung, Fenster-Schnitt), `isReminderDue` (einmalig + wiederkehrend + Dedupe), Notification-Routen (Ownership: User sieht nur eigene), Zod-Schema-Validierung der neuen Felder.
- **tsc** über Backend + Frontend; bestehende Suiten bleiben grün.
- **Manuell:** Termin mit Wiederholung+Erinnerung anlegen, Drag&Drop, Filter, Agenda, Dark Mode, Glocke.

## 6. Migrationshinweis

Wegen der Drift in der lokalen Dev-DB: Migration manuell unter `prisma/migrations/<timestamp>_calendar_recurrence_reminders/migration.sql` anlegen und mit `prisma migrate deploy` + `prisma generate` anwenden (siehe Projekt-Memory).
