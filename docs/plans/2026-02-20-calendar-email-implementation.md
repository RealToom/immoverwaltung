# Kalender + E-Mail-Integration + Anfragen-Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Kalender mit automatischen & manuellen Terminen, IMAP/SMTP-Postfach mit KI-Termin-Parsing (Claude Haiku), und Anfragen-Verwaltung für Interessenten aus Immobilienportalen.

**Architecture:** IMAP-Polling alle 5 Min via setInterval (wie bestehender Retention-Cleanup). Neue E-Mails werden in DB gecacht, Claude Haiku analysiert sie auf Terminangaben und Immobilien-Anfragen. Frontend: 3 neue Seiten (Kalender, Postfach, Anfragen) + Settings-Tab.

**Tech Stack:** Backend: `imap-simple`, `mailparser`, Claude Haiku (bereits via `@anthropic-ai/sdk`). Frontend: `react-big-calendar`, `date-fns`.

---

## Task 1: DB-Schema — 4 neue Models

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Enums und Models ans Ende von schema.prisma anhängen**

Füge folgende Blöcke ans Ende der Datei (nach dem letzten `@@map`):

```prisma
// ─── CalendarEvent (Kalender) ────────────────────────────────
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
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@map("calendar_events")
}

enum CalendarEventType {
  MANUELL
  AUTO_VERTRAG
  AUTO_WARTUNG
  AUTO_MIETE
  AUTO_EMAIL
}

// ─── EmailAccount (Verbundene Postfächer) ────────────────────
model EmailAccount {
  id                Int       @id @default(autoincrement())
  label             String
  email             String
  imapHost          String    @map("imap_host")
  imapPort          Int       @map("imap_port")
  imapTls           Boolean   @default(true) @map("imap_tls")
  imapUser          String    @map("imap_user")
  encryptedPassword String    @map("encrypted_password")
  smtpHost          String    @map("smtp_host")
  smtpPort          Int       @map("smtp_port")
  smtpTls           Boolean   @default(true) @map("smtp_tls")
  lastSync          DateTime? @map("last_sync")
  isActive          Boolean   @default(true) @map("is_active")
  companyId         Int       @map("company_id")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  company  Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  messages EmailMessage[]

  @@index([companyId])
  @@map("email_accounts")
}

// ─── EmailMessage (Posteingang-Cache) ────────────────────────
model EmailMessage {
  id               Int            @id @default(autoincrement())
  messageId        String         @unique @map("message_id")
  fromAddress      String         @map("from_address")
  fromName         String?        @map("from_name")
  toAddress        String         @map("to_address")
  subject          String
  bodyText         String?        @map("body_text")
  bodyHtml         String?        @map("body_html")
  receivedAt       DateTime       @map("received_at")
  isRead           Boolean        @default(false) @map("is_read")
  isInquiry        Boolean        @default(false) @map("is_inquiry")
  inquiryStatus    InquiryStatus? @map("inquiry_status")
  suggestedEventId Int?           @map("suggested_event_id")
  emailAccountId   Int            @map("email_account_id")
  companyId        Int            @map("company_id")
  createdAt        DateTime       @default(now()) @map("created_at")

  emailAccount EmailAccount      @relation(fields: [emailAccountId], references: [id], onDelete: Cascade)
  company      Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  attachments  EmailAttachment[]

  @@index([companyId, isRead])
  @@index([companyId, isInquiry])
  @@map("email_messages")
}

enum InquiryStatus {
  NEU
  IN_BEARBEITUNG
  AKZEPTIERT
  ABGELEHNT
}

// ─── EmailAttachment (Anhänge) ───────────────────────────────
model EmailAttachment {
  id             Int          @id @default(autoincrement())
  filename       String
  mimeType       String       @map("mime_type")
  size           Int
  storedPath     String?      @map("stored_path")
  emailMessageId Int          @map("email_message_id")
  companyId      Int          @map("company_id")
  createdAt      DateTime     @default(now()) @map("created_at")

  emailMessage EmailMessage @relation(fields: [emailMessageId], references: [id], onDelete: Cascade)
  company      Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("email_attachments")
}
```

Außerdem in `model Company` die neuen Relationen ergänzen (nach `documents Document[]`):

```prisma
  calendarEvents  CalendarEvent[]
  emailAccounts   EmailAccount[]
  emailMessages   EmailMessage[]
  emailAttachments EmailAttachment[]
```

**Step 2: Migration ausführen**

```bash
cd backend
npm run db:migrate
# Prompt: "add_calendar_email_models"
```

Erwartete Ausgabe: `Your database is now in sync with your schema.`

**Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartete Ausgabe: kein Fehler

**Step 4: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add CalendarEvent, EmailAccount, EmailMessage, EmailAttachment models"
```

---

## Task 2: Crypto — String-Verschlüsselung für IMAP-Passwörter

**Files:**
- Modify: `backend/src/lib/crypto.ts`

**Step 1: `encryptString` und `decryptString` ans Ende von crypto.ts anhängen**

```typescript
/**
 * Encrypt a plain-text string (e.g. IMAP password) using AES-256-GCM.
 * Returns a base64-encoded string: [IV (16 bytes)] [AuthTag (16 bytes)] [Encrypted data]
 */
export function encryptString(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(plaintext, "utf8")),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64-encoded string produced by encryptString.
 */
export function decryptString(ciphertext: string): string {
    const key = getKey();
    const data = Buffer.from(ciphertext, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
```

**Step 2: Test schreiben** in `backend/src/test/crypto.test.ts` (Datei existiert bereits — prüfen ob Tests für `encryptFile` vorhanden sind, dann neuen Test ergänzen):

```typescript
describe("encryptString / decryptString", () => {
  it("round-trips a string correctly", () => {
    const original = "SuperGeheimesPasswort123!";
    const encrypted = encryptString(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const enc1 = encryptString("test");
    const enc2 = encryptString("test");
    expect(enc1).not.toBe(enc2);
  });
});
```

**Step 3: Test ausführen**

```bash
cd backend && npm test
```

Erwartete Ausgabe: alle Tests grün inklusive neue crypto-Tests

**Step 4: Commit**

```bash
git add backend/src/lib/crypto.ts backend/src/test/crypto.test.ts
git commit -m "feat: add encryptString/decryptString for IMAP password storage"
```

---

## Task 3: Backend — Kalender-API

**Files:**
- Create: `backend/src/schemas/calendar.schema.ts`
- Create: `backend/src/services/calendar.service.ts`
- Create: `backend/src/controllers/calendar.controller.ts`
- Create: `backend/src/routes/calendar.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Schema erstellen** (`backend/src/schemas/calendar.schema.ts`)

```typescript
import { z } from "zod";

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
  allDay: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const calendarQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
```

**Step 2: Service erstellen** (`backend/src/services/calendar.service.ts`)

```typescript
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

// Auto-generierte Events aus bestehenden Daten
async function getAutoEvents(companyId: number, from?: Date, to?: Date) {
  const dateFilter = from && to ? { gte: from, lte: to } : undefined;

  // Vertrags-Events: nextReminder + ablaufende Verträge
  const contracts = await prisma.contract.findMany({
    where: { companyId, ...(dateFilter ? { OR: [
      { nextReminder: dateFilter },
      { endDate: dateFilter },
    ]} : {}) },
    select: { id: true, nextReminder: true, reminderType: true, endDate: true,
              tenant: { select: { name: true } }, property: { select: { name: true } } },
  });

  // Wartungs-Events: dueDate
  const tickets = await prisma.maintenanceTicket.findMany({
    where: { companyId, dueDate: { not: null }, ...(dateFilter ? { dueDate: dateFilter } : {}), status: { not: "ERLEDIGT" } },
    select: { id: true, title: true, dueDate: true, priority: true },
  });

  // Mietzahlungs-Events: dueDate ausstehend
  const rentPayments = await prisma.rentPayment.findMany({
    where: { companyId, status: "AUSSTEHEND", ...(dateFilter ? { dueDate: dateFilter } : {}) },
    select: { id: true, dueDate: true, amountDue: true,
              contract: { select: { tenant: { select: { name: true } } } } },
  });

  const autoEvents: object[] = [];

  for (const c of contracts) {
    if (c.nextReminder) {
      autoEvents.push({
        id: `contract-reminder-${c.id}`, title: `Erinnerung: ${c.tenant.name} – ${c.property.name}`,
        start: c.nextReminder, allDay: true, type: "AUTO_VERTRAG", sourceId: c.id, color: "#f97316",
      });
    }
    if (c.endDate) {
      autoEvents.push({
        id: `contract-end-${c.id}`, title: `Vertragsende: ${c.tenant.name}`,
        start: c.endDate, allDay: true, type: "AUTO_VERTRAG", sourceId: c.id, color: "#f97316",
      });
    }
  }

  for (const t of tickets) {
    if (t.dueDate) {
      autoEvents.push({
        id: `ticket-${t.id}`, title: `Wartung: ${t.title}`,
        start: t.dueDate, allDay: true, type: "AUTO_WARTUNG", sourceId: t.id, color: "#ef4444",
      });
    }
  }

  for (const r of rentPayments) {
    autoEvents.push({
      id: `rent-${r.id}`, title: `Mieteingang fällig: ${r.contract.tenant.name}`,
      start: r.dueDate, allDay: true, type: "AUTO_MIETE", sourceId: r.id, color: "#22c55e",
    });
  }

  return autoEvents;
}

export async function listEvents(companyId: number, from?: Date, to?: Date) {
  const dateFilter = from && to ? { start: { gte: from, lte: to } } : {};

  const manual = await prisma.calendarEvent.findMany({
    where: { companyId, ...dateFilter },
    orderBy: { start: "asc" },
  });

  const auto = await getAutoEvents(companyId, from, to);
  return [...manual, ...auto];
}

export async function createEvent(companyId: number, userId: number, data: {
  title: string; description?: string; start: Date; end?: Date; allDay?: boolean; color?: string;
}) {
  return prisma.calendarEvent.create({
    data: { ...data, companyId, createdByUserId: userId, type: "MANUELL" },
  });
}

export async function updateEvent(companyId: number, id: number, data: Partial<{
  title: string; description: string; start: Date; end: Date; allDay: boolean; color: string;
}>) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError("Termin nicht gefunden", 404);
  if (event.type !== "MANUELL" && event.type !== "AUTO_EMAIL") {
    throw new AppError("Nur manuelle Termine können bearbeitet werden", 403);
  }
  return prisma.calendarEvent.update({ where: { id }, data });
}

export async function deleteEvent(companyId: number, id: number) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError("Termin nicht gefunden", 404);
  if (event.type !== "MANUELL") throw new AppError("Nur manuelle Termine können gelöscht werden", 403);
  await prisma.calendarEvent.delete({ where: { id } });
}
```

**Step 3: Controller erstellen** (`backend/src/controllers/calendar.controller.ts`)

```typescript
import type { Request, Response } from "express";
import * as calendarService from "../services/calendar.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;
  const events = await calendarService.listEvents(req.companyId!, from, to);
  res.json({ data: events });
}

export async function create(req: Request, res: Response): Promise<void> {
  const event = await calendarService.createEvent(req.companyId!, req.userId!, req.body);
  res.status(201).json({ data: event });
}

export async function update(req: Request, res: Response): Promise<void> {
  const event = await calendarService.updateEvent(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: event });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await calendarService.deleteEvent(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
```

> **Hinweis:** `req.userId` muss im Auth-Middleware-Typ verfügbar sein. Prüfe `backend/src/types/express.d.ts` — falls `userId` fehlt, ergänze es dort analog zu `companyId`.

**Step 4: Routes erstellen** (`backend/src/routes/calendar.routes.ts`)

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { createCalendarEventSchema, updateCalendarEventSchema, calendarQuerySchema } from "../schemas/calendar.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/calendar.controller.js";

const router = Router();

router.get("/", validate({ query: calendarQuerySchema }), ctrl.list);
router.post("/", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ body: createCalendarEventSchema }), ctrl.create);
router.patch("/:id", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ params: idParamSchema, body: updateCalendarEventSchema }), ctrl.update);
router.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

export { router as calendarRouter };
```

**Step 5: In index.ts registrieren**

In `backend/src/routes/index.ts` ergänzen:

```typescript
import { calendarRouter } from "./calendar.routes.js";
// ...
router.use("/calendar", requireAuth, tenantGuard, calendarRouter);
```

**Step 6: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

**Step 7: Manuell testen** (Backend läuft via `npm run dev`)

```bash
# Login token holen, dann:
curl -X POST http://localhost:3001/api/calendar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Testtermin","start":"2026-03-01T10:00:00Z","allDay":false}'
# Erwartet: 201 mit neuem CalendarEvent
```

**Step 8: Commit**

```bash
git add backend/src/schemas/calendar.schema.ts backend/src/services/calendar.service.ts \
        backend/src/controllers/calendar.controller.ts backend/src/routes/calendar.routes.ts \
        backend/src/routes/index.ts
git commit -m "feat: calendar API — CRUD + auto-events from contracts/maintenance/rent"
```

---

## Task 4: Backend — EmailAccount API

**Files:**
- Create: `backend/src/schemas/email-account.schema.ts`
- Create: `backend/src/services/email-account.service.ts`
- Create: `backend/src/controllers/email-account.controller.ts`
- Create: `backend/src/routes/email-account.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: npm-Pakete installieren**

```bash
cd backend
npm install imap-simple mailparser
npm install --save-dev @types/mailparser
```

**Step 2: Schema** (`backend/src/schemas/email-account.schema.ts`)

```typescript
import { z } from "zod";

export const createEmailAccountSchema = z.object({
  label: z.string().min(1).max(100),
  email: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapTls: z.boolean().default(true),
  imapUser: z.string().min(1),
  password: z.string().min(1),   // plain-text, wird vor Speichern verschlüsselt
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpTls: z.boolean().default(true),
});

export const updateEmailAccountSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(1).optional(),
});
```

**Step 3: Service** (`backend/src/services/email-account.service.ts`)

```typescript
import imaps from "imap-simple";
import { prisma } from "../lib/prisma.js";
import { encryptString, decryptString } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listAccounts(companyId: number) {
  return prisma.emailAccount.findMany({
    where: { companyId },
    select: { id: true, label: true, email: true, imapHost: true, imapPort: true,
              smtpHost: true, smtpPort: true, isActive: true, lastSync: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function testImapConnection(config: {
  host: string; port: number; tls: boolean; user: string; password: string;
}): Promise<void> {
  const connection = await imaps.connect({
    imap: { host: config.host, port: config.port, tls: config.tls,
            user: config.user, password: config.password, authTimeout: 5000 },
  });
  await connection.end();
}

export async function createAccount(companyId: number, data: {
  label: string; email: string; imapHost: string; imapPort: number; imapTls: boolean;
  imapUser: string; password: string; smtpHost: string; smtpPort: number; smtpTls: boolean;
}) {
  // IMAP-Verbindung testen vor dem Speichern
  try {
    await testImapConnection({ host: data.imapHost, port: data.imapPort,
                               tls: data.imapTls, user: data.imapUser, password: data.password });
  } catch (err) {
    logger.warn({ err }, "IMAP-Verbindungstest fehlgeschlagen");
    throw new AppError("IMAP-Verbindung fehlgeschlagen. Bitte Zugangsdaten prüfen.", 400);
  }

  const { password, ...rest } = data;
  return prisma.emailAccount.create({
    data: { ...rest, encryptedPassword: encryptString(password), companyId },
  });
}

export async function updateAccount(companyId: number, id: number, data: {
  label?: string; isActive?: boolean; password?: string;
}) {
  const account = await prisma.emailAccount.findFirst({ where: { id, companyId } });
  if (!account) throw new AppError("Postfach nicht gefunden", 404);

  const { password, ...rest } = data;
  return prisma.emailAccount.update({
    where: { id },
    data: { ...rest, ...(password ? { encryptedPassword: encryptString(password) } : {}) },
  });
}

export async function deleteAccount(companyId: number, id: number) {
  const account = await prisma.emailAccount.findFirst({ where: { id, companyId } });
  if (!account) throw new AppError("Postfach nicht gefunden", 404);
  await prisma.emailAccount.delete({ where: { id } });
}

export async function getDecryptedPassword(accountId: number): Promise<string> {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Postfach nicht gefunden", 404);
  return decryptString(account.encryptedPassword);
}
```

**Step 4: Controller** (`backend/src/controllers/email-account.controller.ts`)

```typescript
import type { Request, Response } from "express";
import * as svc from "../services/email-account.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.listAccounts(req.companyId!) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const account = await svc.createAccount(req.companyId!, req.body);
  res.status(201).json({ data: account });
}

export async function update(req: Request, res: Response): Promise<void> {
  const account = await svc.updateAccount(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: account });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteAccount(req.companyId!, Number(req.params.id));
  res.status(204).end();
}

export async function syncNow(req: Request, res: Response): Promise<void> {
  // Importiert sync-Service (wird in Task 5 implementiert)
  const { syncAccount } = await import("../services/imap-sync.service.js");
  await syncAccount(Number(req.params.id), req.companyId!);
  res.json({ message: "Sync ausgelöst" });
}
```

**Step 5: Routes** (`backend/src/routes/email-account.routes.ts`)

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { createEmailAccountSchema, updateEmailAccountSchema } from "../schemas/email-account.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/email-account.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post("/", requireRole("ADMIN", "VERWALTER"), validate({ body: createEmailAccountSchema }), ctrl.create);
router.patch("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema, body: updateEmailAccountSchema }), ctrl.update);
router.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);
router.post("/:id/sync", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.syncNow);

export { router as emailAccountRouter };
```

**Step 6: In index.ts registrieren**

```typescript
import { emailAccountRouter } from "./email-account.routes.js";
// ...
router.use("/email-accounts", requireAuth, tenantGuard, emailAccountRouter);
```

**Step 7: Commit**

```bash
git add backend/src/schemas/email-account.schema.ts backend/src/services/email-account.service.ts \
        backend/src/controllers/email-account.controller.ts backend/src/routes/email-account.routes.ts \
        backend/src/routes/index.ts
git commit -m "feat: email account API — CRUD with IMAP connection test + encrypted password storage"
```

---

## Task 5: Backend — IMAP-Sync-Service + KI-Analyse

**Files:**
- Create: `backend/src/services/imap-sync.service.ts`
- Modify: `backend/src/services/retention.service.ts`

**Step 1: IMAP-Sync-Service erstellen** (`backend/src/services/imap-sync.service.ts`)

```typescript
import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { decryptString } from "../lib/crypto.js";
import { env } from "../config/env.js";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten
let syncTimer: ReturnType<typeof setInterval> | null = null;

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface AiAnalysisResult {
  hasAppointment: boolean;
  appointmentTitle?: string;
  appointmentDate?: string; // ISO string
  isInquiry: boolean;
}

async function analyzeEmailWithAi(subject: string, bodyText: string): Promise<AiAnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) return { hasAppointment: false, isInquiry: false };

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Analysiere diese E-Mail und antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text darum):
{
  "hasAppointment": boolean,
  "appointmentTitle": string or null,
  "appointmentDate": "ISO-8601-Datum" or null,
  "isInquiry": boolean
}

isInquiry=true wenn die Mail eine Wohnungsanfrage/Besichtigungswunsch von einem Interessenten ist.
hasAppointment=true wenn ein konkreter Termin mit Datum/Uhrzeit genannt wird.

Betreff: ${subject}
Text: ${bodyText.slice(0, 1000)}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    return JSON.parse(text) as AiAnalysisResult;
  } catch (err) {
    logger.warn({ err }, "[IMAP-SYNC] KI-Analyse fehlgeschlagen, übersprungen");
    return { hasAppointment: false, isInquiry: false };
  }
}

export async function syncAccount(accountId: number, companyId: number): Promise<void> {
  const account = await prisma.emailAccount.findFirst({ where: { id: accountId, companyId, isActive: true } });
  if (!account) return;

  const password = decryptString(account.encryptedPassword);

  let connection: Awaited<ReturnType<typeof imaps.connect>> | null = null;
  try {
    connection = await imaps.connect({
      imap: { host: account.imapHost, port: account.imapPort, tls: account.imapTls,
              user: account.imapUser, password, authTimeout: 10000 },
    });

    await connection.openBox("INBOX");

    // Nur neue Nachrichten seit letztem Sync
    const since = account.lastSync ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // max 7 Tage zurück
    const searchCriteria = [["SINCE", since.toUTCString()]];
    const fetchOptions = { bodies: ["HEADER", "TEXT", ""], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);
    logger.info({ accountId, count: messages.length }, "[IMAP-SYNC] Neue Nachrichten gefunden");

    for (const msg of messages) {
      const allParts = imaps.getParts(msg.attributes.struct ?? []);
      const fullBody = msg.parts.find((p) => p.which === "");

      if (!fullBody) continue;

      const parsed = await simpleParser(fullBody.body as string);
      const messageId = (parsed.messageId ?? `${accountId}-${msg.attributes.uid}`);

      // Duplikat-Schutz
      const exists = await prisma.emailMessage.findUnique({ where: { messageId } });
      if (exists) continue;

      const bodyText = parsed.text ?? "";
      const subject = parsed.subject ?? "(kein Betreff)";

      // KI-Analyse
      const ai = await analyzeEmailWithAi(subject, bodyText);

      // E-Mail in DB speichern
      const emailMsg = await prisma.emailMessage.create({
        data: {
          messageId,
          fromAddress: parsed.from?.value[0]?.address ?? "",
          fromName: parsed.from?.value[0]?.name ?? null,
          toAddress: account.email,
          subject,
          bodyText: bodyText.slice(0, 50000),
          bodyHtml: (parsed.html || null)?.slice(0, 200000) ?? null,
          receivedAt: parsed.date ?? new Date(),
          isInquiry: ai.isInquiry,
          inquiryStatus: ai.isInquiry ? "NEU" : null,
          emailAccountId: accountId,
          companyId,
        },
      });

      // KI-Terminvorschlag: CalendarEvent anlegen
      if (ai.hasAppointment && ai.appointmentDate) {
        const event = await prisma.calendarEvent.create({
          data: {
            title: ai.appointmentTitle ?? subject,
            description: `Aus E-Mail von ${emailMsg.fromAddress}: ${subject}`,
            start: new Date(ai.appointmentDate),
            type: "AUTO_EMAIL",
            color: "#8b5cf6",
            companyId,
            sourceId: emailMsg.id,
          },
        });
        // Verknüpfung setzen
        await prisma.emailMessage.update({
          where: { id: emailMsg.id },
          data: { suggestedEventId: event.id },
        });
      }

      // Anhänge speichern (nur Metadaten, keine Dateien)
      for (const attachment of parsed.attachments ?? []) {
        await prisma.emailAttachment.create({
          data: {
            filename: attachment.filename ?? "Anhang",
            mimeType: attachment.contentType,
            size: attachment.size ?? 0,
            emailMessageId: emailMsg.id,
            companyId,
          },
        });
      }
    }

    await prisma.emailAccount.update({ where: { id: accountId }, data: { lastSync: new Date() } });
    logger.info({ accountId, processed: messages.length }, "[IMAP-SYNC] Account synchronisiert");
  } catch (err) {
    logger.error({ err, accountId }, "[IMAP-SYNC] Fehler beim Sync");
  } finally {
    if (connection) {
      try { await connection.end(); } catch { /* ignorieren */ }
    }
  }
}

export async function syncAllAccounts(): Promise<void> {
  const accounts = await prisma.emailAccount.findMany({ where: { isActive: true }, select: { id: true, companyId: true } });
  for (const acc of accounts) {
    await syncAccount(acc.id, acc.companyId);
  }
}

export function startImapSync(): void {
  // Sofort einmal ausführen
  syncAllAccounts().catch((err) => logger.error({ err }, "[IMAP-SYNC] Fehler beim initialen Sync"));

  syncTimer = setInterval(() => {
    syncAllAccounts().catch((err) => logger.error({ err }, "[IMAP-SYNC] Fehler beim periodischen Sync"));
  }, SYNC_INTERVAL_MS);

  logger.info("IMAP-Sync gestartet (Intervall: 5 Min)");
}

export function stopImapSync(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}
```

**Step 2: In retention.service.ts einbinden**

In `backend/src/services/retention.service.ts`, in `startRetentionCleanup()` ergänzen:

```typescript
import { startImapSync, stopImapSync } from "./imap-sync.service.js";

// In startRetentionCleanup():
export function startRetentionCleanup(): void {
  // ... bestehender Code ...
  startImapSync(); // NEU
}

export function stopRetentionCleanup(): void {
  // ... bestehender Code ...
  stopImapSync(); // NEU
}
```

**Step 3: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add backend/src/services/imap-sync.service.ts backend/src/services/retention.service.ts
git commit -m "feat: IMAP sync service with 5-min polling + Claude Haiku AI analysis (appointments + inquiries)"
```

---

## Task 6: Backend — EmailMessage API (Reply, Dokument senden)

**Files:**
- Create: `backend/src/schemas/email-message.schema.ts`
- Create: `backend/src/services/email-message.service.ts`
- Create: `backend/src/controllers/email-message.controller.ts`
- Create: `backend/src/routes/email-message.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Schema** (`backend/src/schemas/email-message.schema.ts`)

```typescript
import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const emailMessageQuerySchema = paginationSchema.extend({
  accountId: z.coerce.number().int().positive().optional(),
  isRead: z.enum(["true", "false"]).optional(),
  isInquiry: z.enum(["true", "false"]).optional(),
  inquiryStatus: z.enum(["NEU", "IN_BEARBEITUNG", "AKZEPTIERT", "ABGELEHNT"]).optional(),
});

export const updateEmailMessageSchema = z.object({
  isRead: z.boolean().optional(),
  isInquiry: z.boolean().optional(),
  inquiryStatus: z.enum(["NEU", "IN_BEARBEITUNG", "AKZEPTIERT", "ABGELEHNT"]).optional(),
});

export const replyEmailSchema = z.object({
  body: z.string().min(1).max(50000),
});

export const sendDocumentSchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().max(5000).default("Im Anhang finden Sie das angeforderte Dokument."),
});

export const createEventFromEmailSchema = z.object({
  title: z.string().min(1).max(200),
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
  allDay: z.boolean().default(false),
});
```

**Step 2: Service** (`backend/src/services/email-message.service.ts`)

```typescript
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { decryptString, decryptFile } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

export async function listMessages(companyId: number, opts: {
  page: number; limit: number; accountId?: number;
  isRead?: boolean; isInquiry?: boolean; inquiryStatus?: string;
}) {
  const where = {
    companyId,
    ...(opts.accountId ? { emailAccountId: opts.accountId } : {}),
    ...(opts.isRead !== undefined ? { isRead: opts.isRead } : {}),
    ...(opts.isInquiry !== undefined ? { isInquiry: opts.isInquiry } : {}),
    ...(opts.inquiryStatus ? { inquiryStatus: opts.inquiryStatus as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.emailMessage.findMany({
      where, orderBy: { receivedAt: "desc" },
      skip: (opts.page - 1) * opts.limit, take: opts.limit,
      select: { id: true, fromAddress: true, fromName: true, subject: true, receivedAt: true,
                isRead: true, isInquiry: true, inquiryStatus: true, suggestedEventId: true,
                attachments: { select: { id: true, filename: true, mimeType: true, size: true } } },
    }),
    prisma.emailMessage.count({ where }),
  ]);

  return { data, meta: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) } };
}

export async function getMessage(companyId: number, id: number) {
  const msg = await prisma.emailMessage.findFirst({
    where: { id, companyId },
    include: { attachments: true, emailAccount: { select: { email: true, label: true } } },
  });
  if (!msg) throw new AppError("Nachricht nicht gefunden", 404);
  return msg;
}

export async function updateMessage(companyId: number, id: number, data: {
  isRead?: boolean; isInquiry?: boolean; inquiryStatus?: string;
}) {
  const msg = await prisma.emailMessage.findFirst({ where: { id, companyId } });
  if (!msg) throw new AppError("Nachricht nicht gefunden", 404);
  return prisma.emailMessage.update({ where: { id }, data: data as never });
}

async function getSmtpTransport(accountId: number) {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Postfach nicht gefunden", 404);
  const password = decryptString(account.encryptedPassword);
  return {
    transport: nodemailer.createTransport({
      host: account.smtpHost, port: account.smtpPort,
      secure: account.smtpTls, auth: { user: account.imapUser, pass: password },
    }),
    fromEmail: account.email,
  };
}

export async function replyToMessage(companyId: number, messageId: number, body: string) {
  const msg = await getMessage(companyId, messageId);
  const { transport, fromEmail } = await getSmtpTransport(msg.emailAccountId);

  await transport.sendMail({
    from: fromEmail,
    to: msg.fromAddress,
    subject: `Re: ${msg.subject}`,
    text: body,
  });

  logger.info({ messageId, to: msg.fromAddress }, "[EMAIL] Antwort gesendet");
}

export async function sendDocument(companyId: number, messageId: number, documentId: number, body: string) {
  const [msg, doc] = await Promise.all([
    getMessage(companyId, messageId),
    prisma.document.findFirst({ where: { id: documentId, companyId } }),
  ]);
  if (!doc) throw new AppError("Dokument nicht gefunden", 404);

  const { transport, fromEmail } = await getSmtpTransport(msg.emailAccountId);

  const attachmentContent = doc.isEncrypted && doc.filePath
    ? decryptFile(doc.filePath)
    : doc.filePath ? require("node:fs").readFileSync(doc.filePath) : null;

  await transport.sendMail({
    from: fromEmail,
    to: msg.fromAddress,
    subject: `Re: ${msg.subject}`,
    text: body,
    ...(attachmentContent ? { attachments: [{ filename: doc.name, content: attachmentContent }] } : {}),
  });

  logger.info({ messageId, documentId, to: msg.fromAddress }, "[EMAIL] Dokument gesendet");
}

export async function createEventFromEmail(companyId: number, userId: number, messageId: number, data: {
  title: string; start: Date; end?: Date; allDay?: boolean;
}) {
  const msg = await prisma.emailMessage.findFirst({ where: { id: messageId, companyId } });
  if (!msg) throw new AppError("Nachricht nicht gefunden", 404);

  // Alten Vorschlag löschen falls vorhanden
  if (msg.suggestedEventId) {
    await prisma.calendarEvent.deleteMany({ where: { id: msg.suggestedEventId } });
  }

  const event = await prisma.calendarEvent.create({
    data: { ...data, type: "AUTO_EMAIL", color: "#3b82f6", companyId, createdByUserId: userId, sourceId: messageId },
  });
  await prisma.emailMessage.update({ where: { id: messageId }, data: { suggestedEventId: event.id } });
  return event;
}
```

**Step 3: Controller** (`backend/src/controllers/email-message.controller.ts`)

```typescript
import type { Request, Response } from "express";
import * as svc from "../services/email-message.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await svc.listMessages(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    accountId: req.query.accountId ? Number(req.query.accountId) : undefined,
    isRead: req.query.isRead === "true" ? true : req.query.isRead === "false" ? false : undefined,
    isInquiry: req.query.isInquiry === "true" ? true : req.query.isInquiry === "false" ? false : undefined,
    inquiryStatus: req.query.inquiryStatus as string | undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.getMessage(req.companyId!, Number(req.params.id)) });
}

export async function update(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.updateMessage(req.companyId!, Number(req.params.id), req.body) });
}

export async function reply(req: Request, res: Response): Promise<void> {
  await svc.replyToMessage(req.companyId!, Number(req.params.id), req.body.body);
  res.json({ message: "Antwort gesendet" });
}

export async function sendDocument(req: Request, res: Response): Promise<void> {
  await svc.sendDocument(req.companyId!, Number(req.params.id), req.body.documentId, req.body.body);
  res.json({ message: "Dokument gesendet" });
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  const event = await svc.createEventFromEmail(req.companyId!, req.userId!, Number(req.params.id), req.body);
  res.status(201).json({ data: event });
}
```

**Step 4: Routes** (`backend/src/routes/email-message.routes.ts`)

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { emailMessageQuerySchema, updateEmailMessageSchema,
         replyEmailSchema, sendDocumentSchema, createEventFromEmailSchema } from "../schemas/email-message.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/email-message.controller.js";

const router = Router();

router.get("/", validate({ query: emailMessageQuerySchema }), ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.patch("/:id", validate({ params: idParamSchema, body: updateEmailMessageSchema }), ctrl.update);
router.post("/:id/reply", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: replyEmailSchema }), ctrl.reply);
router.post("/:id/send-document", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: sendDocumentSchema }), ctrl.sendDocument);
router.post("/:id/create-event", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: createEventFromEmailSchema }), ctrl.createEvent);

export { router as emailMessageRouter };
```

**Step 5: In index.ts registrieren**

```typescript
import { emailMessageRouter } from "./email-message.routes.js";
// ...
router.use("/email-messages", requireAuth, tenantGuard, emailMessageRouter);
```

**Step 6: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/schemas/email-message.schema.ts backend/src/services/email-message.service.ts \
        backend/src/controllers/email-message.controller.ts backend/src/routes/email-message.routes.ts \
        backend/src/routes/index.ts
git commit -m "feat: email message API — list, reply, send-document, create-event-from-email"
```

---

## Task 7: Frontend — Pakete installieren + API-Hooks

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useCalendarEvents.ts`
- Create: `cozy-estate-central/src/hooks/api/useEmailAccounts.ts`
- Create: `cozy-estate-central/src/hooks/api/useEmailMessages.ts`

**Step 1: Pakete installieren**

```bash
cd cozy-estate-central
npm install react-big-calendar date-fns
npm install --save-dev @types/react-big-calendar
```

**Step 2: Hook — Kalender** (`cozy-estate-central/src/hooks/api/useCalendarEvents.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  type: "MANUELL" | "AUTO_VERTRAG" | "AUTO_WARTUNG" | "AUTO_MIETE" | "AUTO_EMAIL";
  color?: string;
  sourceId?: number;
  description?: string;
}

export function useCalendarEvents(from?: Date, to?: Date) {
  return useQuery({
    queryKey: ["calendar-events", from?.toISOString(), to?.toISOString()],
    queryFn: () => api<{ data: CalendarEvent[] }>("/calendar", {
      params: { from: from?.toISOString(), to: to?.toISOString() },
    }),
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api("/calendar", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api(`/calendar/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/calendar/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}
```

**Step 3: Hook — EmailAccount** (`cozy-estate-central/src/hooks/api/useEmailAccounts.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EmailAccount {
  id: number; label: string; email: string; imapHost: string; imapPort: number;
  smtpHost: string; smtpPort: number; isActive: boolean; lastSync: string | null;
}

export function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => api<{ data: EmailAccount[] }>("/email-accounts"),
  });
}

export function useCreateEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api("/email-accounts", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-accounts"] }),
  });
}

export function useDeleteEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/email-accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-accounts"] }),
  });
}

export function useSyncEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/email-accounts/${id}/sync`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-messages"] }),
  });
}
```

**Step 4: Hook — EmailMessage** (`cozy-estate-central/src/hooks/api/useEmailMessages.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EmailMessage {
  id: number; fromAddress: string; fromName: string | null; subject: string;
  receivedAt: string; isRead: boolean; isInquiry: boolean;
  inquiryStatus: "NEU" | "IN_BEARBEITUNG" | "AKZEPTIERT" | "ABGELEHNT" | null;
  suggestedEventId: number | null;
  attachments: { id: number; filename: string; mimeType: string; size: number }[];
  bodyText?: string; bodyHtml?: string;
}

export function useEmailMessages(opts?: {
  accountId?: number; isRead?: boolean; isInquiry?: boolean;
  inquiryStatus?: string; page?: number;
}) {
  return useQuery({
    queryKey: ["email-messages", opts],
    queryFn: () => api<{ data: EmailMessage[]; meta: { total: number; totalPages: number } }>(
      "/email-messages",
      { params: { ...opts, isRead: opts?.isRead?.toString(), isInquiry: opts?.isInquiry?.toString() } }
    ),
  });
}

export function useEmailMessage(id: number) {
  return useQuery({
    queryKey: ["email-message", id],
    queryFn: () => api<{ data: EmailMessage & { bodyHtml: string; bodyText: string } }>(`/email-messages/${id}`),
    enabled: !!id,
  });
}

export function useUpdateEmailMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api(`/email-messages/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-messages"] });
      qc.invalidateQueries({ queryKey: ["email-message"] });
    },
  });
}

export function useReplyEmail() {
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api(`/email-messages/${id}/reply`, { method: "POST", body: { body } }),
  });
}

export function useSendDocument() {
  return useMutation({
    mutationFn: ({ id, documentId, body }: { id: number; documentId: number; body: string }) =>
      api(`/email-messages/${id}/send-document`, { method: "POST", body: { documentId, body } }),
  });
}

export function useCreateEventFromEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api(`/email-messages/${id}/create-event`, { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}
```

**Step 5: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useCalendarEvents.ts \
        cozy-estate-central/src/hooks/api/useEmailAccounts.ts \
        cozy-estate-central/src/hooks/api/useEmailMessages.ts
git commit -m "feat: React Query hooks for calendar, email accounts, email messages"
```

---

## Task 8: Frontend — Kalender-Seite

**Files:**
- Create: `cozy-estate-central/src/pages/Calendar.tsx`
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

**Step 1: Kalender-Seite erstellen** (`cozy-estate-central/src/pages/Calendar.tsx`)

Vollständige Seite mit:
- `react-big-calendar` (Monat-/Woche-/Tagesansicht)
- Deutsche Lokalisierung via `date-fns/locale/de`
- Farbcodierung nach Event-Typ
- "Kommende Termine"-Panel rechts
- Dialog für neuen manuellen Termin
- KI-Vorschlag-Dialog (bestätigen/verwerfen)

```tsx
import { useState, useMemo } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale/de";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent } from "@/hooks/api/useCalendarEvents";
import { toast } from "sonner";

const locales = { de };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales });

const EVENT_COLORS: Record<string, string> = {
  MANUELL: "#3b82f6",
  AUTO_VERTRAG: "#f97316",
  AUTO_WARTUNG: "#ef4444",
  AUTO_MIETE: "#22c55e",
  AUTO_EMAIL: "#8b5cf6",
};

const EVENT_LABELS: Record<string, string> = {
  MANUELL: "Manuell", AUTO_VERTRAG: "Vertrag", AUTO_WARTUNG: "Wartung",
  AUTO_MIETE: "Mietzahlung", AUTO_EMAIL: "Aus E-Mail",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");

  const from = subMonths(currentDate, 1);
  const to = addMonths(currentDate, 2);
  const { data, isLoading } = useCalendarEvents(from, to);
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const events = useMemo(() =>
    (data?.data ?? []).map((e) => ({
      ...e,
      start: new Date(e.start),
      end: e.end ? new Date(e.end) : new Date(e.start),
      resource: e,
    })), [data]);

  const upcoming = useMemo(() =>
    (data?.data ?? [])
      .filter((e) => new Date(e.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 8), [data]);

  const handleCreate = async () => {
    if (!newTitle || !newStart) return;
    try {
      await createEvent.mutateAsync({ title: newTitle, start: new Date(newStart).toISOString(), allDay: true });
      toast.success("Termin erstellt");
      setNewEventOpen(false);
      setNewTitle(""); setNewStart("");
    } catch { toast.error("Fehler beim Erstellen"); }
  };

  const eventStyleGetter = (event: { resource: { type: string; color?: string } }) => ({
    style: {
      backgroundColor: event.resource.color ?? EVENT_COLORS[event.resource.type] ?? "#6b7280",
      borderRadius: "3px", border: "none", fontSize: "11px", padding: "2px 4px",
    },
  });

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Kalender</span>
      </header>

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Kalender */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-base min-w-40 text-center">
                {format(currentDate, "MMMM yyyy", { locale: de })}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Heute</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border overflow-hidden">
                {(["month", "week", "day"] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-sm ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    {{ month: "Monat", week: "Woche", day: "Tag" }[v as string]}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => setNewEventOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Neuer Termin
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <Calendar localizer={localizer} events={events} view={view} date={currentDate}
                onNavigate={setCurrentDate} onView={setView}
                eventPropGetter={eventStyleGetter as never}
                onSelectEvent={(e) => setSelectedEvent(e as never)}
                culture="de" style={{ height: "100%" }} toolbar={false} />
            </div>
          )}

          {/* Legende */}
          <div className="flex gap-4 mt-2 flex-wrap">
            {Object.entries(EVENT_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EVENT_COLORS[type] }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Panel */}
        <div className="w-64 border-l p-4 overflow-y-auto flex flex-col gap-3">
          <p className="text-sm font-semibold">Kommende Termine</p>
          {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Keine Termine</p>}
          {upcoming.map((e) => (
            <div key={e.id} className="rounded-md border p-2.5 text-xs flex flex-col gap-1"
              style={{ borderLeftColor: e.color ?? EVENT_COLORS[e.type], borderLeftWidth: 3 }}>
              <span className="font-medium line-clamp-2">{e.title}</span>
              <span className="text-muted-foreground">{format(new Date(e.start), "dd.MM.yyyy", { locale: de })}</span>
              {e.type === "AUTO_EMAIL" && (
                <Badge variant="outline" className="text-purple-600 border-purple-300 w-fit text-[10px]">KI-Vorschlag</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Neuer Termin Dialog */}
      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Termin</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div><Label>Titel</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Terminbezeichnung" /></div>
            <div><Label>Datum</Label><Input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewEventOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createEvent.isPending || !newTitle || !newStart}>
              {createEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Route in App.tsx ergänzen**

In `cozy-estate-central/src/App.tsx` die neue Seite importieren und Route hinzufügen:

```tsx
import CalendarPage from "./pages/Calendar";
// Im Router, innerhalb von <ProtectedRoute>:
<Route path="/calendar" element={<CalendarPage />} />
```

**Step 3: Sidebar erweitern** in `cozy-estate-central/src/components/AppSidebar.tsx`

Einen neuen Navigationsbereich "Kommunikation" nach `mainNav` hinzufügen:

```typescript
import { Calendar, Mail, Inbox } from "lucide-react";

const kommunikationNav = [
  { title: "Kalender", url: "/calendar", icon: Calendar },
  { title: "Postfach", url: "/postfach", icon: Mail },
  { title: "Anfragen", url: "/anfragen", icon: Inbox },
];
```

Und im JSX einen neuen `<SidebarGroup>` Block analog zu den bestehenden einfügen.

**Step 4: Commit**

```bash
git add cozy-estate-central/src/pages/Calendar.tsx \
        cozy-estate-central/src/App.tsx \
        cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat: calendar page with react-big-calendar, color-coded events, upcoming panel"
```

---

## Task 9: Frontend — Postfach-Seite

**Files:**
- Create: `cozy-estate-central/src/pages/Postfach.tsx`
- Modify: `cozy-estate-central/src/App.tsx`

**Step 1: Seite erstellen** (`cozy-estate-central/src/pages/Postfach.tsx`)

Zwei-Spalten-Layout (360px Liste + fill Detail):

```tsx
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Reply, Calendar, FileText, Sparkles, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEmailMessages, useEmailMessage, useUpdateEmailMessage, useReplyEmail, useCreateEventFromEmail } from "@/hooks/api/useEmailMessages";
import { formatDate } from "@/lib/mappings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Filter = "alle" | "ungelesen" | "anfragen";

export default function Postfach() {
  const [filter, setFilter] = useState<Filter>("alle");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");

  const isReadFilter = filter === "ungelesen" ? false : undefined;
  const isInquiryFilter = filter === "anfragen" ? true : undefined;

  const { data: listData, isLoading } = useEmailMessages({
    isRead: isReadFilter, isInquiry: isInquiryFilter, limit: 50,
  });
  const { data: detailData } = useEmailMessage(selectedId ?? 0);
  const updateMsg = useUpdateEmailMessage();
  const replyEmail = useReplyEmail();
  const createEvent = useCreateEventFromEmail();

  const messages = listData?.data ?? [];
  const detail = detailData?.data;

  const handleSelect = (id: number) => {
    setSelectedId(id);
    updateMsg.mutate({ id, isRead: true });
  };

  const handleReply = async () => {
    if (!selectedId || !replyBody) return;
    try {
      await replyEmail.mutateAsync({ id: selectedId, body: replyBody });
      toast.success("Antwort gesendet");
      setReplyOpen(false); setReplyBody("");
    } catch { toast.error("Fehler beim Senden"); }
  };

  const handleCreateEvent = async () => {
    if (!selectedId || !eventTitle || !eventStart) return;
    try {
      await createEvent.mutateAsync({ id: selectedId, title: eventTitle, start: new Date(eventStart).toISOString(), allDay: false });
      toast.success("Termin erstellt");
      setEventDialogOpen(false);
    } catch { toast.error("Fehler"); }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "ungelesen", label: "Ungelesen" },
    { key: "anfragen", label: "Anfragen" },
  ];

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Postfach</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* E-Mail-Liste */}
        <div className="w-[360px] border-r flex flex-col shrink-0">
          <div className="p-3 border-b flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {filters.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                    filter === f.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}
            {messages.map((msg) => (
              <button key={msg.id} onClick={() => handleSelect(msg.id)} className={cn(
                "w-full text-left p-3 border-b hover:bg-muted/50 transition-colors",
                selectedId === msg.id && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}>
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <span className={cn("text-sm font-medium truncate", !msg.isRead && "font-bold")}>
                    {msg.fromName ?? msg.fromAddress}
                  </span>
                  <span className="text-xs shrink-0 opacity-70">
                    {formatDate(msg.receivedAt)}
                  </span>
                </div>
                <p className="text-xs truncate opacity-90 mb-0.5">{msg.subject}</p>
                {msg.isInquiry && (
                  <Badge variant="secondary" className="text-[10px] h-4">Anfrage</Badge>
                )}
              </button>
            ))}
            {!isLoading && messages.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Keine Nachrichten</p>
            )}
          </div>
        </div>

        {/* Detail */}
        {detail ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b flex flex-col gap-3">
              <h2 className="font-semibold text-lg">{detail.subject}</h2>
              <p className="text-sm text-muted-foreground">
                Von: {detail.fromName ? `${detail.fromName} <${detail.fromAddress}>` : detail.fromAddress}
                {" · "}{formatDate(detail.receivedAt)}
              </p>
              {/* Aktionsleiste */}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setReplyOpen(true)}>
                  <Reply className="h-4 w-4 mr-1" /> Antworten
                </Button>
                <Button size="sm" onClick={() => { setEventTitle(detail.subject); setEventDialogOpen(true); }}>
                  <Calendar className="h-4 w-4 mr-1" /> Termin erstellen
                </Button>
                <Button size="sm" variant="outline">
                  <FileText className="h-4 w-4 mr-1" /> Dokument senden
                </Button>
              </div>

              {/* KI-Terminvorschlag */}
              {detail.suggestedEventId && (
                <div className="flex items-center justify-between p-3 rounded-md bg-purple-50 border border-purple-200 dark:bg-purple-950/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">KI-Terminvorschlag erkannt</p>
                      <p className="text-xs text-purple-600">Termin wurde automatisch im Kalender vorgemerkt</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline"><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>

            {/* E-Mail-Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {detail.bodyHtml ? (
                <iframe
                  srcDoc={detail.bodyHtml}
                  sandbox="allow-same-origin"
                  className="w-full h-full border-0"
                  title="E-Mail-Inhalt"
                />
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans">{detail.bodyText}</pre>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            E-Mail auswählen
          </div>
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Antworten</DialogTitle></DialogHeader>
          <div><Label>Nachricht</Label><Textarea rows={6} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Abbrechen</Button>
            <Button onClick={handleReply} disabled={replyEmail.isPending}>
              {replyEmail.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Termin-Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Termin erstellen</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label>Titel</Label><Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} /></div>
            <div><Label>Datum & Uhrzeit</Label><Input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateEvent} disabled={createEvent.isPending}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Route ergänzen** in `App.tsx`:

```tsx
import Postfach from "./pages/Postfach";
<Route path="/postfach" element={<Postfach />} />
```

**Step 3: Commit**

```bash
git add cozy-estate-central/src/pages/Postfach.tsx cozy-estate-central/src/App.tsx
git commit -m "feat: postfach page — inbox, detail view, AI appointment banner, reply dialog"
```

---

## Task 10: Frontend — Anfragen-Seite

**Files:**
- Create: `cozy-estate-central/src/pages/Anfragen.tsx`
- Modify: `cozy-estate-central/src/App.tsx`

**Step 1: Seite erstellen** (`cozy-estate-central/src/pages/Anfragen.tsx`)

```tsx
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEmailMessages, useUpdateEmailMessage } from "@/hooks/api/useEmailMessages";
import { formatDate } from "@/lib/mappings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InquiryStatus = "NEU" | "IN_BEARBEITUNG" | "AKZEPTIERT" | "ABGELEHNT";

const STATUS_CONFIG: Record<InquiryStatus, { label: string; className: string }> = {
  NEU:           { label: "Neu",           className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  IN_BEARBEITUNG:{ label: "In Bearbeitung",className: "bg-blue-100   text-blue-800   border-blue-200"   },
  AKZEPTIERT:    { label: "Akzeptiert",    className: "bg-green-100  text-green-800  border-green-200"  },
  ABGELEHNT:     { label: "Abgelehnt",     className: "bg-red-100    text-red-800    border-red-200"    },
};

type TabFilter = "ALLE" | InquiryStatus;

export default function Anfragen() {
  const [tab, setTab] = useState<TabFilter>("ALLE");
  const updateMsg = useUpdateEmailMessage();

  const { data, isLoading } = useEmailMessages({
    isInquiry: true,
    inquiryStatus: tab === "ALLE" ? undefined : tab,
    limit: 100,
  });

  const messages = data?.data ?? [];

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "ALLE", label: `Alle (${data?.meta?.total ?? 0})` },
    { key: "NEU", label: "Neu" },
    { key: "IN_BEARBEITUNG", label: "In Bearbeitung" },
    { key: "AKZEPTIERT", label: "Akzeptiert" },
    { key: "ABGELEHNT", label: "Abgelehnt" },
  ];

  const handleStatusChange = async (id: number, status: InquiryStatus) => {
    try {
      await updateMsg.mutateAsync({ id, inquiryStatus: status });
      toast.success("Status aktualisiert");
    } catch { toast.error("Fehler beim Speichern"); }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Anfragen</span>
      </header>

      <div className="flex flex-col flex-1 overflow-hidden p-6 gap-4">
        <div>
          <h1 className="text-xl font-bold">Anfragen</h1>
          <p className="text-sm text-muted-foreground">Interessentenanfragen aus Immobilienportalen</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors",
                tab === t.key ? "bg-background shadow-sm font-medium" : "hover:bg-background/50")}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tabelle */}
        <div className="rounded-lg border overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground w-52">Absender</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Betreff</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-28">Datum</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-36">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-44">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center p-8">
                  <Loader2 className="animate-spin inline-block" />
                </td></tr>
              )}
              {!isLoading && messages.length === 0 && (
                <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Keine Anfragen</td></tr>
              )}
              {messages.map((msg) => (
                <tr key={msg.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{msg.fromName ?? msg.fromAddress}</div>
                    <div className="text-xs text-muted-foreground">{msg.fromAddress}</div>
                  </td>
                  <td className="p-3 max-w-xs">
                    <span className="line-clamp-2">{msg.subject}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(msg.receivedAt)}</td>
                  <td className="p-3">
                    {msg.inquiryStatus && (
                      <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium",
                        STATUS_CONFIG[msg.inquiryStatus as InquiryStatus].className)}>
                        {STATUS_CONFIG[msg.inquiryStatus as InquiryStatus].label}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => window.location.href = `/postfach?selected=${msg.id}`}>
                        Öffnen
                      </Button>
                      {msg.inquiryStatus === "NEU" && (
                        <Button size="sm" className="h-7 text-xs"
                          onClick={() => handleStatusChange(msg.id, "IN_BEARBEITUNG")}>
                          Bearbeiten
                        </Button>
                      )}
                      {msg.inquiryStatus === "IN_BEARBEITUNG" && (
                        <>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => handleStatusChange(msg.id, "AKZEPTIERT")}>
                            Akzeptieren
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs"
                            onClick={() => handleStatusChange(msg.id, "ABGELEHNT")}>
                            Ablehnen
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Route ergänzen** in `App.tsx`:

```tsx
import Anfragen from "./pages/Anfragen";
<Route path="/anfragen" element={<Anfragen />} />
```

**Step 3: Commit**

```bash
git add cozy-estate-central/src/pages/Anfragen.tsx cozy-estate-central/src/App.tsx
git commit -m "feat: anfragen page — inquiry table with status tabs and workflow actions"
```

---

## Task 11: Frontend — Settings: Postfächer-Tab

**Files:**
- Modify: `cozy-estate-central/src/pages/Settings.tsx`

**Step 1: Neuen Tab "Postfächer" in Settings.tsx ergänzen**

In `Settings.tsx` den bestehenden Tab-Mechanismus erweitern. Den Tab-Trigger ergänzen:

```tsx
<TabsTrigger value="postfaecher">Postfächer</TabsTrigger>
```

Den Tab-Content ergänzen:

```tsx
import { useEmailAccounts, useCreateEmailAccount, useDeleteEmailAccount, useSyncEmailAccount } from "@/hooks/api/useEmailAccounts";

// Im TabsContent:
<TabsContent value="postfaecher">
  <Card>
    <CardHeader>
      <CardTitle>Verbundene Postfächer</CardTitle>
      <CardDescription>IMAP/SMTP-Konten für den integrierten Posteingang</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Liste der Konten */}
      {accounts?.data?.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="font-medium">{acc.label}</p>
            <p className="text-sm text-muted-foreground">{acc.email}</p>
            <p className="text-xs text-muted-foreground">
              Letzter Sync: {acc.lastSync ? formatDate(acc.lastSync) : "Noch nie"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => syncAccount.mutate(acc.id)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="destructive" onClick={() => deleteAccount.mutate(acc.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {/* Formular neues Postfach */}
      <Separator />
      <p className="font-medium text-sm">Postfach verbinden</p>
      {/* Felder: label, email, imapHost, imapPort, imapTls, imapUser, password, smtpHost, smtpPort, smtpTls */}
      {/* Submit-Button: "Verbinden & Testen" */}
    </CardContent>
  </Card>
</TabsContent>
```

> Die genaue Feldstruktur an den bestehenden Settings-Formular-Stil anlehnen (useState-Felder wie in den anderen Tabs).

**Step 2: Commit**

```bash
git add cozy-estate-central/src/pages/Settings.tsx
git commit -m "feat: settings postfächer tab — connect/test/delete IMAP accounts"
```

---

## Task 12: Abschluss — Abnahme & PROJEKTDOKUMENTATION

**Step 1: Alle Tests ausführen**

```bash
cd backend && npm test
cd ../cozy-estate-central && npm test
```

Alle Tests müssen grün sein.

**Step 2: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
cd ../cozy-estate-central && npx tsc --noEmit
```

**Step 3: Manuelle Smoke-Tests**

- [ ] Neues E-Mail-Konto in Settings verbinden → IMAP-Test erfolgreich
- [ ] E-Mail mit Terminangabe an verbundenes Konto senden → nach max. 5 Min erscheint KI-Vorschlag im Kalender
- [ ] Anfrage-Mail von Immoscout-Adresse → erscheint unter "Anfragen" mit Status "Neu"
- [ ] Manuellen Kalendertermin anlegen → erscheint sofort im Kalender
- [ ] Vertragsende aus bestehenden Daten → taucht als oranger Event im Kalender auf
- [ ] Auf E-Mail antworten → Absender erhält Antwort

**Step 4: PROJEKTDOKUMENTATION.md aktualisieren**

Neue Abschnitte ergänzen:
- Kalender-Feature (react-big-calendar, Auto-Events, KI-Events)
- E-Mail-Integration (IMAP/SMTP, Sync-Job, Claude Haiku)
- Anfragen-Portal

**Step 5: Final Commit**

```bash
git add PROJEKTDOKUMENTATION.md
git commit -m "docs: update PROJEKTDOKUMENTATION for calendar + email + inquiry features"
```
