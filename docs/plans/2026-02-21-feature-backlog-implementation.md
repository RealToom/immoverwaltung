# Feature Backlog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 7 features: Zählerstände (Ebene 1), Wiederkehrende Transaktionen, PDF-Export Nebenkostenabrechnung, Mahnwesen, Übergabeprotokoll, Wartungsplan, Dokumenten-Vorlagen.

**Architecture:** Backend-first (Prisma → Service → Controller → Route), dann Frontend (React Query Hook → Page/Tab). Alle neuen DB-Models haben `companyId`. PDF-Generierung via `pdfkit` im Backend, Download als Blob im Frontend.

**Tech Stack:** Node.js/Express 5/Prisma 6/TypeScript (Backend), React 18/React Query/Shadcn/UI (Frontend), `pdfkit` für PDF-Generierung.

**Roadmap (nicht implementieren):** Mieter-Portal — öffentliche URL für Mieter, Dokumente einsehen, Reparaturmeldung einreichen.

---

## Übersicht der Tasks

| Task | Feature | Typ |
|------|---------|-----|
| 1 | DB-Schema: 5 neue Models | Backend |
| 2 | Zähler-API (Meter + MeterReading) | Backend |
| 3 | Zählerstände-Frontend (PropertyDetail-Tab) | Frontend |
| 4 | Wiederkehrende Transaktionen API + Cron | Backend |
| 5 | Wiederkehrende Transaktionen Frontend | Frontend |
| 6 | PDF-Export Nebenkostenabrechnung | Backend |
| 7 | PDF-Download Button in PropertyDetail | Frontend |
| 8 | Mahnwesen API + E-Mail | Backend |
| 9 | Mahnwesen Frontend (Tenants-Seite) | Frontend |
| 10 | Übergabeprotokoll API | Backend |
| 11 | Übergabeprotokoll Frontend (PropertyDetail-Tab) | Frontend |
| 12 | Wartungsplan / Wiederkehrende Wartung API + Cron | Backend |
| 13 | Wartungsplan Frontend (Maintenance-Seite) | Frontend |
| 14 | Dokumenten-Vorlagen API | Backend |
| 15 | Dokumenten-Vorlagen Frontend | Frontend |
| 16 | PROJEKTDOKUMENTATION updaten | Docs |

---

## Task 1: DB-Schema — 5 neue Models

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Schema ergänzen**

Füge folgende Models und Enums am Ende von `backend/prisma/schema.prisma` hinzu (VOR dem letzten `AuditLog`-Block):

```prisma
// ─── Meter (Zähler) ─────────────────────────────────────────
model Meter {
  id         Int       @id @default(autoincrement())
  label      String                            // "Stromzähler EG", "Wasserzähler Keller"
  type       MeterType
  unitId     Int?      @map("unit_id")         // null = Hauptzähler des Gebäudes
  propertyId Int       @map("property_id")
  companyId  Int       @map("company_id")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  unit     Unit?         @relation(fields: [unitId], references: [id], onDelete: SetNull)
  property Property      @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  company  Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  readings MeterReading[]

  @@map("meters")
}

enum MeterType {
  STROM
  WASSER
  GAS
  WAERME
  SONSTIGES
}

model MeterReading {
  id        Int      @id @default(autoincrement())
  value     Float                               // Zählerstand in kWh / m³
  readAt    DateTime @map("read_at")
  note      String?
  meterId   Int      @map("meter_id")
  companyId Int      @map("company_id")
  createdAt DateTime @default(now()) @map("created_at")

  meter   Meter   @relation(fields: [meterId], references: [id], onDelete: Cascade)
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("meter_readings")
}

// ─── RecurringTransaction (Wiederkehrende Buchung) ───────────
model RecurringTransaction {
  id          Int             @id @default(autoincrement())
  description String
  type        TransactionType
  amount      Float
  category    String          @default("")
  allocatable Boolean         @default(false)
  interval    RecurringInterval
  dayOfMonth  Int             @default(1) @map("day_of_month") // 1-28
  startDate   DateTime        @map("start_date")
  endDate     DateTime?       @map("end_date")
  lastRun     DateTime?       @map("last_run")
  isActive    Boolean         @default(true) @map("is_active")
  propertyId  Int?            @map("property_id")
  companyId   Int             @map("company_id")
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  property Property? @relation(fields: [propertyId], references: [id])
  company  Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("recurring_transactions")
}

enum RecurringInterval {
  MONATLICH
  VIERTELJAEHRLICH
  HALBJAEHRLICH
  JAEHRLICH
}

// ─── DunningRecord (Mahnung) ─────────────────────────────────
model DunningRecord {
  id           Int           @id @default(autoincrement())
  level        Int           // 1, 2, 3
  sentAt       DateTime      @map("sent_at")
  dueDate      DateTime      @map("due_date")
  totalAmount  Float         @map("total_amount")
  status       DunningStatus @default(OFFEN)
  contractId   Int           @map("contract_id")
  companyId    Int           @map("company_id")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  contract Contract @relation(fields: [contractId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("dunning_records")
}

enum DunningStatus {
  OFFEN
  BEZAHLT
  STORNIERT
}

// ─── HandoverProtocol (Übergabeprotokoll) ────────────────────
model HandoverProtocol {
  id         Int          @id @default(autoincrement())
  type       HandoverType
  date       DateTime
  tenantName String       @map("tenant_name")
  notes      String?
  rooms      Json         @default("[]")  // Array of { name, condition, notes }
  meterData  Json         @default("[]")  // Array of { label, value, type }
  unitId     Int          @map("unit_id")
  companyId  Int          @map("company_id")
  createdAt  DateTime     @default(now()) @map("created_at")
  updatedAt  DateTime     @updatedAt @map("updated_at")

  unit    Unit    @relation(fields: [unitId], references: [id])
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("handover_protocols")
}

enum HandoverType {
  EINZUG
  AUSZUG
}

// ─── MaintenanceSchedule (Wartungsplan) ─────────────────────
model MaintenanceSchedule {
  id          Int                 @id @default(autoincrement())
  title       String
  description String              @default("")
  category    MaintenanceCategory
  interval    RecurringInterval
  lastDone    DateTime?           @map("last_done")
  nextDue     DateTime            @map("next_due")
  assignedTo  String?             @map("assigned_to")
  isActive    Boolean             @default(true) @map("is_active")
  propertyId  Int                 @map("property_id")
  companyId   Int                 @map("company_id")
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("maintenance_schedules")
}

// ─── DocumentTemplate (Dokumenten-Vorlage) ──────────────────
model DocumentTemplate {
  id        Int      @id @default(autoincrement())
  name      String
  category  String   @default("")  // "Mietvertrag", "Abmahnung", "Nebenkostenabrechnung"
  content   String                 // Handlebars-Template-String
  companyId Int      @map("company_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("document_templates")
}
```

Außerdem Relations auf `Company` ergänzen:
```prisma
// In model Company, nach bestehenden Relations:
  meters               Meter[]
  meterReadings        MeterReading[]
  recurringTransactions RecurringTransaction[]
  dunningRecords       DunningRecord[]
  handoverProtocols    HandoverProtocol[]
  maintenanceSchedules MaintenanceSchedule[]
  documentTemplates    DocumentTemplate[]
```

Relations auf `Unit` ergänzen:
```prisma
// In model Unit, nach bestehenden Relations:
  meters           Meter[]
  handoverProtocols HandoverProtocol[]
```

Relations auf `Property` ergänzen:
```prisma
// In model Property, nach bestehenden Relations:
  meters               Meter[]
  recurringTransactions RecurringTransaction[]
  maintenanceSchedules  MaintenanceSchedule[]
```

Relations auf `Contract` ergänzen:
```prisma
// In model Contract, nach bestehenden Relations:
  dunningRecords DunningRecord[]
```

**Step 2: Migration erstellen**

```bash
cd backend
npm run db:migrate
# Prompt: "add_meters_recurring_dunning_handover_schedule_templates"
```

Expected: `✔ Your database is now in sync with your schema.`

**Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: keine Ausgabe (kein Fehler)

**Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Meter, RecurringTransaction, DunningRecord, HandoverProtocol, MaintenanceSchedule, DocumentTemplate models"
```

---

## Task 2: Zähler-API (Meter + MeterReading)

**Files:**
- Create: `backend/src/schemas/meter.schema.ts`
- Create: `backend/src/services/meter.service.ts`
- Create: `backend/src/controllers/meter.controller.ts`
- Create: `backend/src/routes/meter.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Schema**

```typescript
// backend/src/schemas/meter.schema.ts
import { z } from "zod";

export const createMeterSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["STROM", "WASSER", "GAS", "WAERME", "SONSTIGES"]),
  unitId: z.number().int().optional(),
  propertyId: z.number().int(),
});

export const updateMeterSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(["STROM", "WASSER", "GAS", "WAERME", "SONSTIGES"]).optional(),
});

export const createMeterReadingSchema = z.object({
  value: z.number(),
  readAt: z.string().datetime(),
  note: z.string().optional(),
});
```

**Step 2: Service**

```typescript
// backend/src/services/meter.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listMeters(companyId: number, propertyId?: number) {
  return prisma.meter.findMany({
    where: { companyId, ...(propertyId ? { propertyId } : {}) },
    include: {
      unit: { select: { id: true, number: true } },
      readings: { orderBy: { readAt: "desc" }, take: 2 },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMeter(companyId: number, data: {
  label: string; type: string; propertyId: number; unitId?: number;
}) {
  return prisma.meter.create({ data: { ...data, type: data.type as never, companyId } });
}

export async function deleteMeter(companyId: number, id: number) {
  const meter = await prisma.meter.findFirst({ where: { id, companyId } });
  if (!meter) throw new AppError(404, "Zähler nicht gefunden");
  await prisma.meter.delete({ where: { id } });
}

export async function addReading(companyId: number, meterId: number, data: {
  value: number; readAt: string; note?: string;
}) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, companyId } });
  if (!meter) throw new AppError(404, "Zähler nicht gefunden");
  return prisma.meterReading.create({
    data: { ...data, readAt: new Date(data.readAt), meterId, companyId },
  });
}

export async function listReadings(companyId: number, meterId: number) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, companyId } });
  if (!meter) throw new AppError(404, "Zähler nicht gefunden");
  const readings = await prisma.meterReading.findMany({
    where: { meterId, companyId },
    orderBy: { readAt: "desc" },
  });
  // Berechne Verbrauch zwischen je zwei aufeinanderfolgenden Ablesungen
  return readings.map((r, i) => ({
    ...r,
    consumption: i < readings.length - 1 ? r.value - readings[i + 1].value : null,
  }));
}

export async function deleteReading(companyId: number, id: number) {
  const reading = await prisma.meterReading.findFirst({ where: { id, companyId } });
  if (!reading) throw new AppError(404, "Ablesung nicht gefunden");
  await prisma.meterReading.delete({ where: { id } });
}
```

**Step 3: Controller**

```typescript
// backend/src/controllers/meter.controller.ts
import type { Request, Response } from "express";
import * as svc from "../services/meter.service.js";

export async function list(req: Request, res: Response) {
  const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
  const data = await svc.listMeters(req.companyId!, propertyId);
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const data = await svc.createMeter(req.companyId!, req.body);
  res.status(201).json({ data });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteMeter(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}

export async function getReadings(req: Request, res: Response) {
  const data = await svc.listReadings(req.companyId!, Number(req.params.id));
  res.json({ data });
}

export async function addReading(req: Request, res: Response) {
  const data = await svc.addReading(req.companyId!, Number(req.params.id), req.body);
  res.status(201).json({ data });
}

export async function removeReading(req: Request, res: Response) {
  await svc.deleteReading(req.companyId!, Number(req.params.readingId));
  res.json({ data: { success: true } });
}
```

**Step 4: Routes**

```typescript
// backend/src/routes/meter.routes.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createMeterSchema, createMeterReadingSchema } from "../schemas/meter.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/meter.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ body: createMeterSchema }), ctrl.create);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);
router.get("/:id/readings", validate({ params: idParamSchema }), ctrl.getReadings);
router.post("/:id/readings", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: createMeterReadingSchema }), ctrl.addReading);
router.delete("/:id/readings/:readingId", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  ctrl.removeReading);

export { router as meterRouter };
```

**Step 5: In index.ts registrieren**

```typescript
// backend/src/routes/index.ts — füge hinzu:
import { meterRouter } from "./meter.routes.js";
// ...
router.use("/meters", requireAuth, tenantGuard, meterRouter);
```

**Step 6: TypeScript + Commit**

```bash
npx tsc --noEmit
git add backend/src/schemas/meter.schema.ts backend/src/services/meter.service.ts \
  backend/src/controllers/meter.controller.ts backend/src/routes/meter.routes.ts \
  backend/src/routes/index.ts
git commit -m "feat: meter + meter reading API (CRUD + consumption calc)"
```

---

## Task 3: Zählerstände-Frontend (PropertyDetail → neuer Tab)

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useMeters.ts`
- Modify: `cozy-estate-central/src/pages/PropertyDetail.tsx` (neuer Tab "Zähler")

**Step 1: Hook**

```typescript
// cozy-estate-central/src/hooks/api/useMeters.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Meter {
  id: number; label: string; type: string;
  unitId: number | null; propertyId: number;
  unit: { id: number; number: string } | null;
  readings: MeterReading[];
}

interface MeterReading {
  id: number; value: number; readAt: string;
  note: string | null; consumption: number | null;
}

export function useMeters(propertyId: number) {
  return useQuery({
    queryKey: ["meters", propertyId],
    queryFn: () => api<{ data: Meter[] }>(`/meters?propertyId=${propertyId}`).then(r => r.data),
  });
}

export function useMeterReadings(meterId: number) {
  return useQuery({
    queryKey: ["meter-readings", meterId],
    queryFn: () => api<{ data: MeterReading[] }>(`/meters/${meterId}/readings`).then(r => r.data),
  });
}

export function useCreateMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; type: string; propertyId: number; unitId?: number }) =>
      api<{ data: Meter }>("/meters", { method: "POST", body: JSON.stringify(data) }).then(r => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["meters", vars.propertyId] }),
  });
}

export function useAddMeterReading(meterId: number, propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { value: number; readAt: string; note?: string }) =>
      api<{ data: MeterReading }>(`/meters/${meterId}/readings`, {
        method: "POST", body: JSON.stringify(data),
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meter-readings", meterId] });
      qc.invalidateQueries({ queryKey: ["meters", propertyId] });
    },
  });
}

export function useDeleteMeter(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/meters/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meters", propertyId] }),
  });
}
```

**Step 2: PropertyDetail — Zähler-Tab hinzufügen**

Im `PropertyDetail.tsx` den bestehenden Tabs-Block suchen und einen "Zähler"-Tab ergänzen. Das Zähler-Tab zeigt:
- Liste aller Zähler der Immobilie (mit letztem Zählerstand + Verbrauch)
- "Zähler hinzufügen"-Button → Dialog (Label, Typ, Unit optional)
- Pro Zähler: "Ablesung hinzufügen"-Button → Dialog (Wert, Datum, Notiz)
- Tabelle der letzten Ablesungen mit Verbrauchsberechnung

```typescript
// MeterType Labels für das UI:
const METER_TYPE_LABELS: Record<string, string> = {
  STROM: "Strom (kWh)",
  WASSER: "Wasser (m³)",
  GAS: "Gas (m³)",
  WAERME: "Wärme (kWh)",
  SONSTIGES: "Sonstiges",
};
```

**Step 3: TypeScript + Commit**

```bash
cd cozy-estate-central && npx tsc --noEmit
git add cozy-estate-central/src/hooks/api/useMeters.ts \
  cozy-estate-central/src/pages/PropertyDetail.tsx
git commit -m "feat: Zählerstände-Tab in PropertyDetail mit Verbrauchsberechnung"
```

---

## Task 4: Wiederkehrende Transaktionen — Backend

**Files:**
- Create: `backend/src/schemas/recurring-transaction.schema.ts`
- Create: `backend/src/services/recurring-transaction.service.ts`
- Create: `backend/src/controllers/recurring-transaction.controller.ts`
- Create: `backend/src/routes/recurring-transaction.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/services/retention.service.ts` (Cron für tägliche Ausführung)

**Step 1: Schema**

```typescript
// backend/src/schemas/recurring-transaction.schema.ts
import { z } from "zod";

export const createRecurringSchema = z.object({
  description: z.string().min(1),
  type: z.enum(["EINNAHME", "AUSGABE"]),
  amount: z.number().positive().multipleOf(0.01),
  category: z.string().default(""),
  allocatable: z.boolean().default(false),
  interval: z.enum(["MONATLICH", "VIERTELJAEHRLICH", "HALBJAEHRLICH", "JAEHRLICH"]),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  propertyId: z.number().int().optional(),
});

export const updateRecurringSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().multipleOf(0.01).optional(),
  isActive: z.boolean().optional(),
  endDate: z.string().datetime().optional(),
});
```

**Step 2: Service**

```typescript
// backend/src/services/recurring-transaction.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listRecurring(companyId: number) {
  return prisma.recurringTransaction.findMany({
    where: { companyId },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRecurring(companyId: number, data: {
  description: string; type: string; amount: number; category: string;
  allocatable: boolean; interval: string; dayOfMonth: number;
  startDate: string; endDate?: string; propertyId?: number;
}) {
  return prisma.recurringTransaction.create({
    data: {
      ...data,
      type: data.type as never,
      interval: data.interval as never,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      companyId,
    },
  });
}

export async function updateRecurring(companyId: number, id: number, data: object) {
  const rec = await prisma.recurringTransaction.findFirst({ where: { id, companyId } });
  if (!rec) throw new AppError(404, "Wiederkehrende Buchung nicht gefunden");
  return prisma.recurringTransaction.update({ where: { id }, data: data as never });
}

export async function deleteRecurring(companyId: number, id: number) {
  const rec = await prisma.recurringTransaction.findFirst({ where: { id, companyId } });
  if (!rec) throw new AppError(404, "Wiederkehrende Buchung nicht gefunden");
  await prisma.recurringTransaction.delete({ where: { id } });
}

// Cron-Job: täglich prüfen ob Buchungen fällig sind
export async function processRecurringTransactions(): Promise<number> {
  const now = new Date();
  const active = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });

  let created = 0;
  for (const rec of active) {
    const shouldRun = isRecurringDue(rec, now);
    if (!shouldRun) continue;

    await prisma.transaction.create({
      data: {
        date: now,
        description: rec.description,
        type: rec.type,
        amount: rec.amount,
        category: rec.category,
        allocatable: rec.allocatable,
        propertyId: rec.propertyId,
        companyId: rec.companyId,
      },
    });
    await prisma.recurringTransaction.update({
      where: { id: rec.id },
      data: { lastRun: now },
    });
    created++;
  }

  if (created > 0) {
    logger.info({ count: created }, "[RECURRING] Wiederkehrende Buchungen erstellt");
  }
  return created;
}

function isRecurringDue(rec: {
  interval: string; dayOfMonth: number; lastRun: Date | null; startDate: Date;
}, now: Date): boolean {
  const today = now.getDate();
  if (today !== rec.dayOfMonth) return false;

  if (!rec.lastRun) return true; // Noch nie ausgeführt

  const last = rec.lastRun;
  const monthsDiff =
    (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth());

  const minMonths: Record<string, number> = {
    MONATLICH: 1,
    VIERTELJAEHRLICH: 3,
    HALBJAEHRLICH: 6,
    JAEHRLICH: 12,
  };

  return monthsDiff >= (minMonths[rec.interval] ?? 1);
}
```

**Step 3: Controller**

```typescript
// backend/src/controllers/recurring-transaction.controller.ts
import type { Request, Response } from "express";
import * as svc from "../services/recurring-transaction.service.js";

export async function list(req: Request, res: Response) {
  const data = await svc.listRecurring(req.companyId!);
  res.json({ data });
}
export async function create(req: Request, res: Response) {
  const data = await svc.createRecurring(req.companyId!, req.body);
  res.status(201).json({ data });
}
export async function update(req: Request, res: Response) {
  const data = await svc.updateRecurring(req.companyId!, Number(req.params.id), req.body);
  res.json({ data });
}
export async function remove(req: Request, res: Response) {
  await svc.deleteRecurring(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}
```

**Step 4: Routes**

```typescript
// backend/src/routes/recurring-transaction.routes.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createRecurringSchema, updateRecurringSchema } from "../schemas/recurring-transaction.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/recurring-transaction.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ body: createRecurringSchema }), ctrl.create);
router.patch("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: updateRecurringSchema }), ctrl.update);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);

export { router as recurringRouter };
```

**Step 5: In retention.service.ts einbinden**

```typescript
// backend/src/services/retention.service.ts — am Anfang importieren:
import { processRecurringTransactions } from "./recurring-transaction.service.js";

// In startRetentionCleanup() — täglicher Check via Intervall.
// Füge am Ende von startRetentionCleanup() hinzu:
// Täglich um 06:00 prüfen (via setInterval alle 1h ist bereits gesetzt,
// also einfach bei jedem stündlichen Lauf prüfen — isRecurringDue verhindert Doppelbuchung):
```

Ändere den bestehenden `setInterval`-Block so, dass er auch `processRecurringTransactions` aufruft:

```typescript
// In retention.service.ts, im setInterval-Block, ergänze:
processRecurringTransactions().catch((err) =>
  logger.error({ err }, "[RECURRING] Fehler beim Verarbeiten wiederkehrender Buchungen")
),
```

**Step 6: In index.ts registrieren**

```typescript
import { recurringRouter } from "./recurring-transaction.routes.js";
router.use("/recurring-transactions", requireAuth, tenantGuard, recurringRouter);
```

**Step 7: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/schemas/recurring-transaction.schema.ts \
  backend/src/services/recurring-transaction.service.ts \
  backend/src/controllers/recurring-transaction.controller.ts \
  backend/src/routes/recurring-transaction.routes.ts \
  backend/src/routes/index.ts \
  backend/src/services/retention.service.ts
git commit -m "feat: recurring transactions API + daily cron processing"
```

---

## Task 5: Wiederkehrende Transaktionen — Frontend

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useRecurringTransactions.ts`
- Modify: `cozy-estate-central/src/pages/Finances.tsx` (neuer Tab "Wiederkehrend")

**Step 1: Hook**

```typescript
// cozy-estate-central/src/hooks/api/useRecurringTransactions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface RecurringTransaction {
  id: number; description: string; type: "EINNAHME" | "AUSGABE";
  amount: number; category: string; allocatable: boolean;
  interval: string; dayOfMonth: number; startDate: string;
  endDate: string | null; lastRun: string | null; isActive: boolean;
  property: { id: number; name: string } | null;
}

export function useRecurringTransactions() {
  return useQuery({
    queryKey: ["recurring-transactions"],
    queryFn: () => api<{ data: RecurringTransaction[] }>("/recurring-transactions").then(r => r.data),
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      api<{ data: RecurringTransaction }>("/recurring-transactions", {
        method: "POST", body: JSON.stringify(data),
      }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & object) =>
      api<{ data: RecurringTransaction }>(`/recurring-transactions/${id}`, {
        method: "PATCH", body: JSON.stringify(data),
      }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/recurring-transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}
```

**Step 2: Finances.tsx — Tab "Wiederkehrend" hinzufügen**

Tabelle zeigt: Beschreibung, Typ (Badge), Betrag, Intervall, Tag d. Monats, Letzte Ausführung, Status (Aktiv/Inaktiv), Aktionen (Bearbeiten/Löschen).
Button "Neue wiederkehrende Buchung" → Dialog-Formular.

```typescript
// Labels:
const INTERVAL_LABELS: Record<string, string> = {
  MONATLICH: "Monatlich",
  VIERTELJAEHRLICH: "Vierteljährlich",
  HALBJAEHRLICH: "Halbjährlich",
  JAEHRLICH: "Jährlich",
};
```

**Step 3: TypeScript + Commit**

```bash
cd cozy-estate-central && npx tsc --noEmit
git add cozy-estate-central/src/hooks/api/useRecurringTransactions.ts \
  cozy-estate-central/src/pages/Finances.tsx
git commit -m "feat: wiederkehrende Transaktionen UI in Finances"
```

---

## Task 6: PDF-Export Nebenkostenabrechnung — Backend

**Files:**
- Install: `pdfkit` + `@types/pdfkit`
- Create: `backend/src/lib/pdf.ts`
- Modify: `backend/src/services/finance.service.ts` (oder neuen Service)
- Modify: `backend/src/routes/finance.routes.ts` (neuer Endpunkt)

**Step 1: pdfkit installieren**

```bash
cd backend
npm install pdfkit
npm install --save-dev @types/pdfkit
```

**Step 2: PDF-Hilfsfunktion**

```typescript
// backend/src/lib/pdf.ts
import PDFDocument from "pdfkit";
import type { Response } from "express";

export function createPdfResponse(res: Response, filename: string): PDFKit.PDFDocument {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
  );
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  return doc;
}
```

**Step 3: Endpunkt GET /api/finance/utility-statement/pdf**

Im bestehenden `finance.routes.ts` oder `finance.controller.ts` hinzufügen:

```typescript
// Neuer Endpunkt in finance.routes.ts:
router.get("/utility-statement/pdf",
  validate({ query: utilityStatementQuerySchema }), ctrl.utilityStatementPdf);
```

```typescript
// In finance.controller.ts:
export async function utilityStatementPdf(req: Request, res: Response) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const propertyId = Number(req.query.propertyId);
  const statement = await svc.getUtilityStatement(req.companyId!, propertyId, year);

  const doc = createPdfResponse(res, `Nebenkostenabrechnung_${year}`);

  doc.fontSize(20).text("Nebenkostenabrechnung", { align: "center" });
  doc.fontSize(12).text(`Jahr: ${year}`, { align: "center" });
  doc.moveDown();
  doc.text(`Immobilie: ${statement.property.name}`);
  doc.text(`Gesamtkosten: ${statement.totalCosts.toFixed(2)} €`);
  doc.text(`Gesamtfläche: ${statement.totalArea} m²`);
  doc.text(`Kosten pro m²: ${statement.costPerSqm.toFixed(2)} €`);
  doc.moveDown();

  // Tabelle: Kostenpositionen
  doc.fontSize(14).text("Kostenpositionen");
  doc.moveDown(0.5);
  for (const t of statement.transactions) {
    doc.fontSize(10).text(
      `${new Date(t.date).toLocaleDateString("de-DE")} — ${t.description}: ${t.amount.toFixed(2)} €`,
    );
  }
  doc.moveDown();

  // Tabelle: Einheiten
  doc.fontSize(14).text("Abrechnung pro Einheit");
  doc.moveDown(0.5);
  for (const u of statement.units) {
    doc.fontSize(10).text(
      `${u.number} (${u.area} m²): ${u.share.toFixed(2)} €`,
    );
  }

  doc.end();
}
```

**Step 4: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/lib/pdf.ts backend/src/routes/finance.routes.ts \
  backend/src/controllers/finance.controller.ts backend/package.json backend/package-lock.json
git commit -m "feat: PDF-Export für Nebenkostenabrechnung via pdfkit"
```

---

## Task 7: PDF-Download Button — Frontend

**Files:**
- Modify: `cozy-estate-central/src/pages/PropertyDetail.tsx` (Nebenkosten-Tab)

Im bestehenden Nebenkosten-Tab einen "PDF herunterladen"-Button hinzufügen:

```typescript
async function downloadPdf() {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(
    `/api/finance/utility-statement/pdf?propertyId=${property.id}&year=${selectedYear}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Nebenkostenabrechnung_${selectedYear}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

```bash
git add cozy-estate-central/src/pages/PropertyDetail.tsx
git commit -m "feat: PDF-Download Button für Nebenkostenabrechnung"
```

---

## Task 8: Mahnwesen — Backend

**Files:**
- Create: `backend/src/schemas/dunning.schema.ts`
- Create: `backend/src/services/dunning.service.ts`
- Create: `backend/src/controllers/dunning.controller.ts`
- Create: `backend/src/routes/dunning.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/services/retention.service.ts` (Cron)

**Step 1: Service**

```typescript
// backend/src/services/dunning.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { isEmailEnabled, sendMail } from "../config/email.js";

export async function listDunning(companyId: number, contractId?: number) {
  return prisma.dunningRecord.findMany({
    where: { companyId, ...(contractId ? { contractId } : {}) },
    include: {
      contract: {
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, number: true } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });
}

export async function sendDunning(companyId: number, contractId: number) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId },
    include: {
      tenant: true,
      property: true,
      dunningRecords: { where: { status: "OFFEN" }, orderBy: { level: "desc" }, take: 1 },
      rentPayments: { where: { status: { in: ["AUSSTEHEND", "VERSPAETET"] } } },
    },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");

  const overdueAmount = contract.rentPayments.reduce((sum, p) => sum + p.amountDue - p.amountPaid, 0);
  if (overdueAmount <= 0) throw new AppError(400, "Keine offenen Zahlungen vorhanden");

  const lastLevel = contract.dunningRecords[0]?.level ?? 0;
  if (lastLevel >= 3) throw new AppError(400, "Maximale Mahnstufe (3) bereits erreicht");

  const level = lastLevel + 1;
  const daysUntilDue = [14, 7, 5][level - 1];
  const dueDate = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);

  const record = await prisma.dunningRecord.create({
    data: {
      level, sentAt: new Date(), dueDate,
      totalAmount: overdueAmount,
      contractId, companyId,
    },
  });

  // E-Mail senden
  if (isEmailEnabled) {
    const levelLabels = ["", "Erste Mahnung", "Zweite Mahnung", "Letzte Mahnung"];
    await sendMail(
      contract.tenant.email,
      `${levelLabels[level]}: Ausstehende Mietzahlung`,
      `<p>Sehr geehrte/r ${contract.tenant.name},</p>
      <p>wir weisen Sie darauf hin, dass ein Betrag von <strong>${overdueAmount.toFixed(2)} €</strong>
      für ${contract.property.name} noch aussteht.</p>
      <p>Bitte begleichen Sie den Betrag bis zum ${dueDate.toLocaleDateString("de-DE")}.</p>`,
    );
    logger.info({ contractId, level, amount: overdueAmount }, "[MAHNWESEN] Mahnung versendet");
  }

  return record;
}

export async function resolveDunning(companyId: number, id: number) {
  const rec = await prisma.dunningRecord.findFirst({ where: { id, companyId } });
  if (!rec) throw new AppError(404, "Mahnung nicht gefunden");
  return prisma.dunningRecord.update({ where: { id }, data: { status: "BEZAHLT" } });
}

// Cron: täglich überfällige Zahlungen erkennen (AUSSTEHEND → VERSPAETET nach Fälligkeitsdatum)
export async function markOverduePayments(): Promise<number> {
  const { count } = await prisma.rentPayment.updateMany({
    where: { status: "AUSSTEHEND", dueDate: { lt: new Date() } },
    data: { status: "VERSPAETET" },
  });
  if (count > 0) logger.info({ count }, "[MAHNWESEN] Zahlungen als VERSPAETET markiert");
  return count;
}
```

**Step 2: Controller + Routes**

```typescript
// backend/src/controllers/dunning.controller.ts
import type { Request, Response } from "express";
import * as svc from "../services/dunning.service.js";

export async function list(req: Request, res: Response) {
  const contractId = req.query.contractId ? Number(req.query.contractId) : undefined;
  res.json({ data: await svc.listDunning(req.companyId!, contractId) });
}
export async function send(req: Request, res: Response) {
  res.status(201).json({ data: await svc.sendDunning(req.companyId!, Number(req.params.contractId)) });
}
export async function resolve(req: Request, res: Response) {
  res.json({ data: await svc.resolveDunning(req.companyId!, Number(req.params.id)) });
}
```

```typescript
// backend/src/routes/dunning.routes.ts
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/dunning.controller.js";

const router = Router();
router.get("/", ctrl.list);
router.post("/contracts/:contractId/send", apiLimiter,
  requireRole("ADMIN", "VERWALTER"), ctrl.send);
router.patch("/:id/resolve", apiLimiter,
  requireRole("ADMIN", "VERWALTER"), ctrl.resolve);
export { router as dunningRouter };
```

**Step 3: In retention.service.ts + index.ts einbinden**

In `retention.service.ts` im setInterval-Block:
```typescript
import { markOverduePayments } from "./dunning.service.js";
// Im setInterval:
markOverduePayments().catch((err) => logger.error({ err }, "[MAHNWESEN] Fehler")),
```

In `index.ts`:
```typescript
import { dunningRouter } from "./dunning.routes.js";
router.use("/dunning", requireAuth, tenantGuard, dunningRouter);
```

**Step 4: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/services/dunning.service.ts backend/src/controllers/dunning.controller.ts \
  backend/src/routes/dunning.routes.ts backend/src/routes/index.ts \
  backend/src/services/retention.service.ts
git commit -m "feat: Mahnwesen API — 3-stufige Mahnungen mit E-Mail + cron für VERSPAETET"
```

---

## Task 9: Mahnwesen — Frontend

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useDunning.ts`
- Modify: `cozy-estate-central/src/pages/Contracts.tsx` (Mahnung-Button + Badge)

**Step 1: Hook**

```typescript
// cozy-estate-central/src/hooks/api/useDunning.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDunning(contractId?: number) {
  return useQuery({
    queryKey: ["dunning", contractId],
    queryFn: () =>
      api<{ data: object[] }>(`/dunning${contractId ? `?contractId=${contractId}` : ""}`).then(r => r.data),
  });
}

export function useSendDunning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: number) =>
      api(`/dunning/contracts/${contractId}/send`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dunning"] }),
  });
}

export function useResolveDunning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/dunning/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dunning"] }),
  });
}
```

**Step 2: Contracts.tsx**

- In der Vertrags-Tabelle: Badge "Mahnung ausstehend" wenn `rentPayments` überfällig
- Aktionsmenü: "Mahnung senden" → `useSendDunning`
- Neuer Tab "Mahnungen" in Contracts-Seite: zeigt alle DunningRecords mit Status

**Step 3: TypeScript + Commit**

```bash
cd cozy-estate-central && npx tsc --noEmit
git add cozy-estate-central/src/hooks/api/useDunning.ts \
  cozy-estate-central/src/pages/Contracts.tsx
git commit -m "feat: Mahnwesen UI in Contracts — Mahnung senden + Status"
```

---

## Task 10: Übergabeprotokoll — Backend

**Files:**
- Create: `backend/src/schemas/handover.schema.ts`
- Create: `backend/src/services/handover.service.ts`
- Create: `backend/src/controllers/handover.controller.ts`
- Create: `backend/src/routes/handover.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Schema**

```typescript
// backend/src/schemas/handover.schema.ts
import { z } from "zod";

const roomSchema = z.object({
  name: z.string(),
  condition: z.enum(["GUT", "MAENGEL", "DEFEKT"]),
  notes: z.string().optional(),
});

const meterDataSchema = z.object({
  label: z.string(),
  value: z.number(),
  type: z.string(),
});

export const createHandoverSchema = z.object({
  type: z.enum(["EINZUG", "AUSZUG"]),
  date: z.string().datetime(),
  tenantName: z.string().min(1),
  notes: z.string().optional(),
  rooms: z.array(roomSchema).default([]),
  meterData: z.array(meterDataSchema).default([]),
  unitId: z.number().int(),
});
```

**Step 2: Service**

```typescript
// backend/src/services/handover.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { Prisma } from "@prisma/client";

export async function listHandovers(companyId: number, unitId?: number) {
  return prisma.handoverProtocol.findMany({
    where: { companyId, ...(unitId ? { unitId } : {}) },
    include: { unit: { select: { id: true, number: true } } },
    orderBy: { date: "desc" },
  });
}

export async function createHandover(companyId: number, data: {
  type: string; date: string; tenantName: string; notes?: string;
  rooms: object[]; meterData: object[]; unitId: number;
}) {
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId, property: { companyId } },
  });
  if (!unit) throw new AppError(404, "Einheit nicht gefunden");

  return prisma.handoverProtocol.create({
    data: {
      ...data,
      type: data.type as never,
      date: new Date(data.date),
      rooms: data.rooms as Prisma.InputJsonValue,
      meterData: data.meterData as Prisma.InputJsonValue,
      companyId,
    },
  });
}

export async function getHandover(companyId: number, id: number) {
  const h = await prisma.handoverProtocol.findFirst({ where: { id, companyId } });
  if (!h) throw new AppError(404, "Protokoll nicht gefunden");
  return h;
}

export async function deleteHandover(companyId: number, id: number) {
  const h = await prisma.handoverProtocol.findFirst({ where: { id, companyId } });
  if (!h) throw new AppError(404, "Protokoll nicht gefunden");
  await prisma.handoverProtocol.delete({ where: { id } });
}
```

**Step 3: Controller + Routes**

```typescript
// backend/src/controllers/handover.controller.ts
import type { Request, Response } from "express";
import * as svc from "../services/handover.service.js";

export async function list(req: Request, res: Response) {
  const unitId = req.query.unitId ? Number(req.query.unitId) : undefined;
  res.json({ data: await svc.listHandovers(req.companyId!, unitId) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await svc.createHandover(req.companyId!, req.body) });
}
export async function getById(req: Request, res: Response) {
  res.json({ data: await svc.getHandover(req.companyId!, Number(req.params.id)) });
}
export async function remove(req: Request, res: Response) {
  await svc.deleteHandover(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}
```

```typescript
// backend/src/routes/handover.routes.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createHandoverSchema } from "../schemas/handover.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/handover.controller.js";

const router = Router();
router.get("/", ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ body: createHandoverSchema }), ctrl.create);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);
export { router as handoverRouter };
```

In `index.ts`: `router.use("/handover-protocols", requireAuth, tenantGuard, handoverRouter);`

**Step 4: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/schemas/handover.schema.ts backend/src/services/handover.service.ts \
  backend/src/controllers/handover.controller.ts backend/src/routes/handover.routes.ts \
  backend/src/routes/index.ts
git commit -m "feat: Übergabeprotokoll API (Einzug/Auszug mit Raumzustand + Zählerständen)"
```

---

## Task 11: Übergabeprotokoll — Frontend

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useHandover.ts`
- Modify: `cozy-estate-central/src/pages/PropertyDetail.tsx` (neuer Tab "Protokolle")

**Step 1: Hook**

```typescript
// cozy-estate-central/src/hooks/api/useHandover.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useHandovers(unitId?: number) {
  return useQuery({
    queryKey: ["handovers", unitId],
    queryFn: () =>
      api<{ data: object[] }>(`/handover-protocols${unitId ? `?unitId=${unitId}` : ""}`).then(r => r.data),
  });
}

export function useCreateHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      api<{ data: object }>("/handover-protocols", {
        method: "POST", body: JSON.stringify(data),
      }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handovers"] }),
  });
}

export function useDeleteHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/handover-protocols/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handovers"] }),
  });
}
```

**Step 2: PropertyDetail — Tab "Protokolle"**

Tab zeigt:
- Liste aller Protokolle (Einzug/Auszug, Datum, Mieter)
- "Neues Protokoll"-Button → mehrstufiger Dialog:
  - Schritt 1: Typ (Einzug/Auszug), Datum, Mieter
  - Schritt 2: Raumliste (Name, Zustand, Notiz) — dynamisch erweiterbar
  - Schritt 3: Zählerstände erfassen
- Protokoll-Detail: Raumübersicht + Zählerstände anzeigen

**Step 3: TypeScript + Commit**

```bash
cd cozy-estate-central && npx tsc --noEmit
git add cozy-estate-central/src/hooks/api/useHandover.ts \
  cozy-estate-central/src/pages/PropertyDetail.tsx
git commit -m "feat: Übergabeprotokoll-Tab in PropertyDetail"
```

---

## Task 12: Wartungsplan — Backend

**Files:**
- Create: `backend/src/schemas/maintenance-schedule.schema.ts`
- Create: `backend/src/services/maintenance-schedule.service.ts`
- Create: `backend/src/controllers/maintenance-schedule.controller.ts`
- Create: `backend/src/routes/maintenance-schedule.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/services/retention.service.ts`

**Step 1: Schema**

```typescript
// backend/src/schemas/maintenance-schedule.schema.ts
import { z } from "zod";

export const createScheduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  category: z.enum(["SANITAER","ELEKTRIK","HEIZUNG","GEBAEUDE","AUSSENANLAGE","SONSTIGES"]),
  interval: z.enum(["MONATLICH","VIERTELJAEHRLICH","HALBJAEHRLICH","JAEHRLICH"]),
  nextDue: z.string().datetime(),
  assignedTo: z.string().optional(),
  propertyId: z.number().int(),
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  assignedTo: z.string().optional(),
  isActive: z.boolean().optional(),
  lastDone: z.string().datetime().optional(),
  nextDue: z.string().datetime().optional(),
});
```

**Step 2: Service**

```typescript
// backend/src/services/maintenance-schedule.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listSchedules(companyId: number, propertyId?: number) {
  return prisma.maintenanceSchedule.findMany({
    where: { companyId, ...(propertyId ? { propertyId } : {}) },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { nextDue: "asc" },
  });
}

export async function createSchedule(companyId: number, data: {
  title: string; description: string; category: string; interval: string;
  nextDue: string; assignedTo?: string; propertyId: number;
}) {
  return prisma.maintenanceSchedule.create({
    data: {
      ...data,
      category: data.category as never,
      interval: data.interval as never,
      nextDue: new Date(data.nextDue),
      companyId,
    },
  });
}

export async function updateSchedule(companyId: number, id: number, data: object) {
  const s = await prisma.maintenanceSchedule.findFirst({ where: { id, companyId } });
  if (!s) throw new AppError(404, "Wartungsplan nicht gefunden");
  return prisma.maintenanceSchedule.update({ where: { id }, data: data as never });
}

export async function deleteSchedule(companyId: number, id: number) {
  const s = await prisma.maintenanceSchedule.findFirst({ where: { id, companyId } });
  if (!s) throw new AppError(404, "Wartungsplan nicht gefunden");
  await prisma.maintenanceSchedule.delete({ where: { id } });
}

// Cron: fällige Wartungspläne → automatisch Ticket erstellen
export async function processOverdueSchedules(): Promise<number> {
  const now = new Date();
  const due = await prisma.maintenanceSchedule.findMany({
    where: { isActive: true, nextDue: { lte: now } },
  });

  let created = 0;
  for (const s of due) {
    await prisma.maintenanceTicket.create({
      data: {
        title: s.title,
        description: s.description || `Automatisch aus Wartungsplan: ${s.title}`,
        category: s.category,
        priority: "MITTEL",
        status: "OFFEN",
        reportedBy: "System",
        assignedTo: s.assignedTo,
        dueDate: now,
        propertyId: s.propertyId,
        companyId: s.companyId,
      },
    });

    // nextDue berechnen
    const months: Record<string, number> = {
      MONATLICH: 1, VIERTELJAEHRLICH: 3, HALBJAEHRLICH: 6, JAEHRLICH: 12,
    };
    const next = new Date(s.nextDue);
    next.setMonth(next.getMonth() + (months[s.interval] ?? 12));

    await prisma.maintenanceSchedule.update({
      where: { id: s.id },
      data: { lastDone: now, nextDue: next },
    });
    created++;
  }

  if (created > 0) {
    logger.info({ count: created }, "[WARTUNGSPLAN] Wartungstickets auto-erstellt");
  }
  return created;
}
```

**Step 3: Controller + Routes + index.ts + retention.service.ts**

Analog zu Task 8 (Dunning). Controller: list/create/update/remove. Routes mit `requireRole`. In `retention.service.ts` `processOverdueSchedules()` in den setInterval-Block. In `index.ts`: `/maintenance-schedules`.

**Step 4: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/schemas/maintenance-schedule.schema.ts \
  backend/src/services/maintenance-schedule.service.ts \
  backend/src/controllers/maintenance-schedule.controller.ts \
  backend/src/routes/maintenance-schedule.routes.ts \
  backend/src/routes/index.ts backend/src/services/retention.service.ts
git commit -m "feat: Wartungsplan API + cron auto-creates tickets on due date"
```

---

## Task 13: Wartungsplan — Frontend

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useMaintenanceSchedules.ts`
- Modify: `cozy-estate-central/src/pages/Maintenance.tsx` (neuer Tab "Wartungsplan")

Hook-Muster analog zu Task 4 (useRecurringTransactions). Tab "Wartungsplan" zeigt:
- Tabelle: Titel, Kategorie, Intervall, Letzte Durchführung, Nächste Fälligkeit, Zugewiesen an, Status
- Farbliches Highlighting wenn `nextDue` < heute (rot) oder < 30 Tage (orange)
- "Neuer Wartungsplan"-Button → Dialog

```bash
cd cozy-estate-central && npx tsc --noEmit
git add cozy-estate-central/src/hooks/api/useMaintenanceSchedules.ts \
  cozy-estate-central/src/pages/Maintenance.tsx
git commit -m "feat: Wartungsplan-Tab in Maintenance-Seite"
```

---

## Task 14: Dokumenten-Vorlagen — Backend

**Files:**
- Create: `backend/src/schemas/document-template.schema.ts`
- Create: `backend/src/services/document-template.service.ts`
- Create: `backend/src/controllers/document-template.controller.ts`
- Create: `backend/src/routes/document-template.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Handlebars installieren**

```bash
cd backend
npm install handlebars
npm install --save-dev @types/handlebars
```

**Step 2: Service**

```typescript
// backend/src/services/document-template.service.ts
import Handlebars from "handlebars";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listTemplates(companyId: number) {
  return prisma.documentTemplate.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createTemplate(companyId: number, data: {
  name: string; category: string; content: string;
}) {
  // Validate that content is valid Handlebars
  try { Handlebars.compile(data.content); } catch {
    throw new AppError(400, "Ungültiges Template-Format");
  }
  return prisma.documentTemplate.create({ data: { ...data, companyId } });
}

export async function updateTemplate(companyId: number, id: number, data: object) {
  const t = await prisma.documentTemplate.findFirst({ where: { id, companyId } });
  if (!t) throw new AppError(404, "Vorlage nicht gefunden");
  return prisma.documentTemplate.update({ where: { id }, data: data as never });
}

export async function deleteTemplate(companyId: number, id: number) {
  const t = await prisma.documentTemplate.findFirst({ where: { id, companyId } });
  if (!t) throw new AppError(404, "Vorlage nicht gefunden");
  await prisma.documentTemplate.delete({ where: { id } });
}

// Vorlage mit Daten befüllen und als PDF ausgeben
export async function renderTemplate(companyId: number, id: number, variables: Record<string, unknown>) {
  const t = await prisma.documentTemplate.findFirst({ where: { id, companyId } });
  if (!t) throw new AppError(404, "Vorlage nicht gefunden");
  const compiled = Handlebars.compile(t.content);
  return compiled(variables);
}
```

**Step 3: Controller**

```typescript
// backend/src/controllers/document-template.controller.ts
import type { Request, Response } from "express";
import * as svc from "../services/document-template.service.js";
import { createPdfResponse } from "../lib/pdf.js";
import PDFDocument from "pdfkit";

export async function list(req: Request, res: Response) {
  res.json({ data: await svc.listTemplates(req.companyId!) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await svc.createTemplate(req.companyId!, req.body) });
}
export async function update(req: Request, res: Response) {
  res.json({ data: await svc.updateTemplate(req.companyId!, Number(req.params.id), req.body) });
}
export async function remove(req: Request, res: Response) {
  await svc.deleteTemplate(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}
export async function renderToPdf(req: Request, res: Response) {
  const rendered = await svc.renderTemplate(req.companyId!, Number(req.params.id), req.body);
  const doc = createPdfResponse(res, "Dokument");
  doc.fontSize(11).text(rendered);
  doc.end();
}
```

**Step 4: Routes + index.ts**

```typescript
// backend/src/routes/document-template.routes.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/document-template.controller.js";

const router = Router();
router.get("/", ctrl.list);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  ctrl.create);
router.patch("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.update);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);
router.post("/:id/render", apiLimiter,
  validate({ params: idParamSchema }), ctrl.renderToPdf);
export { router as documentTemplateRouter };
```

In `index.ts`: `router.use("/document-templates", requireAuth, tenantGuard, documentTemplateRouter);`

**Step 5: TypeScript + Commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/schemas/document-template.schema.ts \
  backend/src/services/document-template.service.ts \
  backend/src/controllers/document-template.controller.ts \
  backend/src/routes/document-template.routes.ts \
  backend/src/routes/index.ts backend/package.json backend/package-lock.json
git commit -m "feat: Dokumenten-Vorlagen API mit Handlebars-Rendering + PDF-Export"
```

---

## Task 15: Dokumenten-Vorlagen — Frontend

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useDocumentTemplates.ts`
- Create: `cozy-estate-central/src/pages/Templates.tsx`
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

Hook analog zu useRecurringTransactions.

**Templates.tsx:**
- Tabelle mit Vorlagen (Name, Kategorie, Letzte Änderung)
- "Neue Vorlage" → Dialog mit:
  - Name, Kategorie (Dropdown)
  - Textarea für Handlebars-Inhalt (mit Hinweis auf verfügbare Variablen: `{{tenantName}}`, `{{propertyName}}`, `{{date}}` etc.)
- "Ausfüllen & PDF" → Dialog: Variablen eingeben → POST /:id/render → Blob-Download

In `AppSidebar.tsx` unter "Dokumente" oder als eigener Punkt:
```typescript
{ title: "Vorlagen", url: "/vorlagen", icon: FileText }
```

```bash
cd cozy-estate-central && npx tsc --noEmit
git add cozy-estate-central/src/hooks/api/useDocumentTemplates.ts \
  cozy-estate-central/src/pages/Templates.tsx \
  cozy-estate-central/src/App.tsx \
  cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat: Dokumenten-Vorlagen Seite mit Handlebars + PDF-Download"
```

---

## Task 16: PROJEKTDOKUMENTATION updaten

**Files:**
- Modify: `PROJEKTDOKUMENTATION.md`

Neue Abschnitte dokumentieren:
- 7 neue Features (Zähler, Wiederkehrend, PDF, Mahnwesen, Übergabe, Wartungsplan, Vorlagen)
- Neue API-Endpunkte
- Neue npm-Pakete: `pdfkit`, `handlebars`
- Roadmap: Mieter-Portal (geplant, nicht implementiert)

```bash
git add PROJEKTDOKUMENTATION.md
git commit -m "docs: update PROJEKTDOKUMENTATION für Feature-Backlog Implementierung"
```

---

## Neue npm-Pakete

### Backend
| Paket | Zweck | Task |
|-------|-------|------|
| `pdfkit` + `@types/pdfkit` | PDF-Generierung | Task 6 |
| `handlebars` + `@types/handlebars` | Template-Engine für Dokumenten-Vorlagen | Task 14 |

### Frontend
Keine neuen Pakete notwendig.

---

## Erfolgskriterien

- [ ] Zähler anlegen, Ablesung erfassen, Verbrauch wird automatisch berechnet
- [ ] Wiederkehrende Transaktion monatlich → wird automatisch als Transaktion angelegt
- [ ] Nebenkostenabrechnung als PDF herunterladbar
- [ ] Mahnung Level 1–3 per Button sendbar, E-Mail wird versendet
- [ ] Übergabeprotokoll für Ein-/Auszug mit Raumzustand erfassbar
- [ ] Wartungsplan erstellt automatisch Ticket wenn `nextDue` überschritten
- [ ] Dokumenten-Vorlage mit Handlebars befüllbar und als PDF exportierbar
- [ ] `npx tsc --noEmit` in beiden Projekten: keine Fehler
- [ ] Alle bestehenden Tests weiterhin grün
