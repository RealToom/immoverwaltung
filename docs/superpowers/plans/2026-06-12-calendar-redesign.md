# Kalender-Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Kalender zu einem vollwertigen Terminwerkzeug ausbauen: wiederkehrende Termine, E-Mail+In-App-Erinnerungen, echte Objekt/Mieter-Verknüpfungen, Bearbeiten/Löschen im UI und eine komplett neue Optik (Layout A: Vollbild + Filter-Chips + Agenda).

**Architecture:** Backend expandiert Wiederholungen server-seitig zu virtuellen Instanzen (pure Funktion in `lib/recurrence.ts`, ohne date-fns — backend hat es nicht als Dependency). Ein In-Process-Scheduler (Muster: `retention.service.ts`) erzeugt Notifications + E-Mails. Frontend behält react-big-calendar, ersetzt aber alle sichtbaren Teile durch Custom Components; neue Komponenten unter `src/components/calendar/`.

**Tech Stack:** Express 5 + Prisma 6 + Zod (Backend), React 18 + react-big-calendar + shadcn/ui + React Query (Frontend), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-calendar-redesign-design.md`

**Umgebungshinweise (wichtig, siehe Projekt-Memory):**
- Tests immer mit `npx vitest run <files> --pool=forks --no-file-parallelism --testTimeout=120000` ausführen (Google-Drive-Laufwerk).
- Dev-DB hat Drift → Migration NICHT mit `prisma migrate dev` anlegen, sondern SQL-Datei manuell schreiben und `npx prisma migrate deploy && npx prisma generate` ausführen. DB-Container: `docker start immoverwaltung-db`.
- Niemals `Get-Content | Set-Content` für Suchen/Ersetzen (zerstört Umlaute) — immer Edit-Tool.

## Dateiübersicht

| Datei | Aktion | Verantwortung |
|---|---|---|
| `backend/prisma/schema.prisma` | Modify | CalendarEvent-Felder, RecurrenceFreq-Enum, Notification-Modell, Back-Relations |
| `backend/prisma/migrations/20260612120000_calendar_recurrence_reminders/migration.sql` | Create | DDL |
| `backend/src/lib/recurrence.ts` | Create | Pure Recurrence-Expansion (testbar, ohne Abhängigkeiten) |
| `backend/src/schemas/calendar.schema.ts` | Modify | Neue Felder validieren |
| `backend/src/services/calendar.service.ts` | Modify | Expansion in listEvents, neue Felder in create/update, Ownership-Checks |
| `backend/src/services/notification.service.ts` | Create | Notification CRUD (companyId+userId-gescoped) |
| `backend/src/controllers/notification.controller.ts` | Create | HTTP-Handler |
| `backend/src/routes/notification.routes.ts` | Create | Routen |
| `backend/src/routes/index.ts` | Modify | Mount /notifications |
| `backend/src/services/reminder.service.ts` | Create | Fälligkeitslogik + Scheduler |
| `backend/src/index.ts` | Modify | Scheduler starten/stoppen |
| `backend/src/test/recurrence.test.ts` | Create | Tests Expansion |
| `backend/src/test/reminder.service.test.ts` | Create | Tests Fälligkeit |
| `backend/src/test/calendar-api.test.ts` | Create | Tests Schema + listEvents-Expansion + Notification-Scoping |
| `cozy-estate-central/src/hooks/api/useCalendarEvents.ts` | Modify | Neue Felder im Typ |
| `cozy-estate-central/src/hooks/api/useNotifications.ts` | Create | Glocken-API |
| `cozy-estate-central/src/components/NotificationBell.tsx` | Create | Glocke mit Badge + Popover |
| `cozy-estate-central/src/components/AppSidebar.tsx` | Modify | Glocke einbauen |
| `cozy-estate-central/src/components/calendar/calendar-theme.css` | Create | rbc-Theme über CSS-Variablen (dark-mode-fähig) |
| `cozy-estate-central/src/components/calendar/eventMeta.ts` | Create | Farben/Labels/Icons pro Typ (eine Quelle) |
| `cozy-estate-central/src/components/calendar/EventPill.tsx` | Create | Custom Event-Darstellung |
| `cozy-estate-central/src/components/calendar/CalendarToolbar.tsx` | Create | Navigation, Filter-Chips, Suche, Ansichten, Aktionen |
| `cozy-estate-central/src/components/calendar/CalendarAgenda.tsx` | Create | Nach Tagen gruppierte Liste |
| `cozy-estate-central/src/components/calendar/EventDialog.tsx` | Create | Anlegen/Bearbeiten mit allen Feldern |
| `cozy-estate-central/src/components/calendar/EventDetailDialog.tsx` | Create | Detail + Bearbeiten/Löschen/Deep-Links |
| `cozy-estate-central/src/pages/Calendar.tsx` | Modify | Komposition (deutlich schlanker als heute) |

---

### Task 1: Prisma-Schema + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260612120000_calendar_recurrence_reminders/migration.sql`

- [ ] **Step 1: Schema erweitern**

In `backend/prisma/schema.prisma` das Modell `CalendarEvent` (Zeile ~758) ersetzen durch:

```prisma
model CalendarEvent {
  id              Int               @id @default(autoincrement())
  title           String
  description     String?
  start           DateTime
  end             DateTime?
  allDay          Boolean           @default(false) @map("all_day")
  type            CalendarEventType @default(MANUELL)
  sourceId        Int?              @map("source_id")
  color           String?
  companyId       Int               @map("company_id")
  createdByUserId Int?              @map("created_by_user_id")
  // Wiederholung (einfache Presets, server-seitig expandiert)
  recurrenceFreq     RecurrenceFreq? @map("recurrence_freq")
  recurrenceInterval Int             @default(1) @map("recurrence_interval")
  recurrenceUntil    DateTime?       @map("recurrence_until")
  // Erinnerung
  reminderMinutes Int?      @map("reminder_minutes")
  reminderSentFor DateTime? @map("reminder_sent_for")
  // Verknüpfungen
  propertyId     Int?    @map("property_id")
  tenantId       Int?    @map("tenant_id")
  visitorName    String? @map("visitor_name")
  visitorContact String? @map("visitor_contact")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  company  Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  property Property? @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  tenant   Tenant?   @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@map("calendar_events")
}

enum RecurrenceFreq {
  TAEGLICH
  WOECHENTLICH
  MONATLICH
  JAEHRLICH
}

model Notification {
  id        Int       @id @default(autoincrement())
  companyId Int       @map("company_id")
  userId    Int       @map("user_id")
  type      String
  title     String
  body      String?
  link      String?
  readAt    DateTime? @map("read_at")
  createdAt DateTime  @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@map("notifications")
}
```

Zusätzlich Back-Relations ergänzen (jeweils eine Zeile im bestehenden Modell):
- `model Property`: `calendarEvents CalendarEvent[]`
- `model Tenant`: `calendarEvents CalendarEvent[]`
- `model Company`: `notifications Notification[]`
- `model User`: `notifications Notification[]`

- [ ] **Step 2: Migrations-SQL schreiben**

`backend/prisma/migrations/20260612120000_calendar_recurrence_reminders/migration.sql`:

```sql
-- Recurrence + reminders + entity links for calendar events; notifications table
CREATE TYPE "RecurrenceFreq" AS ENUM ('TAEGLICH', 'WOECHENTLICH', 'MONATLICH', 'JAEHRLICH');

ALTER TABLE "calendar_events"
  ADD COLUMN "recurrence_freq" "RecurrenceFreq",
  ADD COLUMN "recurrence_interval" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "recurrence_until" TIMESTAMP(3),
  ADD COLUMN "reminder_minutes" INTEGER,
  ADD COLUMN "reminder_sent_for" TIMESTAMP(3),
  ADD COLUMN "property_id" INTEGER,
  ADD COLUMN "tenant_id" INTEGER,
  ADD COLUMN "visitor_name" TEXT,
  ADD COLUMN "visitor_contact" TEXT;

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notifications" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Migration anwenden + Client generieren**

Run: `cd backend; docker start immoverwaltung-db; npx prisma migrate deploy; npx prisma generate`
Expected: `1 migration applied` + `Generated Prisma Client`. (NICHT `migrate dev` — Dev-DB hat Drift.)

- [ ] **Step 4: tsc prüfen**

Run: `cd backend; npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260612120000_calendar_recurrence_reminders
git commit -m "feat(calendar): schema for recurrence, reminders, entity links, notifications"
```

---

### Task 2: Recurrence-Engine (TDD)

**Files:**
- Create: `backend/src/lib/recurrence.ts`
- Test: `backend/src/test/recurrence.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

`backend/src/test/recurrence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { expandRecurrence, nthOccurrence } from "../lib/recurrence.js";

const d = (s: string) => new Date(s);

describe("nthOccurrence", () => {
  it("TAEGLICH mit Intervall 1", () => {
    expect(nthOccurrence(d("2026-06-01T10:00:00Z"), "TAEGLICH", 1, 3)).toEqual(d("2026-06-04T10:00:00Z"));
  });

  it("WOECHENTLICH mit Intervall 2", () => {
    expect(nthOccurrence(d("2026-06-01T10:00:00Z"), "WOECHENTLICH", 2, 2)).toEqual(d("2026-06-29T10:00:00Z"));
  });

  it("MONATLICH klemmt Monatsende (31.01. -> 28.02. -> 31.03.)", () => {
    const start = d("2026-01-31T09:00:00Z");
    expect(nthOccurrence(start, "MONATLICH", 1, 1).getUTCDate()).toBe(28);
    expect(nthOccurrence(start, "MONATLICH", 1, 2).getUTCDate()).toBe(31);
  });

  it("JAEHRLICH klemmt 29.02. in Nicht-Schaltjahren", () => {
    const start = d("2024-02-29T09:00:00Z");
    expect(nthOccurrence(start, "JAEHRLICH", 1, 1).getUTCDate()).toBe(28);
    expect(nthOccurrence(start, "JAEHRLICH", 1, 4).getUTCDate()).toBe(29); // 2028 wieder Schaltjahr
  });
});

describe("expandRecurrence", () => {
  const weekly = {
    start: d("2026-06-01T10:00:00Z"),
    recurrenceFreq: "WOECHENTLICH" as const,
    recurrenceInterval: 1,
    recurrenceUntil: null,
  };

  it("liefert Occurrences im Fenster", () => {
    const occs = expandRecurrence(weekly, d("2026-06-01T00:00:00Z"), d("2026-06-30T23:59:59Z"));
    expect(occs).toHaveLength(5); // 01., 08., 15., 22., 29.
    expect(occs[0]).toEqual(d("2026-06-01T10:00:00Z"));
    expect(occs[4]).toEqual(d("2026-06-29T10:00:00Z"));
  });

  it("schneidet das Fenster korrekt (from mitten in der Serie)", () => {
    const occs = expandRecurrence(weekly, d("2026-06-10T00:00:00Z"), d("2026-06-30T23:59:59Z"));
    expect(occs.map((o) => o.getUTCDate())).toEqual([15, 22, 29]);
  });

  it("respektiert recurrenceUntil (inklusiv)", () => {
    const e = { ...weekly, recurrenceUntil: d("2026-06-15T10:00:00Z") };
    const occs = expandRecurrence(e, d("2026-06-01T00:00:00Z"), d("2026-12-31T00:00:00Z"));
    expect(occs).toHaveLength(3); // 01., 08., 15.
  });

  it("kappt am 2-Jahres-Horizont", () => {
    const occs = expandRecurrence(weekly, d("2026-06-01T00:00:00Z"), d("2099-01-01T00:00:00Z"));
    const last = occs[occs.length - 1];
    expect(last.getTime()).toBeLessThanOrEqual(d("2028-06-02T10:00:00Z").getTime());
  });

  it("ohne recurrenceFreq: nur der Start selbst, wenn im Fenster", () => {
    const single = { ...weekly, recurrenceFreq: null };
    expect(expandRecurrence(single, d("2026-06-01T00:00:00Z"), d("2026-06-02T00:00:00Z"))).toHaveLength(1);
    expect(expandRecurrence(single, d("2026-07-01T00:00:00Z"), d("2026-07-02T00:00:00Z"))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `cd backend; npx vitest run src/test/recurrence.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: FAIL ("Cannot find module '../lib/recurrence.js'")

- [ ] **Step 3: Implementierung**

`backend/src/lib/recurrence.ts`:

```ts
export type RecurrenceFreq = "TAEGLICH" | "WOECHENTLICH" | "MONATLICH" | "JAEHRLICH";

export interface RecurringEventLike {
  start: Date;
  recurrenceFreq: RecurrenceFreq | null;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
}

const MAX_OCCURRENCES = 500;
const MAX_HORIZON_MS = 2 * 366 * 24 * 60 * 60 * 1000; // ~2 Jahre

/**
 * n-te Occurrence ab start (n=0 -> start selbst). Immer vom Original-Start aus
 * gerechnet (kein kumulativer Drift). Monats-/Jahresende wird geklemmt:
 * 31.01. + 1 Monat = 28.02., aber 31.01. + 2 Monate = 31.03.
 * Rechnet in UTC, damit das Verhalten unabhängig von der Server-Zeitzone ist.
 */
export function nthOccurrence(start: Date, freq: RecurrenceFreq, interval: number, n: number): Date {
  const steps = n * Math.max(1, interval);
  const d = new Date(start);
  switch (freq) {
    case "TAEGLICH":
      d.setUTCDate(d.getUTCDate() + steps);
      return d;
    case "WOECHENTLICH":
      d.setUTCDate(d.getUTCDate() + 7 * steps);
      return d;
    case "MONATLICH": {
      d.setUTCDate(1);
      d.setUTCMonth(start.getUTCMonth() + steps);
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(start.getUTCDate(), lastDay));
      return d;
    }
    case "JAEHRLICH": {
      d.setUTCDate(1);
      d.setUTCFullYear(start.getUTCFullYear() + steps);
      d.setUTCMonth(start.getUTCMonth());
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(start.getUTCDate(), lastDay));
      return d;
    }
  }
}

/**
 * Liefert alle Occurrence-Starts eines Events im Fenster [from, to].
 * recurrenceUntil ist inklusiv. Harter Horizont: 2 Jahre ab start bzw. 500 Instanzen.
 */
export function expandRecurrence(event: RecurringEventLike, from: Date, to: Date): Date[] {
  if (!event.recurrenceFreq) {
    return event.start >= from && event.start <= to ? [new Date(event.start)] : [];
  }
  const horizon = new Date(event.start.getTime() + MAX_HORIZON_MS);
  const until = event.recurrenceUntil && event.recurrenceUntil < horizon ? event.recurrenceUntil : horizon;
  const result: Date[] = [];
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const occ = nthOccurrence(event.start, event.recurrenceFreq, event.recurrenceInterval, n);
    if (occ > until || occ > to) break;
    if (occ >= from) result.push(occ);
  }
  return result;
}
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `cd backend; npx vitest run src/test/recurrence.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: PASS (alle Tests grün)

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/recurrence.ts backend/src/test/recurrence.test.ts
git commit -m "feat(calendar): recurrence expansion engine with month-end clamping"
```

---

### Task 3: Zod-Schemas erweitern (TDD)

**Files:**
- Modify: `backend/src/schemas/calendar.schema.ts`
- Test: `backend/src/test/calendar-api.test.ts` (neu, wächst in Task 4 weiter)

- [ ] **Step 1: Failing Tests schreiben**

`backend/src/test/calendar-api.test.ts` (erste Version):

```ts
import { describe, it, expect } from "vitest";
import { createCalendarEventSchema, updateCalendarEventSchema } from "../schemas/calendar.schema.js";

describe("createCalendarEventSchema — neue Felder", () => {
  const base = { title: "Begehung", start: "2026-07-01T10:00:00Z" };

  it("akzeptiert Wiederholung mit Preset-Erinnerung und Verknüpfungen", () => {
    const result = createCalendarEventSchema.safeParse({
      ...base,
      recurrenceFreq: "MONATLICH",
      recurrenceInterval: 3,
      recurrenceUntil: "2027-07-01T00:00:00Z",
      reminderMinutes: 1440,
      propertyId: 5,
      tenantId: 7,
      visitorName: "Max Muster",
      visitorContact: "+49 170 1234567",
    });
    expect(result.success).toBe(true);
  });

  it("lehnt unbekannte recurrenceFreq ab", () => {
    expect(createCalendarEventSchema.safeParse({ ...base, recurrenceFreq: "STUENDLICH" }).success).toBe(false);
  });

  it("lehnt reminderMinutes außerhalb der Presets ab", () => {
    expect(createCalendarEventSchema.safeParse({ ...base, reminderMinutes: 17 }).success).toBe(false);
  });

  it("lehnt recurrenceInterval über 99 ab", () => {
    expect(createCalendarEventSchema.safeParse({ ...base, recurrenceFreq: "TAEGLICH", recurrenceInterval: 100 }).success).toBe(false);
  });

  it("update-Schema akzeptiert reminderMinutes: null (Erinnerung entfernen)", () => {
    expect(updateCalendarEventSchema.safeParse({ reminderMinutes: null }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `cd backend; npx vitest run src/test/calendar-api.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: FAIL (recurrenceFreq unbekannt → strip → success=true beim Negativtest bzw. Felder fehlen)

- [ ] **Step 3: Schema implementieren**

`backend/src/schemas/calendar.schema.ts` komplett ersetzen:

```ts
import { z } from "zod";

export const REMINDER_PRESETS = [60, 1440, 4320, 10080] as const; // 1h, 1d, 3d, 1w

const recurrenceFreqSchema = z.enum(["TAEGLICH", "WOECHENTLICH", "MONATLICH", "JAEHRLICH"]);

const reminderMinutesSchema = z
  .number()
  .refine((v): v is (typeof REMINDER_PRESETS)[number] => (REMINDER_PRESETS as readonly number[]).includes(v), {
    message: "Erinnerung muss 60, 1440, 4320 oder 10080 Minuten sein",
  });

const sharedEventFields = {
  description: z.string().max(2000).nullish(),
  end: z.coerce.date().nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  recurrenceFreq: recurrenceFreqSchema.nullish(),
  recurrenceInterval: z.number().int().min(1).max(99).optional(),
  recurrenceUntil: z.coerce.date().nullish(),
  reminderMinutes: reminderMinutesSchema.nullish(),
  propertyId: z.number().int().positive().nullish(),
  tenantId: z.number().int().positive().nullish(),
  visitorName: z.string().max(200).nullish(),
  visitorContact: z.string().max(200).nullish(),
};

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  start: z.coerce.date(),
  allDay: z.boolean().default(false),
  type: z.enum(["MANUELL", "BESICHTIGUNG"]).optional(),
  ...sharedEventFields,
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  start: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  ...sharedEventFields,
});

export const calendarQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `cd backend; npx vitest run src/test/calendar-api.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/calendar.schema.ts backend/src/test/calendar-api.test.ts
git commit -m "feat(calendar): validation for recurrence, reminder presets, entity links"
```

---

### Task 4: calendar.service — Expansion + neue Felder + Ownership (TDD)

**Files:**
- Modify: `backend/src/services/calendar.service.ts`
- Test: `backend/src/test/calendar-api.test.ts` (erweitern)

- [ ] **Step 1: Failing Tests ergänzen**

An `backend/src/test/calendar-api.test.ts` anhängen:

```ts
import { vi, beforeEach } from "vitest";

const { mockEventFindMany, mockEventCreate, mockPropFindFirst, mockTenantFindFirst } = vi.hoisted(() => ({
  mockEventFindMany: vi.fn(),
  mockEventCreate: vi.fn(),
  mockPropFindFirst: vi.fn(),
  mockTenantFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    calendarEvent: { findMany: mockEventFindMany, create: mockEventCreate, findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contract: { findMany: vi.fn().mockResolvedValue([]) },
    maintenanceTicket: { findMany: vi.fn().mockResolvedValue([]) },
    rentPayment: { findMany: vi.fn().mockResolvedValue([]) },
    property: { findFirst: mockPropFindFirst },
    tenant: { findFirst: mockTenantFindFirst },
  },
}));

import { listEvents, createEvent } from "../services/calendar.service.js";

describe("listEvents — Recurrence-Expansion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expandiert wiederkehrende Events zu virtuellen Instanzen mit seriesId", async () => {
    const recurring = {
      id: 9, title: "Begehung", start: new Date("2026-06-01T10:00:00Z"), end: new Date("2026-06-01T11:00:00Z"),
      allDay: false, type: "MANUELL", companyId: 1,
      recurrenceFreq: "WOECHENTLICH", recurrenceInterval: 1, recurrenceUntil: null,
    };
    // 1. Aufruf: einmalige Events, 2. Aufruf: wiederkehrende
    mockEventFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([recurring]);

    const events = await listEvents(1, new Date("2026-06-01T00:00:00Z"), new Date("2026-06-15T23:59:59Z"));
    const instances = events.filter((e) => (e as { seriesId?: number }).seriesId === 9);
    expect(instances).toHaveLength(3); // 01., 08., 15.
    expect((instances[0] as { id: string }).id).toBe("evt-9-2026-06-01");
    // Dauer bleibt 1h
    const first = instances[0] as { start: Date; end: Date };
    expect(first.end.getTime() - first.start.getTime()).toBe(60 * 60 * 1000);
  });
});

describe("createEvent — Ownership-Validierung", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lehnt propertyId fremder Firma mit 404 ab", async () => {
    mockPropFindFirst.mockResolvedValueOnce(null);
    await expect(
      createEvent(1, 1, { title: "X", start: new Date(), propertyId: 99 })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it("legt Event mit gültiger propertyId an", async () => {
    mockPropFindFirst.mockResolvedValueOnce({ id: 5 });
    mockEventCreate.mockResolvedValueOnce({ id: 1 });
    await createEvent(1, 1, { title: "X", start: new Date(), propertyId: 5 });
    expect(mockPropFindFirst).toHaveBeenCalledWith({ where: { id: 5, companyId: 1 }, select: { id: true } });
    expect(mockEventCreate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `cd backend; npx vitest run src/test/calendar-api.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: FAIL (keine seriesId-Instanzen, kein Ownership-Check)

- [ ] **Step 3: Service implementieren**

In `backend/src/services/calendar.service.ts`:

Import oben ergänzen: `import { expandRecurrence } from "../lib/recurrence.js";`

`listEvents` ersetzen:

```ts
const ENTITY_INCLUDE = {
  property: { select: { id: true, name: true } },
  tenant: { select: { id: true, name: true } },
} as const;

export async function listEvents(companyId: number, from?: Date, to?: Date) {
  const dateFilter = from && to ? { start: { gte: from, lte: to } } : {};

  const [single, recurring] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { companyId, recurrenceFreq: null, ...dateFilter },
      include: ENTITY_INCLUDE,
      orderBy: { start: "asc" },
    }),
    // Serien können vor dem Fenster starten — nur nach oben begrenzen
    prisma.calendarEvent.findMany({
      where: { companyId, recurrenceFreq: { not: null }, ...(to ? { start: { lte: to } } : {}) },
      include: ENTITY_INCLUDE,
    }),
  ]);

  const now = new Date();
  const windowFrom = from ?? now;
  const windowTo = to ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const expanded = recurring.flatMap((e) => {
    const durationMs = e.end ? e.end.getTime() - e.start.getTime() : 0;
    return expandRecurrence(e, windowFrom, windowTo).map((occStart) => ({
      ...e,
      id: `evt-${e.id}-${occStart.toISOString().slice(0, 10)}`,
      seriesId: e.id,
      start: occStart,
      end: e.end ? new Date(occStart.getTime() + durationMs) : null,
    }));
  });

  const auto = await getAutoEvents(companyId, from, to);
  return [...single, ...expanded, ...auto];
}
```

`createEvent` ersetzen (inkl. Ownership-Helper):

```ts
async function assertEntityOwnership(companyId: number, propertyId?: number | null, tenantId?: number | null): Promise<void> {
  if (propertyId) {
    const p = await prisma.property.findFirst({ where: { id: propertyId, companyId }, select: { id: true } });
    if (!p) throw new AppError(404, "Immobilie nicht gefunden");
  }
  if (tenantId) {
    const t = await prisma.tenant.findFirst({ where: { id: tenantId, companyId }, select: { id: true } });
    if (!t) throw new AppError(404, "Mieter nicht gefunden");
  }
}

export interface CalendarEventInput {
  title: string; description?: string | null; start: Date; end?: Date | null; allDay?: boolean;
  color?: string | null; type?: "MANUELL" | "BESICHTIGUNG";
  recurrenceFreq?: "TAEGLICH" | "WOECHENTLICH" | "MONATLICH" | "JAEHRLICH" | null;
  recurrenceInterval?: number; recurrenceUntil?: Date | null;
  reminderMinutes?: number | null;
  propertyId?: number | null; tenantId?: number | null;
  visitorName?: string | null; visitorContact?: string | null;
}

export async function createEvent(companyId: number, userId: number, data: CalendarEventInput) {
  await assertEntityOwnership(companyId, data.propertyId, data.tenantId);
  const { type = "MANUELL", ...rest } = data;
  return prisma.calendarEvent.create({
    data: { ...rest, companyId, createdByUserId: userId, type },
  });
}
```

`updateEvent` ersetzen:

```ts
export async function updateEvent(companyId: number, id: number, data: Partial<CalendarEventInput>) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError(404, "Termin nicht gefunden");
  const editable = ["MANUELL", "AUTO_EMAIL", "BESICHTIGUNG"] as const;
  if (!(editable as readonly string[]).includes(event.type)) {
    throw new AppError(403, "Nur manuelle Termine können bearbeitet werden");
  }
  await assertEntityOwnership(companyId, data.propertyId, data.tenantId);
  // Start oder Erinnerung geändert -> Erinnerung darf erneut feuern
  const resetReminder = data.start !== undefined || data.reminderMinutes !== undefined;
  return prisma.calendarEvent.update({
    where: { id },
    data: { ...data, ...(resetReminder ? { reminderSentFor: null } : {}) },
  });
}
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `cd backend; npx vitest run src/test/calendar-api.test.ts src/test/recurrence.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: PASS

- [ ] **Step 5: tsc prüfen + Commit**

Run: `cd backend; npx tsc --noEmit` → exit 0

```bash
git add backend/src/services/calendar.service.ts backend/src/test/calendar-api.test.ts
git commit -m "feat(calendar): expand recurring events server-side, ownership checks"
```

---

### Task 5: Notification-Service + API (TDD)

**Files:**
- Create: `backend/src/services/notification.service.ts`
- Create: `backend/src/controllers/notification.controller.ts`
- Create: `backend/src/routes/notification.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/src/test/notification.service.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

`backend/src/test/notification.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockCount, mockUpdateMany, mockCreate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    notification: { findMany: mockFindMany, count: mockCount, updateMany: mockUpdateMany, create: mockCreate },
  },
}));

import { listNotifications, markRead, markAllRead, createNotification } from "../services/notification.service.js";

describe("notification.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listNotifications scoped auf companyId+userId, liefert unreadCount", async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 1 }]);
    mockCount.mockResolvedValueOnce(3);
    const result = await listNotifications(1, 42);
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 1, userId: 42 } }));
    expect(result.meta.unreadCount).toBe(3);
  });

  it("markRead aktualisiert nur eigene Notification (404 sonst)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(markRead(1, 42, 7)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 7, companyId: 1, userId: 42 },
      data: { readAt: expect.any(Date) },
    });
  });

  it("markAllRead markiert nur ungelesene des Users", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 2 });
    await markAllRead(1, 42);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { companyId: 1, userId: 42, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("createNotification legt Eintrag an", async () => {
    mockCreate.mockResolvedValueOnce({ id: 1 });
    await createNotification(1, 42, { type: "TERMIN_ERINNERUNG", title: "T", link: "/calendar" });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: 1, userId: 42, type: "TERMIN_ERINNERUNG" }),
    });
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `cd backend; npx vitest run src/test/notification.service.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: FAIL (Modul existiert nicht)

- [ ] **Step 3: Service implementieren**

`backend/src/services/notification.service.ts`:

```ts
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

export async function listNotifications(companyId: number, userId: number) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { companyId, userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { companyId, userId, readAt: null } }),
  ]);
  return { data: rows, meta: { unreadCount } };
}

export async function markRead(companyId: number, userId: number, id: number): Promise<void> {
  const { count } = await prisma.notification.updateMany({
    where: { id, companyId, userId },
    data: { readAt: new Date() },
  });
  if (count === 0) throw new NotFoundError("Benachrichtigung", id);
}

export async function markAllRead(companyId: number, userId: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { companyId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function createNotification(
  companyId: number,
  userId: number,
  data: { type: string; title: string; body?: string; link?: string }
) {
  return prisma.notification.create({ data: { ...data, companyId, userId } });
}
```

- [ ] **Step 4: Controller + Routen**

`backend/src/controllers/notification.controller.ts`:

```ts
import type { Request, Response } from "express";
import * as svc from "../services/notification.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await svc.listNotifications(req.companyId!, req.userId!);
  res.json(result);
}

export async function markRead(req: Request, res: Response): Promise<void> {
  await svc.markRead(req.companyId!, req.userId!, Number(req.params.id));
  res.status(204).end();
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await svc.markAllRead(req.companyId!, req.userId!);
  res.status(204).end();
}
```

`backend/src/routes/notification.routes.ts`:

```ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/notification.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.patch("/:id/read", validate({ params: idParamSchema }), ctrl.markRead);
router.post("/read-all", ctrl.markAllRead);

export { router as notificationRouter };
```

In `backend/src/routes/index.ts` Import ergänzen (`import { notificationRouter } from "./notification.routes.js";`) und nach der `/calendar`-Zeile mounten:

```ts
router.use("/notifications", requireAuth, tenantGuard, subscriptionGuard, notificationRouter);
```

- [ ] **Step 5: Tests + tsc — müssen bestehen**

Run: `cd backend; npx vitest run src/test/notification.service.test.ts --pool=forks --no-file-parallelism --testTimeout=120000; npx tsc --noEmit`
Expected: PASS + exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/notification.service.ts backend/src/controllers/notification.controller.ts backend/src/routes/notification.routes.ts backend/src/routes/index.ts backend/src/test/notification.service.test.ts
git commit -m "feat(notifications): personal in-app notifications API"
```

---

### Task 6: Reminder-Service + Scheduler (TDD)

**Files:**
- Create: `backend/src/services/reminder.service.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/test/reminder.service.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

`backend/src/test/reminder.service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../config/email.js", () => ({ sendMailForCompany: vi.fn() }));

import { getDueOccurrence } from "../services/reminder.service.js";

const d = (s: string) => new Date(s);

describe("getDueOccurrence — einmalige Termine", () => {
  const base = {
    start: d("2026-07-01T10:00:00Z"),
    recurrenceFreq: null,
    recurrenceInterval: 1,
    recurrenceUntil: null,
    reminderMinutes: 1440, // 1 Tag vorher
    reminderSentFor: null,
  };

  it("fällig innerhalb der Vorlaufzeit", () => {
    expect(getDueOccurrence(base, d("2026-06-30T12:00:00Z"))).toEqual(base.start);
  });

  it("nicht fällig vor der Vorlaufzeit", () => {
    expect(getDueOccurrence(base, d("2026-06-29T12:00:00Z"))).toBeNull();
  });

  it("nicht fällig nach Terminbeginn", () => {
    expect(getDueOccurrence(base, d("2026-07-01T10:00:01Z"))).toBeNull();
  });

  it("dedupliziert über reminderSentFor", () => {
    const sent = { ...base, reminderSentFor: base.start };
    expect(getDueOccurrence(sent, d("2026-06-30T12:00:00Z"))).toBeNull();
  });

  it("null ohne reminderMinutes", () => {
    expect(getDueOccurrence({ ...base, reminderMinutes: null }, d("2026-06-30T12:00:00Z"))).toBeNull();
  });
});

describe("getDueOccurrence — wiederkehrende Termine", () => {
  const weekly = {
    start: d("2026-06-01T10:00:00Z"),
    recurrenceFreq: "WOECHENTLICH" as const,
    recurrenceInterval: 1,
    recurrenceUntil: null,
    reminderMinutes: 60,
    reminderSentFor: null,
  };

  it("findet die nächste Occurrence in der Vorlaufzeit", () => {
    // 08.06. 10:00 ist die nächste Occurrence; 09:30 liegt in der 60-Min-Vorlaufzeit
    expect(getDueOccurrence(weekly, d("2026-06-08T09:30:00Z"))).toEqual(d("2026-06-08T10:00:00Z"));
  });

  it("nichts fällig außerhalb der Vorlaufzeit", () => {
    expect(getDueOccurrence(weekly, d("2026-06-08T08:00:00Z"))).toBeNull();
  });

  it("dedupliziert pro Occurrence", () => {
    const sent = { ...weekly, reminderSentFor: d("2026-06-08T10:00:00Z") };
    expect(getDueOccurrence(sent, d("2026-06-08T09:30:00Z"))).toBeNull();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `cd backend; npx vitest run src/test/reminder.service.test.ts --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: FAIL (Modul existiert nicht)

- [ ] **Step 3: Implementierung**

`backend/src/services/reminder.service.ts`:

```ts
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { expandRecurrence, type RecurringEventLike } from "../lib/recurrence.js";
import { createNotification } from "./notification.service.js";
import { sendMailForCompany } from "../config/email.js";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten

export interface ReminderEventLike extends RecurringEventLike {
  reminderMinutes: number | null;
  reminderSentFor: Date | null;
}

/**
 * Liefert den Occurrence-Start, für den JETZT erinnert werden muss — oder null.
 * Fällig, wenn die Occurrence innerhalb der Vorlaufzeit liegt und für sie
 * noch nicht erinnert wurde (reminderSentFor).
 */
export function getDueOccurrence(event: ReminderEventLike, now: Date): Date | null {
  if (event.reminderMinutes == null) return null;
  const leadMs = event.reminderMinutes * 60 * 1000;
  const windowEnd = new Date(now.getTime() + leadMs);

  const occs = expandRecurrence(event, now, windowEnd);
  const next = occs.find((o) => o > now);
  if (!next) return null;
  if (event.reminderSentFor && event.reminderSentFor.getTime() === next.getTime()) return null;
  return next;
}

function formatBerlin(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full", timeStyle: "short", timeZone: "Europe/Berlin",
  }).format(date);
}

/** Ein Scheduler-Lauf. Exportiert für Tests/manuelle Trigger. Liefert Anzahl gesendeter Erinnerungen. */
export async function processReminders(now: Date = new Date()): Promise<number> {
  const events = await prisma.calendarEvent.findMany({
    where: { reminderMinutes: { not: null }, type: { in: ["MANUELL", "BESICHTIGUNG"] } },
  });

  let sent = 0;
  for (const event of events) {
    try {
      const due = getDueOccurrence(event, now);
      if (!due) continue;

      let userId = event.createdByUserId;
      if (!userId) {
        const admin = await prisma.user.findFirst({
          where: { companyId: event.companyId, role: "ADMIN" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        userId = admin?.id ?? null;
      }
      if (!userId) continue;

      const when = formatBerlin(due);
      await createNotification(event.companyId, userId, {
        type: "TERMIN_ERINNERUNG",
        title: `Erinnerung: ${event.title}`,
        body: `Termin am ${when}`,
        link: "/calendar",
      });

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (user) {
        await sendMailForCompany(
          event.companyId,
          user.email,
          `Terminerinnerung: ${event.title}`,
          `<p>Guten Tag ${user.name},</p>
           <p>Erinnerung an Ihren Termin:</p>
           <p><strong>${event.title}</strong><br>${when}</p>
           ${event.description ? `<p>${event.description}</p>` : ""}`
        );
      }

      await prisma.calendarEvent.update({ where: { id: event.id }, data: { reminderSentFor: due } });
      sent++;
    } catch (err) {
      logger.error({ err, eventId: event.id }, "[REMINDER] Fehler bei Erinnerung");
    }
  }

  if (sent > 0) logger.info({ sent }, "[REMINDER] Erinnerungen verschickt");
  return sent;
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(): void {
  processReminders().catch((err) => logger.error({ err }, "[REMINDER] Fehler beim initialen Lauf"));
  reminderTimer = setInterval(() => {
    processReminders().catch((err) => logger.error({ err }, "[REMINDER] Fehler beim periodischen Lauf"));
  }, REMINDER_INTERVAL_MS);
  logger.info("Termin-Erinnerungen gestartet (Intervall: 5min)");
}

export function stopReminderScheduler(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
```

- [ ] **Step 4: Scheduler in index.ts verdrahten**

In `backend/src/index.ts`: Import ergänzen `import { startReminderScheduler, stopReminderScheduler } from "./services/reminder.service.js";`
Nach `startRetentionCleanup();` (Zeile ~49) einfügen: `startReminderScheduler();`
In `shutdown()` nach `stopRetentionCleanup();` einfügen: `stopReminderScheduler();`

- [ ] **Step 5: Tests + tsc — müssen bestehen**

Run: `cd backend; npx vitest run src/test/reminder.service.test.ts --pool=forks --no-file-parallelism --testTimeout=120000; npx tsc --noEmit`
Expected: PASS + exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/reminder.service.ts backend/src/index.ts backend/src/test/reminder.service.test.ts
git commit -m "feat(calendar): reminder scheduler with email + in-app notifications"
```

---

### Task 7: Frontend-Hooks (Types + useNotifications)

**Files:**
- Modify: `cozy-estate-central/src/hooks/api/useCalendarEvents.ts`
- Create: `cozy-estate-central/src/hooks/api/useNotifications.ts`

- [ ] **Step 1: CalendarEvent-Typ erweitern**

In `useCalendarEvents.ts` das Interface `CalendarEvent` ersetzen:

```ts
export type RecurrenceFreq = "TAEGLICH" | "WOECHENTLICH" | "MONATLICH" | "JAEHRLICH";

export interface CalendarEvent {
  id: string | number;
  seriesId?: number;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  type: "MANUELL" | "AUTO_VERTRAG" | "AUTO_WARTUNG" | "AUTO_MIETE" | "AUTO_EMAIL" | "BESICHTIGUNG";
  color?: string;
  sourceId?: number;
  description?: string | null;
  recurrenceFreq?: RecurrenceFreq | null;
  recurrenceInterval?: number;
  recurrenceUntil?: string | null;
  reminderMinutes?: number | null;
  propertyId?: number | null;
  tenantId?: number | null;
  visitorName?: string | null;
  visitorContact?: string | null;
  property?: { id: number; name: string } | null;
  tenant?: { id: number; name: string } | null;
}
```

- [ ] **Step 2: useNotifications.ts anlegen**

`cozy-estate-central/src/hooks/api/useNotifications.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ data: AppNotification[]; meta: { unreadCount: number } }>("/notifications"),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
```

- [ ] **Step 3: tsc prüfen + Commit**

Run: `cd cozy-estate-central; npx tsc --noEmit` → exit 0

```bash
git add cozy-estate-central/src/hooks/api/useCalendarEvents.ts cozy-estate-central/src/hooks/api/useNotifications.ts
git commit -m "feat(frontend): calendar event types + notifications hooks"
```

---

### Task 8: NotificationBell + Sidebar-Einbau

**Files:**
- Create: `cozy-estate-central/src/components/NotificationBell.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

- [ ] **Step 1: NotificationBell implementieren**

`cozy-estate-central/src/components/NotificationBell.tsx`:

```tsx
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale/de";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/hooks/api/useNotifications";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];
  const unread = data?.meta.unreadCount ?? 0;

  const handleClick = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Benachrichtigungen</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" /> Alle gelesen
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Keine Benachrichtigungen</p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50 ${
                n.readAt ? "opacity-60" : ""
              }`}
            >
              <span className="text-sm font-medium leading-tight">{n.title}</span>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: de })}
              </span>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: In AppSidebar einbauen**

In `cozy-estate-central/src/components/AppSidebar.tsx`: Import ergänzen `import { NotificationBell } from "@/components/NotificationBell";` und im Header-Div (Zeile ~68, `flex h-16 items-center gap-3 px-4`) nach dem Titel-Block einfügen:

```tsx
{!collapsed && <div className="ml-auto"><NotificationBell /></div>}
```

- [ ] **Step 3: tsc prüfen + Commit**

Run: `cd cozy-estate-central; npx tsc --noEmit` → exit 0

```bash
git add cozy-estate-central/src/components/NotificationBell.tsx cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat(frontend): notification bell with unread badge in sidebar"
```

---

### Task 9: Kalender-Theme + EventPill + eventMeta

**Files:**
- Create: `cozy-estate-central/src/components/calendar/eventMeta.ts`
- Create: `cozy-estate-central/src/components/calendar/calendar-theme.css`
- Create: `cozy-estate-central/src/components/calendar/EventPill.tsx`

- [ ] **Step 1: eventMeta.ts — eine Quelle für Farben/Labels/Icons**

```ts
import { CalendarDays, FileText, Wrench, CreditCard, Mail, Eye, type LucideIcon } from "lucide-react";
import type { CalendarEvent } from "@/hooks/api/useCalendarEvents";

export type EventType = CalendarEvent["type"];

export const EVENT_META: Record<EventType, { label: string; color: string; icon: LucideIcon; link?: string }> = {
  MANUELL: { label: "Manuell", color: "#3b82f6", icon: CalendarDays },
  AUTO_VERTRAG: { label: "Vertrag", color: "#f97316", icon: FileText, link: "/contracts" },
  AUTO_WARTUNG: { label: "Wartung", color: "#ef4444", icon: Wrench, link: "/maintenance" },
  AUTO_MIETE: { label: "Mietzahlung", color: "#22c55e", icon: CreditCard, link: "/finances" },
  AUTO_EMAIL: { label: "Aus E-Mail", color: "#8b5cf6", icon: Mail, link: "/postfach" },
  BESICHTIGUNG: { label: "Besichtigung", color: "#0ea5e9", icon: Eye },
};

export const ALL_EVENT_TYPES = Object.keys(EVENT_META) as EventType[];

export function eventColor(event: Pick<CalendarEvent, "type" | "color">): string {
  return event.color ?? EVENT_META[event.type]?.color ?? "#6b7280";
}
```

- [ ] **Step 2: calendar-theme.css — rbc über Theme-Variablen**

```css
/* react-big-calendar Theme — nutzt die shadcn-CSS-Variablen, funktioniert in Light + Dark */
.rbc-calendar { font-family: inherit; }

.rbc-month-view,
.rbc-time-view,
.rbc-agenda-view {
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  overflow: hidden;
  background: hsl(var(--card));
}

.rbc-header {
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.4);
  border-bottom: 1px solid hsl(var(--border));
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.rbc-month-view .rbc-header + .rbc-header,
.rbc-day-bg + .rbc-day-bg,
.rbc-month-row + .rbc-month-row,
.rbc-time-content > * + * > *,
.rbc-timeslot-group,
.rbc-time-header-content,
.rbc-time-content {
  border-color: hsl(var(--border));
}

.rbc-off-range-bg { background: hsl(var(--muted) / 0.35); }
.rbc-off-range .rbc-button-link { color: hsl(var(--muted-foreground) / 0.5); }

.rbc-today { background: hsl(var(--primary) / 0.07); }

.rbc-date-cell {
  padding: 4px 6px;
  font-size: 12px;
  color: hsl(var(--foreground));
}
.rbc-date-cell.rbc-now .rbc-button-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-weight: 700;
}

/* Events: Pill-Komponente übernimmt die Optik komplett */
.rbc-event,
.rbc-day-slot .rbc-event {
  background: transparent;
  border: none;
  padding: 1px 2px;
  outline: none;
}
.rbc-event.rbc-selected { background: transparent; }
.rbc-event:focus { outline: 2px solid hsl(var(--ring)); outline-offset: 1px; border-radius: 4px; }

.rbc-show-more {
  color: hsl(var(--primary));
  font-size: 11px;
  font-weight: 600;
  background: transparent;
  padding: 0 6px;
}

.rbc-overlay {
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
  padding: 8px;
}
.rbc-overlay-header {
  border-bottom: 1px solid hsl(var(--border));
  font-weight: 600;
  padding: 2px 4px 6px;
}

.rbc-time-view .rbc-current-time-indicator { background: hsl(var(--primary)); height: 2px; }
.rbc-time-slot { color: hsl(var(--muted-foreground)); font-size: 11px; }
.rbc-time-view .rbc-allday-cell { max-height: 70px; }
```

- [ ] **Step 3: EventPill.tsx**

```tsx
import { format } from "date-fns";
import { Repeat } from "lucide-react";
import type { CalendarEvent } from "@/hooks/api/useCalendarEvents";
import { EVENT_META, eventColor } from "./eventMeta";

export interface RbcEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: CalendarEvent;
}

export function EventPill({ event }: { event: RbcEvent }) {
  const res = event.resource;
  const Icon = EVENT_META[res.type]?.icon;
  return (
    <div
      className="flex items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight text-white"
      style={{ backgroundColor: eventColor(res) }}
      title={event.title}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0 opacity-90" />}
      {!event.allDay && <span className="shrink-0 opacity-85">{format(event.start, "HH:mm")}</span>}
      <span className="truncate">{event.title}</span>
      {res.seriesId != null && <Repeat className="ml-auto h-3 w-3 shrink-0 opacity-85" />}
    </div>
  );
}
```

- [ ] **Step 4: tsc prüfen + Commit**

Run: `cd cozy-estate-central; npx tsc --noEmit` → exit 0

```bash
git add cozy-estate-central/src/components/calendar
git commit -m "feat(frontend): calendar theme css, event meta, event pill"
```

---

### Task 10: CalendarToolbar + CalendarAgenda

**Files:**
- Create: `cozy-estate-central/src/components/calendar/CalendarToolbar.tsx`
- Create: `cozy-estate-central/src/components/calendar/CalendarAgenda.tsx`

- [ ] **Step 1: CalendarToolbar.tsx**

```tsx
import { format, startOfWeek, addDays } from "date-fns";
import { de } from "date-fns/locale/de";
import { ChevronLeft, ChevronRight, Plus, CalendarArrowDown, Loader2, Search, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_META, ALL_EVENT_TYPES, type EventType } from "./eventMeta";

export type CalendarViewKey = "month" | "week" | "day" | "agenda";

const VIEW_LABELS: Record<CalendarViewKey, string> = {
  month: "Monat", week: "Woche", day: "Tag", agenda: "Agenda",
};

interface Props {
  date: Date;
  view: CalendarViewKey;
  activeTypes: Set<EventType>;
  search: string;
  icalLoading: boolean;
  onNavigate: (dir: -1 | 0 | 1) => void;
  onView: (v: CalendarViewKey) => void;
  onToggleType: (t: EventType) => void;
  onSearch: (s: string) => void;
  onIcal: () => void;
  onNewEvent: () => void;
  onOpenDrawer: () => void;
}

export function CalendarToolbar({
  date, view, activeTypes, search, icalLoading,
  onNavigate, onView, onToggleType, onSearch, onIcal, onNewEvent, onOpenDrawer,
}: Props) {
  const title =
    view === "day"
      ? format(date, "EEEE, dd. MMMM yyyy", { locale: de })
      : view === "week"
      ? `${format(startOfWeek(date, { weekStartsOn: 1 }), "dd. MMM", { locale: de })} – ${format(addDays(startOfWeek(date, { weekStartsOn: 1 }), 6), "dd. MMM yyyy", { locale: de })}`
      : format(date, "MMMM yyyy", { locale: de });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(-1)} aria-label="Zurück">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(1)} aria-label="Weiter">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => onNavigate(0)}>Heute</Button>
        <span className="min-w-44 font-heading text-base font-semibold">{title}</span>

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Termine suchen…"
            className="h-8 w-44 pl-8"
          />
        </div>

        <div className="flex overflow-hidden rounded-md border">
          {(Object.keys(VIEW_LABELS) as CalendarViewKey[]).map((v) => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenDrawer}>
          <ListTodo className="h-4 w-4" /> Demnächst
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={icalLoading} onClick={onIcal}>
          {icalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarArrowDown className="h-4 w-4" />}
          iCal
        </Button>
        <Button size="sm" className="h-8" onClick={onNewEvent}>
          <Plus className="mr-1 h-4 w-4" /> Termin
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ALL_EVENT_TYPES.map((t) => {
          const active = activeTypes.has(t);
          const meta = EVENT_META[t];
          return (
            <button
              key={t}
              onClick={() => onToggleType(t)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? "border-transparent text-white" : "border-border text-muted-foreground hover:bg-muted"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,.8)" : meta.color }} />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CalendarAgenda.tsx**

```tsx
import { format, isToday, isTomorrow } from "date-fns";
import { de } from "date-fns/locale/de";
import { Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/hooks/api/useCalendarEvents";
import { EVENT_META, eventColor } from "./eventMeta";

interface Props {
  events: CalendarEvent[];
  onSelect: (e: CalendarEvent) => void;
  emptyText?: string;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return `Heute — ${format(date, "EEEE, dd. MMMM", { locale: de })}`;
  if (isTomorrow(date)) return `Morgen — ${format(date, "EEEE, dd. MMMM", { locale: de })}`;
  return format(date, "EEEE, dd. MMMM yyyy", { locale: de });
}

export function CalendarAgenda({ events, onSelect, emptyText = "Keine Termine im Zeitraum" }: Props) {
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const groups = new Map<string, CalendarEvent[]>();
  for (const e of sorted) {
    const key = format(new Date(e.start), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  if (sorted.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([key, dayEvents]) => (
        <div key={key}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {dayLabel(new Date(key))}
          </p>
          <div className="flex flex-col gap-1.5">
            {dayEvents.map((e) => {
              const meta = EVENT_META[e.type];
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className="flex items-center gap-3 rounded-md border bg-card p-2.5 text-left transition-colors hover:bg-muted/50"
                  style={{ borderLeftColor: eventColor(e), borderLeftWidth: 3 }}
                >
                  <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {e.allDay ? "ganztags" : format(new Date(e.start), "HH:mm")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {e.property && (
                        <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{e.property.name}</span>
                      )}
                      {e.tenant && (
                        <span className="flex items-center gap-0.5"><User className="h-3 w-3" />{e.tenant.name}</span>
                      )}
                      {e.visitorName && (
                        <span className="flex items-center gap-0.5"><User className="h-3 w-3" />{e.visitorName}</span>
                      )}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]" style={{ color: meta.color, borderColor: meta.color }}>
                    {meta.label}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: tsc prüfen + Commit**

Run: `cd cozy-estate-central; npx tsc --noEmit` → exit 0

```bash
git add cozy-estate-central/src/components/calendar
git commit -m "feat(frontend): calendar toolbar with type filters and grouped agenda"
```

---

### Task 11: EventDialog + EventDetailDialog + Calendar.tsx-Rewrite

**Files:**
- Create: `cozy-estate-central/src/components/calendar/EventDialog.tsx`
- Create: `cozy-estate-central/src/components/calendar/EventDetailDialog.tsx`
- Modify: `cozy-estate-central/src/pages/Calendar.tsx` (komplett ersetzen)

- [ ] **Step 1: EventDialog.tsx (Anlegen + Bearbeiten)**

```tsx
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProperties } from "@/hooks/api/useProperties";
import { useTenants } from "@/hooks/api/useTenants";
import {
  useCreateCalendarEvent, useUpdateCalendarEvent,
  type CalendarEvent, type RecurrenceFreq,
} from "@/hooks/api/useCalendarEvents";

const RECURRENCE_OPTIONS: { value: "NONE" | RecurrenceFreq; label: string }[] = [
  { value: "NONE", label: "Keine Wiederholung" },
  { value: "TAEGLICH", label: "Täglich" },
  { value: "WOECHENTLICH", label: "Wöchentlich" },
  { value: "MONATLICH", label: "Monatlich" },
  { value: "JAEHRLICH", label: "Jährlich" },
];

const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "NONE", label: "Keine Erinnerung" },
  { value: "60", label: "1 Stunde vorher" },
  { value: "1440", label: "1 Tag vorher" },
  { value: "4320", label: "3 Tage vorher" },
  { value: "10080", label: "1 Woche vorher" },
];

type EventType = "MANUELL" | "BESICHTIGUNG";

interface FormState {
  title: string;
  type: EventType;
  start: string; // datetime-local
  duration: number; // Minuten, 0 = ganztägig
  recurrenceFreq: "NONE" | RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceUntil: string; // date
  reminder: string; // "NONE" | Minuten als String
  propertyId: string; // "NONE" | id
  tenantId: string;
  visitorName: string;
  visitorContact: string;
  description: string;
}

const EMPTY: FormState = {
  title: "", type: "MANUELL", start: "", duration: 0,
  recurrenceFreq: "NONE", recurrenceInterval: 1, recurrenceUntil: "",
  reminder: "NONE", propertyId: "NONE", tenantId: "NONE",
  visitorName: "", visitorContact: "", description: "",
};

function toFormState(e: CalendarEvent): FormState {
  const start = new Date(e.start);
  const end = e.end ? new Date(e.end) : null;
  return {
    title: e.title,
    type: e.type === "BESICHTIGUNG" ? "BESICHTIGUNG" : "MANUELL",
    start: format(start, "yyyy-MM-dd'T'HH:mm"),
    duration: end && !e.allDay ? Math.round((end.getTime() - start.getTime()) / 60000) : 0,
    recurrenceFreq: e.recurrenceFreq ?? "NONE",
    recurrenceInterval: e.recurrenceInterval ?? 1,
    recurrenceUntil: e.recurrenceUntil ? format(new Date(e.recurrenceUntil), "yyyy-MM-dd") : "",
    reminder: e.reminderMinutes != null ? String(e.reminderMinutes) : "NONE",
    propertyId: e.propertyId != null ? String(e.propertyId) : "NONE",
    tenantId: e.tenantId != null ? String(e.tenantId) : "NONE",
    visitorName: e.visitorName ?? "",
    visitorContact: e.visitorContact ?? "",
    description: e.description ?? "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neuer Termin; sonst Bearbeiten (bei Serien-Instanzen das Original mit seriesId als id) */
  editEvent: CalendarEvent | null;
}

export function EventDialog({ open, onOpenChange, editEvent }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const { data: propertiesData } = useProperties();
  const { data: tenantsData } = useTenants();

  useEffect(() => {
    if (open) setForm(editEvent ? toFormState(editEvent) : EMPTY);
  }, [open, editEvent]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isEdit = editEvent != null;
  const isSeries = isEdit && editEvent.recurrenceFreq != null;

  const handleSave = async () => {
    if (!form.title || !form.start) return;
    const start = new Date(form.start);
    const hasTime = form.duration > 0;

    const payload = {
      title: form.title,
      type: form.type,
      start: start.toISOString(),
      end: hasTime ? new Date(start.getTime() + form.duration * 60000).toISOString() : null,
      allDay: !hasTime,
      description: form.description || null,
      recurrenceFreq: form.recurrenceFreq === "NONE" ? null : form.recurrenceFreq,
      recurrenceInterval: form.recurrenceInterval,
      recurrenceUntil: form.recurrenceUntil ? new Date(`${form.recurrenceUntil}T23:59:59`).toISOString() : null,
      reminderMinutes: form.reminder === "NONE" ? null : Number(form.reminder),
      propertyId: form.propertyId === "NONE" ? null : Number(form.propertyId),
      tenantId: form.tenantId === "NONE" ? null : Number(form.tenantId),
      visitorName: form.type === "BESICHTIGUNG" ? form.visitorName || null : null,
      visitorContact: form.type === "BESICHTIGUNG" ? form.visitorContact || null : null,
    };

    try {
      if (isEdit) {
        const id = editEvent.seriesId ?? (editEvent.id as number);
        const { type: _type, ...updatePayload } = payload;
        await updateEvent.mutateAsync({ id, ...updatePayload });
        toast.success(isSeries ? "Serie aktualisiert" : "Termin aktualisiert");
      } else {
        await createEvent.mutateAsync(payload);
        toast.success("Termin erstellt");
      }
      onOpenChange(false);
    } catch {
      toast.error("Speichern fehlgeschlagen");
    }
  };

  const pending = createEvent.isPending || updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
          <DialogDescription>
            {isSeries ? "Änderungen gelten für die gesamte Serie." : "Termin mit Wiederholung, Erinnerung und Verknüpfungen anlegen."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 py-1">
          {!isEdit && (
            <div>
              <Label>Termintyp</Label>
              <div className="mt-1.5 flex gap-2">
                {([["MANUELL", "Allgemein"], ["BESICHTIGUNG", "Besichtigung"]] as [EventType, string][]).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("type", t)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      form.type === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {t === "BESICHTIGUNG" && <Eye className="h-3.5 w-3.5" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Titel</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Terminbezeichnung" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Datum & Uhrzeit</Label>
              <Input type="datetime-local" value={form.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div>
              <Label>Dauer (Min., leer = ganztägig)</Label>
              <Input
                type="number" min={0} step={15}
                value={form.duration === 0 ? "" : form.duration}
                onChange={(e) => set("duration", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Wiederholung</Label>
              <Select value={form.recurrenceFreq} onValueChange={(v) => set("recurrenceFreq", v as FormState["recurrenceFreq"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Erinnerung</Label>
              <Select value={form.reminder} onValueChange={(v) => set("reminder", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.recurrenceFreq !== "NONE" && (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <div>
                <Label>Intervall (alle n)</Label>
                <Input
                  type="number" min={1} max={99}
                  value={form.recurrenceInterval}
                  onChange={(e) => set("recurrenceInterval", Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <Label>Endet am (optional)</Label>
                <Input type="date" value={form.recurrenceUntil} onChange={(e) => set("recurrenceUntil", e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Objekt (optional)</Label>
              <Select value={form.propertyId} onValueChange={(v) => set("propertyId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Kein Objekt</SelectItem>
                  {(propertiesData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mieter (optional)</Label>
              <Select value={form.tenantId} onValueChange={(v) => set("tenantId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Kein Mieter</SelectItem>
                  {(tenantsData?.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.type === "BESICHTIGUNG" && (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-sky-500/5 p-3">
              <div>
                <Label>Interessent</Label>
                <Input value={form.visitorName} onChange={(e) => set("visitorName", e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div>
                <Label>Telefon / E-Mail</Label>
                <Input value={form.visitorContact} onChange={(e) => set("visitorContact", e.target.value)} placeholder="+49 170 1234567" />
              </div>
            </div>
          )}

          <div>
            <Label>Notizen (optional)</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={pending || !form.title || !form.start}>
            {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: EventDetailDialog.tsx**

```tsx
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { useNavigate } from "react-router-dom";
import { Building2, User, Repeat, Bell, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteCalendarEvent, type CalendarEvent } from "@/hooks/api/useCalendarEvents";
import { EVENT_META, eventColor } from "./eventMeta";

const RECURRENCE_LABELS: Record<string, string> = {
  TAEGLICH: "Täglich", WOECHENTLICH: "Wöchentlich", MONATLICH: "Monatlich", JAEHRLICH: "Jährlich",
};

const REMINDER_LABELS: Record<number, string> = {
  60: "1 Stunde vorher", 1440: "1 Tag vorher", 4320: "3 Tage vorher", 10080: "1 Woche vorher",
};

/** Fallback für Alt-Besichtigungen: Daten aus dem Description-String parsen */
function parseLegacyBesichtigung(desc?: string | null): { visitorName?: string; visitorContact?: string } {
  if (!desc) return {};
  const out: { visitorName?: string; visitorContact?: string } = {};
  for (const part of desc.split(" | ")) {
    if (part.startsWith("Interessent: ")) out.visitorName = part.slice(13);
    if (part.startsWith("Tel: ")) out.visitorContact = part.slice(5);
  }
  return out;
}

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (e: CalendarEvent) => void;
}

export function EventDetailDialog({ event, onClose, onEdit }: Props) {
  const navigate = useNavigate();
  const deleteEvent = useDeleteCalendarEvent();

  if (!event) return null;

  const meta = EVENT_META[event.type];
  const isOwn = event.type === "MANUELL" || event.type === "BESICHTIGUNG";
  const isSeries = event.seriesId != null || event.recurrenceFreq != null;
  const legacy = event.type === "BESICHTIGUNG" && !event.visitorName ? parseLegacyBesichtigung(event.description) : {};
  const visitorName = event.visitorName ?? legacy.visitorName;
  const visitorContact = event.visitorContact ?? legacy.visitorContact;
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;

  const handleDelete = async () => {
    try {
      const id = event.seriesId ?? (event.id as number);
      await deleteEvent.mutateAsync(id);
      toast.success(isSeries ? "Serie gelöscht" : "Termin gelöscht");
      onClose();
    } catch {
      toast.error("Löschen fehlgeschlagen");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 text-white" style={{ backgroundColor: eventColor(event) }}>
              {meta.label}
            </Badge>
            {isSeries && event.recurrenceFreq && (
              <Badge variant="outline" className="gap-1">
                <Repeat className="h-3 w-3" />
                {RECURRENCE_LABELS[event.recurrenceFreq]}
                {(event.recurrenceInterval ?? 1) > 1 ? ` (alle ${event.recurrenceInterval})` : ""}
              </Badge>
            )}
            {event.reminderMinutes != null && (
              <Badge variant="outline" className="gap-1">
                <Bell className="h-3 w-3" /> {REMINDER_LABELS[event.reminderMinutes] ?? `${event.reminderMinutes} Min. vorher`}
              </Badge>
            )}
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Wann:</span>{" "}
              {event.allDay
                ? format(start, "EEEE, dd. MMMM yyyy", { locale: de }) + " (ganztägig)"
                : format(start, "EEEE, dd. MMMM yyyy HH:mm", { locale: de }) +
                  (end && end.getTime() !== start.getTime() ? ` – ${format(end, "HH:mm")}` : "")}
            </p>
            {event.property && (
              <p className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">Objekt:</span> {event.property.name}
              </p>
            )}
            {event.tenant && (
              <p className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">Mieter:</span> {event.tenant.name}
              </p>
            )}
            {visitorName && (
              <p><span className="font-medium text-foreground">Interessent:</span> {visitorName}</p>
            )}
            {visitorContact && (
              <p><span className="font-medium text-foreground">Kontakt:</span> {visitorContact}</p>
            )}
            {event.description && !event.description.includes("Interessent: ") && (
              <p><span className="font-medium text-foreground">Notizen:</span> {event.description}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isOwn ? (
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                    {deleteEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{isSeries ? "Ganze Serie löschen?" : "Termin löschen?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isSeries
                        ? "Alle Termine dieser Serie werden unwiderruflich gelöscht."
                        : "Der Termin wird unwiderruflich gelöscht."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(event)}>
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Button>
            </div>
          ) : meta.link ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(meta.link!)}>
              <ExternalLink className="h-4 w-4" /> Zur {meta.label}-Übersicht
            </Button>
          ) : <span />}
          <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Calendar.tsx komplett ersetzen**

```tsx
import { useState, useMemo } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import {
  format, parse, startOfWeek, getDay,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
} from "date-fns";
import { de } from "date-fns/locale/de";
import "react-big-calendar/lib/css/react-big-calendar.css";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "@/components/calendar/calendar-theme.css";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCalendarEvents, useUpdateCalendarEvent, downloadIcal, type CalendarEvent } from "@/hooks/api/useCalendarEvents";
import { ALL_EVENT_TYPES, type EventType } from "@/components/calendar/eventMeta";
import { EventPill, type RbcEvent } from "@/components/calendar/EventPill";
import { CalendarToolbar, type CalendarViewKey } from "@/components/calendar/CalendarToolbar";
import { CalendarAgenda } from "@/components/calendar/CalendarAgenda";
import { EventDialog } from "@/components/calendar/EventDialog";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";

const FILTER_KEY = "calendarTypeFilters";

const locales = { de };
const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay, locales,
});

const DnDCalendar = withDragAndDrop(Calendar) as typeof Calendar;

function loadFilters(): Set<EventType> {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return new Set(JSON.parse(raw) as EventType[]);
  } catch { /* ignore */ }
  return new Set(ALL_EVENT_TYPES);
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewKey>("month");
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(loadFilters);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [icalLoading, setIcalLoading] = useState(false);

  const from = subMonths(currentDate, 1);
  const to = addMonths(currentDate, 2);
  const { data, isLoading } = useCalendarEvents(from, to);
  const updateEvent = useUpdateCalendarEvent();

  const toggleType = (t: EventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      localStorage.setItem(FILTER_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.data ?? []).filter(
      (e) => activeTypes.has(e.type) && (!q || e.title.toLowerCase().includes(q))
    );
  }, [data, activeTypes, search]);

  const rbcEvents: RbcEvent[] = useMemo(
    () =>
      filtered.map((e) => {
        const start = new Date(e.start);
        const end = e.end ? new Date(e.end) : start;
        return { id: e.id, title: e.title, start, end, allDay: e.allDay, resource: e };
      }),
    [filtered]
  );

  const upcoming = useMemo(
    () => filtered.filter((e) => new Date(e.start) >= new Date()).slice(0, 30),
    [filtered]
  );

  const handleNavigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) { setCurrentDate(new Date()); return; }
    const fn =
      view === "day" ? (dir === 1 ? addDays : subDays)
      : view === "week" ? (dir === 1 ? addWeeks : subWeeks)
      : (dir === 1 ? addMonths : subMonths);
    setCurrentDate(fn(currentDate, 1));
  };

  const handleIcal = async () => {
    setIcalLoading(true);
    try { await downloadIcal(); toast.success("iCal exportiert"); }
    catch { toast.error("iCal-Export fehlgeschlagen"); }
    finally { setIcalLoading(false); }
  };

  const handleEventDrop = ({ event, start, end }: { event: RbcEvent; start: string | Date; end: string | Date }) => {
    const res = event.resource;
    if (res.type !== "MANUELL" && res.type !== "BESICHTIGUNG") return;
    if (res.seriesId != null) {
      toast.info("Serientermine bitte über Bearbeiten verschieben");
      return;
    }
    updateEvent.mutate({
      id: res.id as number,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
  };

  const openEdit = (e: CalendarEvent) => {
    setSelectedEvent(null);
    setEditEvent(e);
    setDialogOpen(true);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Kalender</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <CalendarToolbar
          date={currentDate}
          view={view}
          activeTypes={activeTypes}
          search={search}
          icalLoading={icalLoading}
          onNavigate={handleNavigate}
          onView={setView}
          onToggleType={toggleType}
          onSearch={setSearch}
          onIcal={handleIcal}
          onNewEvent={() => { setEditEvent(null); setDialogOpen(true); }}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : view === "agenda" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <CalendarAgenda events={upcoming} onSelect={setSelectedEvent} />
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <DnDCalendar
              localizer={localizer}
              events={rbcEvents}
              view={view as View}
              date={currentDate}
              onNavigate={setCurrentDate}
              onView={(v) => setView(v as CalendarViewKey)}
              culture="de"
              style={{ height: "100%" }}
              toolbar={false}
              popup
              components={{ event: EventPill as never }}
              onSelectEvent={(event) => setSelectedEvent((event as RbcEvent).resource)}
              onEventDrop={handleEventDrop as never}
              draggableAccessor={(event) => {
                const res = (event as RbcEvent).resource;
                return (res.type === "MANUELL" || res.type === "BESICHTIGUNG") && res.seriesId == null;
              }}
              resizable={false}
            />
          </div>
        )}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-96 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Demnächst</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CalendarAgenda
              events={upcoming}
              onSelect={(e) => { setDrawerOpen(false); setSelectedEvent(e); }}
              emptyText="Keine anstehenden Termine"
            />
          </div>
        </SheetContent>
      </Sheet>

      <EventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} onEdit={openEdit} />
      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} editEvent={editEvent} />
    </div>
  );
}
```

- [ ] **Step 4: tsc prüfen**

Run: `cd cozy-estate-central; npx tsc --noEmit`
Expected: exit 0 (Typ-Fehler hier sofort beheben, insbesondere rbc-Generics — `as never`-Casts wie im Altcode sind akzeptiert)

- [ ] **Step 5: Commit**

```bash
git add cozy-estate-central/src/components/calendar cozy-estate-central/src/pages/Calendar.tsx
git commit -m "feat(frontend): calendar redesign — toolbar filters, agenda, edit/delete, event dialog"
```

---

### Task 12: Gesamtverifikation + Doku

**Files:**
- Modify: `PROJEKTDOKUMENTATION.md`

- [ ] **Step 1: Alle Backend-Tests**

Run: `cd backend; npx vitest run --pool=forks --no-file-parallelism --testTimeout=120000; npx tsc --noEmit`
Expected: alle Suiten grün (153 alte + neue), tsc exit 0. (health.test braucht laufende DB: `docker start immoverwaltung-db`)

- [ ] **Step 2: Frontend-Tests + tsc**

Run: `cd cozy-estate-central; npx vitest run --pool=forks --no-file-parallelism --testTimeout=120000; npx tsc --noEmit`
Expected: grün + exit 0

- [ ] **Step 3: Manueller Smoke-Test**

Backend (`npm run dev`) + Frontend (`npm run dev`) starten, als admin@immoverwalt.de einloggen, prüfen:
1. Kalender lädt, Filter-Chips blenden Typen aus/ein (überlebt Reload)
2. Termin mit Wiederholung „Wöchentlich" + Erinnerung „1 Tag vorher" + Objekt anlegen → Instanzen erscheinen mit ↻
3. Instanz anklicken → Detail zeigt Serie/Erinnerung/Objekt → Bearbeiten ändert die Serie → Löschen entfernt alle Instanzen
4. Auto-Event anklicken → Deep-Link-Button navigiert
5. Agenda-Ansicht + „Demnächst"-Drawer
6. Dark Mode umschalten → Kalender bleibt lesbar
7. Glocke: nach Scheduler-Lauf (Termin in <24h mit 1-Tag-Erinnerung anlegen, 5 Min warten oder Server neu starten) erscheint Badge + E-Mail-Logzeile

- [ ] **Step 4: PROJEKTDOKUMENTATION.md aktualisieren**

Neuen Changelog-Eintrag „2026-06-12: Kalender-Redesign" mit Features (Wiederholungen, Erinnerungen E-Mail+In-App, Notification-API, Filter/Agenda/Suche, Bearbeiten/Löschen, Objekt/Mieter-Verknüpfung) und neuen Endpunkten (`GET/PATCH/POST /api/notifications…`) ergänzen.

- [ ] **Step 5: Commit + Push**

```bash
git add PROJEKTDOKUMENTATION.md
git commit -m "docs: calendar redesign changelog"
git push origin master
```

Expected: CI grün (gh run watch).
