# Energie-Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/energie` page showing Klimaausweis data per property and monthly energy consumption charts (Strom/Gas/Wasser/Wärme) per unit using existing meter reading data.

**Architecture:** New `EnergyPassport` Prisma model (1:1 to Property) for certificate data. New `energy-consumption.service.ts` aggregates existing `MeterReading` data into monthly unit-level consumption. New `energy.controller.ts` + `energy.routes.ts`. Frontend: new `Energie.tsx` page + `useEnergy.ts` hooks using Recharts (already installed).

**Tech Stack:** Prisma 6, Express 5, TypeScript ESM, vitest, React 18, Recharts ^2.15.4, React Query v5, Shadcn/UI

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/prisma/schema.prisma` | Add `EnergyPassportType` enum + `EnergyPassport` model + relations on `Property` + `Company` |
| Create | `backend/src/schemas/energy.schema.ts` | Zod: `energyPassportSchema`, `consumptionQuerySchema` (z.coerce.number) |
| Create | `backend/src/services/energy-passport.service.ts` | `getPassport`, `upsertPassport` |
| Create | `backend/src/services/energy-consumption.service.ts` | `getConsumption` — monthly aggregation from MeterReadings |
| Create | `backend/src/controllers/energy.controller.ts` | 3 handlers: consumption, getPassport, upsertPassport |
| Create | `backend/src/routes/energy.routes.ts` | 3 routes (requireAuth + tenantGuard + subscriptionGuard in index.ts) |
| Modify | `backend/src/routes/index.ts` | Register `energyRouter` |
| Create | `backend/src/test/energy-consumption.service.test.ts` | Unit tests for aggregation logic |
| Create | `cozy-estate-central/src/hooks/api/useEnergy.ts` | `useConsumption`, `useEnergyPassport`, `useUpsertEnergyPassport` |
| Create | `cozy-estate-central/src/pages/Energie.tsx` | Energie page: property selector, Klimaausweis card, consumption charts |
| Modify | `cozy-estate-central/src/App.tsx` | Add `/energie` route |
| Modify | `cozy-estate-central/src/components/AppSidebar.tsx` | Add "Energie" sidebar entry |

---

## Task 1: Prisma Schema — EnergyPassport

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add EnergyPassportType enum and EnergyPassport model**

Add after the `ContractStatus` enum block (around line 295):

```prisma
enum EnergyPassportType {
  VERBRAUCH
  BEDARF
}

model EnergyPassport {
  id                  Int                @id @default(autoincrement())
  certificateType     EnergyPassportType @map("certificate_type")
  energyClass         String             @map("energy_class")
  primaryEnergyDemand Float?             @map("primary_energy_demand")
  finalEnergyDemand   Float?             @map("final_energy_demand")
  energyCarrier       String?            @map("energy_carrier")
  issuedAt            DateTime           @map("issued_at")
  validUntil          DateTime           @map("valid_until")
  certificateNumber   String?            @map("certificate_number")
  propertyId          Int                @unique @map("property_id")
  companyId           Int                @map("company_id")
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("energy_passports")
}
```

- [ ] **Step 2: Add inverse relation on Property model**

Inside `model Property { ... }`, add after `maintenanceBudgets MaintenanceBudget[]`:

```prisma
  energyPassport        EnergyPassport?
```

- [ ] **Step 3: Add inverse relation on Company model**

Inside `model Company { ... }`, add after `maintenanceBudgets MaintenanceBudget[]`:

```prisma
  energyPassports       EnergyPassport[]
```

- [ ] **Step 4: Run migration**

```bash
cd backend
npm run db:migrate
```

Migration name: `energy_passport`

Expected: New `energy_passports` table created with all columns.

- [ ] **Step 5: Verify TypeScript**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(schema): add EnergyPassport model"
```

---

## Task 2: Energy Consumption Service (TDD)

**Files:**
- Create: `backend/src/services/energy-consumption.service.ts`
- Create: `backend/src/test/energy-consumption.service.test.ts`

### Background

The service loads all `Meter` records for a property that have a `unitId` (property-wide meters without unit are ignored). For each meter it loads readings within `[year-01-01, (year+1)-01-01]` plus the last reading before the year (for January calculation). Monthly consumption = `max(0, newerReading.value - olderReading.value)`, attributed to the month of the newer reading.

Output: one entry per unit found, with a `consumption` object containing arrays of 12 values (index 0=Jan … 11=Dec) per meter type. `SONSTIGES` meters are excluded.

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/test/energy-consumption.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPropertyFindFirst, mockMeterFindMany, mockReadingFindFirst } = vi.hoisted(() => ({
  mockPropertyFindFirst: vi.fn(),
  mockMeterFindMany: vi.fn(),
  mockReadingFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    property: { findFirst: mockPropertyFindFirst },
    meter: { findMany: mockMeterFindMany },
    meterReading: { findFirst: mockReadingFindFirst },
  },
}));

import { getConsumption } from "../services/energy-consumption.service.js";

describe("energy-consumption.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates Feb and Mar deltas correctly using prev reading for Feb", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
    mockMeterFindMany.mockResolvedValueOnce([
      {
        id: 1,
        type: "STROM",
        unitId: 5,
        unit: { id: 5, number: "EG links" },
        readings: [
          { value: 1100, readAt: new Date("2026-02-15") },
          { value: 1250, readAt: new Date("2026-03-10") },
        ],
      },
    ]);
    // prevReading (before year start)
    mockReadingFindFirst.mockResolvedValueOnce({ value: 1000, readAt: new Date("2025-12-31") });

    const result = await getConsumption(1, 1, 2026);

    expect(result.units).toHaveLength(1);
    expect(result.units[0].unitId).toBe(5);
    expect(result.units[0].unitNumber).toBe("EG links");
    expect(result.units[0].consumption.STROM[1]).toBe(100); // Feb: 1100 - 1000
    expect(result.units[0].consumption.STROM[2]).toBe(150); // Mar: 1250 - 1100
    expect(result.units[0].consumption.STROM[0]).toBe(0);   // Jan: no reading
  });

  it("clamps negative delta (meter replacement) to 0", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1 });
    mockMeterFindMany.mockResolvedValueOnce([
      {
        id: 2, type: "STROM", unitId: 5, unit: { id: 5, number: "OG" },
        readings: [{ value: 50, readAt: new Date("2026-02-01") }],
      },
    ]);
    mockReadingFindFirst.mockResolvedValueOnce({ value: 9999, readAt: new Date("2025-12-01") });

    const result = await getConsumption(1, 1, 2026);
    expect(result.units[0].consumption.STROM[1]).toBe(0); // clamped
  });

  it("excludes property-wide meters (no unitId)", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1 });
    mockMeterFindMany.mockResolvedValueOnce([]); // Prisma filter { unitId: { not: null } }

    const result = await getConsumption(1, 1, 2026);
    expect(result.units).toHaveLength(0);
  });

  it("throws 404 when property not found for companyId", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce(null);
    await expect(getConsumption(1, 99, 2026)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("attributes delta spanning two months to the newer reading's month", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1 });
    mockMeterFindMany.mockResolvedValueOnce([
      {
        id: 3, type: "GAS", unitId: 7, unit: { id: 7, number: "EG rechts" },
        readings: [{ value: 500, readAt: new Date("2026-03-01") }], // no Feb reading
      },
    ]);
    mockReadingFindFirst.mockResolvedValueOnce({ value: 400, readAt: new Date("2026-01-15") });

    const result = await getConsumption(1, 1, 2026);
    expect(result.units[0].consumption.GAS[2]).toBe(100); // Mar gets delta
    expect(result.units[0].consumption.GAS[1]).toBe(0);   // Feb = 0
  });
});
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
cd backend
npm test energy-consumption
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create `backend/src/services/energy-consumption.service.ts`**

```typescript
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const TRACKED_TYPES = ["STROM", "GAS", "WASSER", "WAERME"] as const;

function emptyConsumption(): Record<string, number[]> {
  return Object.fromEntries(TRACKED_TYPES.map((t) => [t, Array(12).fill(0)]));
}

export async function getConsumption(companyId: number, propertyId: number, year: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const meters = await prisma.meter.findMany({
    where: { propertyId, companyId, unitId: { not: null } },
    include: {
      unit: { select: { id: true, number: true } },
      readings: {
        where: { readAt: { gte: yearStart, lt: yearEnd } },
        orderBy: { readAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const unitMap = new Map<number, { unitNumber: string; consumption: Record<string, number[]> }>();

  for (const meter of meters) {
    if (!meter.unitId || !meter.unit) continue;
    if (!(TRACKED_TYPES as readonly string[]).includes(meter.type)) continue;

    const prevReading = await prisma.meterReading.findFirst({
      where: { meterId: meter.id, companyId, readAt: { lt: yearStart } },
      orderBy: { readAt: "desc" },
    });

    const allReadings = prevReading
      ? [prevReading, ...meter.readings]
      : meter.readings;

    if (!unitMap.has(meter.unitId)) {
      unitMap.set(meter.unitId, {
        unitNumber: meter.unit.number,
        consumption: emptyConsumption(),
      });
    }

    const unitData = unitMap.get(meter.unitId)!;

    for (let i = 1; i < allReadings.length; i++) {
      const newer = allReadings[i];
      const older = allReadings[i - 1];
      const delta = Math.max(0, newer.value - older.value);
      const month = new Date(newer.readAt).getMonth(); // 0-indexed
      unitData.consumption[meter.type][month] += delta;
    }
  }

  const units = Array.from(unitMap.entries()).map(([unitId, data]) => ({
    unitId,
    unitNumber: data.unitNumber,
    consumption: data.consumption,
  }));

  return { year, units };
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
cd backend
npm test energy-consumption
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/energy-consumption.service.ts \
        backend/src/test/energy-consumption.service.test.ts
git commit -m "feat(energie): energy consumption service with monthly aggregation"
```

---

## Task 3: Energy Passport Service, Schema, Controller, Routes

**Files:**
- Create: `backend/src/schemas/energy.schema.ts`
- Create: `backend/src/services/energy-passport.service.ts`
- Create: `backend/src/controllers/energy.controller.ts`
- Create: `backend/src/routes/energy.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create `backend/src/schemas/energy.schema.ts`**

```typescript
import { z } from "zod";

export const energyPassportSchema = z.object({
  certificateType: z.enum(["VERBRAUCH", "BEDARF"]),
  energyClass: z.enum(["A+", "A", "B", "C", "D", "E", "F", "G", "H"]),
  primaryEnergyDemand: z.number().positive().optional(),
  finalEnergyDemand: z.number().positive().optional(),
  energyCarrier: z.string().min(1).max(100).optional(),
  issuedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  certificateNumber: z.string().min(1).max(100).optional(),
});

export const consumptionQuerySchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const propertyIdParamSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
});
```

- [ ] **Step 2: Create `backend/src/services/energy-passport.service.ts`**

```typescript
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function getPassport(companyId: number, propertyId: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  return prisma.energyPassport.findUnique({ where: { propertyId } });
}

export async function upsertPassport(
  companyId: number,
  propertyId: number,
  data: {
    certificateType: "VERBRAUCH" | "BEDARF";
    energyClass: string;
    primaryEnergyDemand?: number;
    finalEnergyDemand?: number;
    energyCarrier?: string;
    issuedAt: string;
    validUntil: string;
    certificateNumber?: string;
  },
) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  return prisma.energyPassport.upsert({
    where: { propertyId },
    create: {
      ...data,
      issuedAt: new Date(data.issuedAt),
      validUntil: new Date(data.validUntil),
      propertyId,
      companyId,
    },
    update: {
      ...data,
      issuedAt: new Date(data.issuedAt),
      validUntil: new Date(data.validUntil),
    },
  });
}
```

- [ ] **Step 3: Create `backend/src/controllers/energy.controller.ts`**

```typescript
import type { Request, Response } from "express";
import { validate } from "../middleware/validate.js";
import { consumptionQuerySchema, energyPassportSchema, propertyIdParamSchema } from "../schemas/energy.schema.js";
import { getConsumption } from "../services/energy-consumption.service.js";
import { getPassport, upsertPassport } from "../services/energy-passport.service.js";

export async function getConsumptionHandler(req: Request, res: Response): Promise<void> {
  const { propertyId, year } = consumptionQuerySchema.parse(req.query);
  const data = await getConsumption(req.companyId, propertyId, year);
  res.json({ data });
}

export async function getPassportHandler(req: Request, res: Response): Promise<void> {
  const { propertyId } = propertyIdParamSchema.parse(req.params);
  const passport = await getPassport(req.companyId, propertyId);
  res.json({ data: passport });
}

export async function upsertPassportHandler(req: Request, res: Response): Promise<void> {
  const { propertyId } = propertyIdParamSchema.parse(req.params);
  const data = energyPassportSchema.parse(req.body);
  const passport = await upsertPassport(req.companyId, propertyId, data);
  res.json({ data: passport });
}
```

- [ ] **Step 4: Create `backend/src/routes/energy.routes.ts`**

```typescript
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import * as ctrl from "../controllers/energy.controller.js";

const router = Router();

router.get("/consumption", ctrl.getConsumptionHandler);
router.get("/passport/:propertyId", ctrl.getPassportHandler);
router.put(
  "/passport/:propertyId",
  requireRole("ADMIN", "VERWALTER"),
  ctrl.upsertPassportHandler,
);

export { router as energyRouter };
```

- [ ] **Step 5: Register in `backend/src/routes/index.ts`**

Add import:

```typescript
import { energyRouter } from "./energy.routes.js";
```

Add route (after the `billingRouter` line, with subscriptionGuard):

```typescript
router.use("/energy", requireAuth, tenantGuard, subscriptionGuard, energyRouter);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/schemas/energy.schema.ts \
        backend/src/services/energy-passport.service.ts \
        backend/src/controllers/energy.controller.ts \
        backend/src/routes/energy.routes.ts \
        backend/src/routes/index.ts
git commit -m "feat(energie): energy passport service, controller, routes"
```

---

## Task 4: Frontend — Hooks + Page

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useEnergy.ts`
- Create: `cozy-estate-central/src/pages/Energie.tsx`
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

- [ ] **Step 1: Create `cozy-estate-central/src/hooks/api/useEnergy.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EnergyPassport {
  id: number;
  certificateType: "VERBRAUCH" | "BEDARF";
  energyClass: string;
  primaryEnergyDemand: number | null;
  finalEnergyDemand: number | null;
  energyCarrier: string | null;
  issuedAt: string;
  validUntil: string;
  certificateNumber: string | null;
  propertyId: number;
}

export interface UnitConsumption {
  unitId: number;
  unitNumber: string;
  consumption: {
    STROM: number[];
    GAS: number[];
    WASSER: number[];
    WAERME: number[];
  };
}

export interface ConsumptionData {
  year: number;
  units: UnitConsumption[];
}

export function useConsumption(propertyId: number | null, year: number) {
  return useQuery({
    queryKey: ["consumption", propertyId, year],
    queryFn: () =>
      api
        .get(`/energy/consumption?propertyId=${propertyId}&year=${year}`)
        .then((r) => r.json())
        .then((r: { data: ConsumptionData }) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useEnergyPassport(propertyId: number | null) {
  return useQuery({
    queryKey: ["energyPassport", propertyId],
    queryFn: () =>
      api
        .get(`/energy/passport/${propertyId}`)
        .then((r) => r.json())
        .then((r: { data: EnergyPassport | null }) => r.data),
    enabled: !!propertyId,
  });
}

export function useUpsertEnergyPassport(propertyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EnergyPassport, "id" | "propertyId">) =>
      api
        .put(`/energy/passport/${propertyId}`, { body: JSON.stringify(data) })
        .then((r) => r.json())
        .then((r: { data: EnergyPassport }) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energyPassport", propertyId] });
    },
  });
}
```

- [ ] **Step 2: Create `cozy-estate-central/src/pages/Energie.tsx`**

```typescript
import { useState } from "react";
import { Zap, Pencil } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useProperties } from "@/hooks/api/useProperties";
import {
  useConsumption, useEnergyPassport, useUpsertEnergyPassport,
  type EnergyPassport,
} from "@/hooks/api/useEnergy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const ENERGY_CLASS_COLORS: Record<string, string> = {
  "A+": "bg-green-600 text-white",
  A: "bg-green-500 text-white",
  B: "bg-lime-500 text-white",
  C: "bg-yellow-400 text-black",
  D: "bg-yellow-500 text-black",
  E: "bg-orange-400 text-black",
  F: "bg-orange-500 text-white",
  G: "bg-red-500 text-white",
  H: "bg-red-700 text-white",
};

const BAR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const METER_TYPES = [
  { key: "STROM", label: "Strom", unit: "kWh" },
  { key: "GAS", label: "Gas", unit: "m³" },
  { key: "WASSER", label: "Wasser", unit: "m³" },
  { key: "WAERME", label: "Wärme", unit: "kWh" },
] as const;

function PassportCard({
  passport,
  onEdit,
}: {
  passport: EnergyPassport | null | undefined;
  onEdit: () => void;
}) {
  if (!passport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Klimaausweis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Noch kein Klimaausweis erfasst.</p>
          <Button className="mt-3" onClick={onEdit}>
            Klimaausweis anlegen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Klimaausweis</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="col-span-2 md:col-span-3 flex items-center gap-3">
          <Badge className={ENERGY_CLASS_COLORS[passport.energyClass] ?? "bg-gray-400 text-white"}>
            Klasse {passport.energyClass}
          </Badge>
          <span className="text-muted-foreground">
            {passport.certificateType === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"}
          </span>
        </div>
        {passport.primaryEnergyDemand != null && (
          <div><p className="text-muted-foreground">Primärenergie</p><p className="font-medium">{passport.primaryEnergyDemand} kWh/m²a</p></div>
        )}
        {passport.finalEnergyDemand != null && (
          <div><p className="text-muted-foreground">Endenergie</p><p className="font-medium">{passport.finalEnergyDemand} kWh/m²a</p></div>
        )}
        {passport.energyCarrier && (
          <div><p className="text-muted-foreground">Energieträger</p><p className="font-medium">{passport.energyCarrier}</p></div>
        )}
        <div>
          <p className="text-muted-foreground">Ausgestellt</p>
          <p className="font-medium">{new Date(passport.issuedAt).toLocaleDateString("de-DE")}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Gültig bis</p>
          <p className="font-medium">{new Date(passport.validUntil).toLocaleDateString("de-DE")}</p>
        </div>
        {passport.certificateNumber && (
          <div><p className="text-muted-foreground">Ausweis-Nr.</p><p className="font-medium">{passport.certificateNumber}</p></div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Energie() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeType, setActiveType] = useState<string>("STROM");
  const [passportDialogOpen, setPassportDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<EnergyPassport>>({});
  const { toast } = useToast();

  const { data: propertiesRes } = useProperties();
  const properties = propertiesRes?.data ?? [];

  const { data: consumption } = useConsumption(selectedPropertyId, year);
  const { data: passport } = useEnergyPassport(selectedPropertyId);
  const upsertPassport = useUpsertEnergyPassport(selectedPropertyId ?? 0);

  const currentYear = new Date().getFullYear();

  // Build chart data
  const chartData = MONTHS.map((month, idx) => {
    const entry: Record<string, number | string> = { month };
    consumption?.units.forEach((u) => {
      const val = u.consumption[activeType as keyof typeof u.consumption]?.[idx] ?? 0;
      entry[u.unitNumber] = val;
    });
    return entry;
  });

  const unitNumbers = consumption?.units.map((u) => u.unitNumber) ?? [];
  const activeTypeMeta = METER_TYPES.find((t) => t.key === activeType)!;
  const hasData = consumption?.units.some((u) =>
    u.consumption[activeType as keyof typeof u.consumption]?.some((v) => v > 0),
  );

  function openEditDialog() {
    setForm(
      passport
        ? { ...passport, issuedAt: passport.issuedAt.slice(0, 10), validUntil: passport.validUntil.slice(0, 10) }
        : { certificateType: "VERBRAUCH", energyClass: "C" },
    );
    setPassportDialogOpen(true);
  }

  async function savePassport() {
    try {
      await upsertPassport.mutateAsync({
        certificateType: form.certificateType ?? "VERBRAUCH",
        energyClass: form.energyClass ?? "C",
        primaryEnergyDemand: form.primaryEnergyDemand ?? undefined,
        finalEnergyDemand: form.finalEnergyDemand ?? undefined,
        energyCarrier: form.energyCarrier ?? undefined,
        issuedAt: new Date(form.issuedAt ?? "").toISOString(),
        validUntil: new Date(form.validUntil ?? "").toISOString(),
        certificateNumber: form.certificateNumber ?? undefined,
      });
      setPassportDialogOpen(false);
      toast({ title: "Klimaausweis gespeichert" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  return (
    <main className="flex-1 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Energie</h1>
      </div>

      {/* Property + Year selectors */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={selectedPropertyId?.toString() ?? ""}
          onValueChange={(v) => setSelectedPropertyId(Number(v))}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Immobilie auswählen" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>◀</Button>
          <span className="font-medium w-12 text-center">{year}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
          >
            ▶
          </Button>
        </div>
      </div>

      {!selectedPropertyId ? (
        <p className="text-muted-foreground">Bitte eine Immobilie auswählen.</p>
      ) : (
        <>
          <PassportCard passport={passport} onEdit={openEditDialog} />

          {/* Consumption charts */}
          <Card>
            <CardHeader>
              <CardTitle>Verbrauchsübersicht {year}</CardTitle>
              <div className="flex gap-2 flex-wrap mt-2">
                {METER_TYPES.map((t) => (
                  <Button
                    key={t.key}
                    variant={activeType === t.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveType(t.key)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {!hasData ? (
                <p className="text-muted-foreground text-sm">
                  Keine Verbrauchsdaten für {activeTypeMeta.label} vorhanden — Zähler und Ablesungen
                  unter der Immobilie erfassen.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis unit={` ${activeTypeMeta.unit}`} />
                    <Tooltip formatter={(v: number) => `${v} ${activeTypeMeta.unit}`} />
                    <Legend />
                    {unitNumbers.map((name, i) => (
                      <Bar key={name} dataKey={name} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Klimaausweis Edit Dialog */}
      <Dialog open={passportDialogOpen} onOpenChange={setPassportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Klimaausweis bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label>Typ</Label>
              <Select value={form.certificateType} onValueChange={(v) => setForm((f) => ({ ...f, certificateType: v as "VERBRAUCH" | "BEDARF" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VERBRAUCH">Verbrauchsausweis</SelectItem>
                  <SelectItem value="BEDARF">Bedarfsausweis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Energieklasse</Label>
              <Select value={form.energyClass} onValueChange={(v) => setForm((f) => ({ ...f, energyClass: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A+", "A", "B", "C", "D", "E", "F", "G", "H"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Primärenergie (kWh/m²a)</Label>
              <Input type="number" value={form.primaryEnergyDemand ?? ""} onChange={(e) => setForm((f) => ({ ...f, primaryEnergyDemand: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div>
              <Label>Endenergie (kWh/m²a)</Label>
              <Input type="number" value={form.finalEnergyDemand ?? ""} onChange={(e) => setForm((f) => ({ ...f, finalEnergyDemand: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div>
              <Label>Energieträger</Label>
              <Input value={form.energyCarrier ?? ""} onChange={(e) => setForm((f) => ({ ...f, energyCarrier: e.target.value }))} placeholder="z.B. Gas" />
            </div>
            <div>
              <Label>Ausweis-Nr.</Label>
              <Input value={form.certificateNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, certificateNumber: e.target.value }))} />
            </div>
            <div>
              <Label>Ausgestellt</Label>
              <Input type="date" value={form.issuedAt ?? ""} onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} />
            </div>
            <div>
              <Label>Gültig bis</Label>
              <Input type="date" value={form.validUntil ?? ""} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPassportDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={savePassport} disabled={upsertPassport.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
```

- [ ] **Step 3: Add route in `cozy-estate-central/src/App.tsx`**

Add import: `import Energie from "./pages/Energie";`

Add inside `AppLayout` Routes (after `/audit-logs`):

```typescript
<Route path="/energie" element={<Energie />} />
```

- [ ] **Step 4: Add sidebar entry in `cozy-estate-central/src/components/AppSidebar.tsx`**

Find the "Finanzen" section and add "Energie" entry after it. The pattern follows existing entries. Add `import { Zap } from "lucide-react"` if not present. Insert:

```typescript
{ title: "Energie", url: "/energie", icon: Zap },
```

in the appropriate navigation array (check existing structure of AppSidebar).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd cozy-estate-central
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Run all backend tests**

```bash
cd backend
npm test
```

Expected: All tests pass including the 5 new energy-consumption tests.

- [ ] **Step 7: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useEnergy.ts \
        cozy-estate-central/src/pages/Energie.tsx \
        cozy-estate-central/src/App.tsx \
        cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat(energie): Energie page with Klimaausweis and consumption charts"
```
