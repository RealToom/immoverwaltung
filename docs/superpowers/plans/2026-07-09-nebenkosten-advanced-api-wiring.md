# Advanced Nebenkosten-USPs — API-Anbindung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between already-implemented (but uncommitted, unmigrated, unwired) CO2-Stufenmodell/Leerstand/KI-Filter/Widerspruch schema+calculation logic and an actually working feature — migration, a new `/api/utility-billing` admin module, tenant-portal endpoints for utility transparency / meter self-service / disputes, and real data wiring on the four existing UI shells (which currently render hardcoded mock data).

**Architecture:** Standard Routes → Controllers → Services → Prisma layering, matching `finance.routes.ts`/`meter.routes.ts` conventions exactly. New admin logic lives in its own `utility-billing` module rather than extending `finance.routes.ts` (decided during brainstorming — one calculation engine, two write surfaces: admin generates statements, tenants read their own slice). Dispute CRUD lives in a shared `billing-dispute.service.ts` used by both the admin controller (list/resolve) and the tenant-portal controller (create/list-own), since it's one concern with two callers.

**Tech Stack:** Express 5, Prisma 6, Zod, Vitest (with `vi.mock("../lib/prisma.js")` + `vi.hoisted`), React Query, existing `api`/`tenantApi` fetch clients.

## Global Constraints

- Imports use `.js` extension (ESM) — e.g. `import { prisma } from "../lib/prisma.js"`.
- All service functions take `companyId` (or `tenantUser: { id, tenantId, companyId }` for tenant-portal) as the tenant-isolation boundary — every new Prisma query must filter by it.
- API response format: `{ data: ... }` for single objects/lists (no pagination needed for anything in this plan).
- Error handling via `AppError`/`NotFoundError`/`BadRequestError`/`ForbiddenError` from `backend/src/lib/errors.ts` — never hand-roll `res.status(...)`.
- No Prisma 7 — stay on Prisma 6.x.
- Deviation from the approved spec (`docs/superpowers/specs/2026-07-09-nebenkosten-advanced-api-design.md`), discovered during planning: `calculateHeatingBaseCostPercentage` (VDI 2067) is **not** wired into `generateStatement` in this pass. The `BetrkvCategory` enum has no `HEIZUNG` value, and a real heating consumption split needs per-unit `MeterReading` consumption data, which is a separate, larger feature. `applyCO2Stufenmodell` (the actual CO2-Stufenmodell logic) **is** wired, gated on `Transaction.co2TaxAmount > 0` instead.
- Statements are **not persisted** — both the admin generate endpoint and the tenant transparency endpoint recompute live from transaction data on every call (explicit decision from the spec, avoids a new "finalized statement" table).

---

## Task 1: Migration — `Contract.utilityPrepayment`

**Files:**
- Modify: `backend/prisma/schema.prisma` (`Contract` model, ~line 296)
- Test: none (schema/migration change, verified by `prisma generate` succeeding)

**Interfaces:**
- Produces: `Contract.utilityPrepayment: number` (Prisma Client field), used by Task 2.

This single migration will also pick up every other schema change already sitting uncommitted in `schema.prisma` (from prior work): `BillingDispute` model, `EnergyPassport.co2Emissions`, `Transaction.co2TaxAmount`/`betrkvCategory`/`maintenanceWarning`, `Unit.sqm`/`coownershipShare`/`currentInhabitants`, `Meter` interface fields, `Property.costConfiguration`, and the `BetrkvCategory`/`DistributionKey`/`MeterInterfaceType` enums. That's expected — `prisma migrate dev` diffs against the live DB, not against git history.

- [ ] **Step 1: Add the field**

In `backend/prisma/schema.prisma`, inside `model Contract { ... }`, add the field next to `monthlyRent`:

```prisma
model Contract {
  id           Int            @id @default(autoincrement())
  type         ContractType
  startDate    DateTime       @map("start_date")
  endDate      DateTime?      @map("end_date")
  noticePeriod Int            @map("notice_period")
  monthlyRent  Float          @map("monthly_rent")
  utilityPrepayment Float     @default(0) @map("utility_prepayment")
  deposit      Float          @default(0)
  status       ContractStatus @default(ENTWURF)
  // ...rest unchanged...
```

- [ ] **Step 2: Run the migration**

Run from `backend/`:
```bash
npx prisma migrate dev --name add_utility_billing_advanced
```
Expected: prompts complete without data-loss warnings, creates `backend/prisma/migrations/<timestamp>_add_utility_billing_advanced/migration.sql`, and regenerates the Prisma Client (`utilityPrepayment` now exists on `Contract` in `@prisma/client` types).

- [ ] **Step 3: Verify the build still compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no new type errors (the `(contract as any).utilityPrepayment` cast in `utility-billing.service.ts` still compiles at this point since `any` doesn't care — it gets cleaned up in Task 2).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Contract.utilityPrepayment, migrate pending utility-billing schema changes"
```

---

## Task 2: Unit tests for `UtilityBillingService` calculations + fix `calculateBalance`

**Files:**
- Modify: `backend/src/services/utility-billing.service.ts:263-297` (the `calculateBalance` method)
- Test: Create `backend/src/test/utility-billing.service.test.ts`

**Interfaces:**
- Consumes: `Contract.utilityPrepayment` (Task 1).
- Produces: `UtilityBillingService.calculateBalance(contractId, billingYear, totalAllocatedCosts)` returns real (non-zero-forced) `{ totalCosts, totalPrepaid, balance, isRefund, isAdditionalPayment }`, used by Task 4.

The four pure/near-pure methods on this class (`calculateProRataFixedCosts`, `calculateHeatingBaseCostPercentage`, `applyCO2Stufenmodell`, `calculateBalance`) currently have zero test coverage. This task adds it and fixes the one broken method.

- [ ] **Step 1: Write the test file (failing on the `calculateBalance` cases due to the current `as any` placeholder)**

```typescript
// backend/src/test/utility-billing.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEnergyPassportFindUnique, mockContractFindUnique, mockRentPaymentFindMany } = vi.hoisted(() => ({
  mockEnergyPassportFindUnique: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockRentPaymentFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    energyPassport: { findUnique: mockEnergyPassportFindUnique },
    contract: { findUnique: mockContractFindUnique },
    rentPayment: { findMany: mockRentPaymentFindMany },
  },
}));

import { UtilityBillingService } from "../services/utility-billing.service.js";

describe("UtilityBillingService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("calculateProRataFixedCosts", () => {
    it("returns full costs when tenant lived the whole year", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateProRataFixedCosts(1200, 2026, new Date(2025, 0, 1), null);
      expect(result).toBe(1200);
    });

    it("pro-rates costs for a tenant who moved in mid-year", () => {
      const svc = new UtilityBillingService(1);
      // Moved in July 1, 2026 (not a leap year) -> 184 days of 365
      const result = svc.calculateProRataFixedCosts(1200, 2026, new Date(2026, 6, 1), null);
      expect(result).toBeCloseTo(1200 * (184 / 365), 2);
    });

    it("returns 0 when the tenant moved out before the billing year started", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateProRataFixedCosts(1200, 2026, new Date(2020, 0, 1), new Date(2025, 11, 31));
      expect(result).toBe(0);
    });
  });

  describe("calculateHeatingBaseCostPercentage", () => {
    it("returns 100% for a full calendar year", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateHeatingBaseCostPercentage(2026, new Date(2026, 0, 1), null);
      expect(result).toBeCloseTo(100, 1);
    });

    it("returns 0% when the tenant's period doesn't overlap the billing year", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateHeatingBaseCostPercentage(2026, new Date(2020, 0, 1), new Date(2025, 11, 31));
      expect(result).toBe(0);
    });
  });

  describe("applyCO2Stufenmodell", () => {
    it("applies 0% landlord share below 12 kg CO2/m2/a", async () => {
      mockEnergyPassportFindUnique.mockResolvedValueOnce({ co2Emissions: 10 });
      const svc = new UtilityBillingService(1);
      const result = await svc.applyCO2Stufenmodell(1, 200);
      expect(result).toEqual({ tenantShare: 200, landlordShare: 0, landlordPercentage: 0 });
    });

    it("applies 60% landlord share in the 37-42 kg CO2/m2/a tier", async () => {
      mockEnergyPassportFindUnique.mockResolvedValueOnce({ co2Emissions: 38.5 });
      const svc = new UtilityBillingService(1);
      const result = await svc.applyCO2Stufenmodell(1, 245.6);
      expect(result.landlordPercentage).toBe(60);
      expect(result.landlordShare).toBeCloseTo(147.36, 2);
      expect(result.tenantShare).toBeCloseTo(98.24, 2);
    });

    it("falls back to 50/50 when no EnergyPassport exists", async () => {
      mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
      const svc = new UtilityBillingService(1);
      const result = await svc.applyCO2Stufenmodell(1, 100);
      expect(result).toEqual({ tenantShare: 50, landlordShare: 50, landlordPercentage: 50 });
    });
  });

  describe("calculateBalance", () => {
    it("sums monthly utilityPrepayment across fully-paid months into totalPrepaid", async () => {
      mockContractFindUnique.mockResolvedValueOnce({
        id: 1, companyId: 1, monthlyRent: 800, utilityPrepayment: 100,
      });
      mockRentPaymentFindMany.mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, i) => ({
          id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH",
        }))
      );
      const svc = new UtilityBillingService(1);
      const result = await svc.calculateBalance(1, 2026, 1000);
      expect(result.totalPrepaid).toBe(1200);
      expect(result.balance).toBe(200);
      expect(result.isRefund).toBe(true);
      expect(result.isAdditionalPayment).toBe(false);
    });

    it("throws when the contract belongs to a different company", async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 1, companyId: 2, monthlyRent: 800, utilityPrepayment: 100 });
      const svc = new UtilityBillingService(1);
      await expect(svc.calculateBalance(1, 2026, 1000)).rejects.toThrow("Vertrag nicht gefunden");
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm the `calculateBalance` cases fail**

Run: `cd backend && npx vitest run src/test/utility-billing.service.test.ts`
Expected: the `calculateProRataFixedCosts`/`calculateHeatingBaseCostPercentage`/`applyCO2Stufenmodell` tests PASS (those methods are already correct), the `calculateBalance` tests FAIL — `totalPrepaid` comes out `0` because of the `(contract as any).utilityPrepayment || 0` placeholder combined with the mocked contract not being read correctly through the cast in test isolation.

- [ ] **Step 3: Fix `calculateBalance`**

In `backend/src/services/utility-billing.service.ts`, replace lines 227-297 (the whole `calculateBalance` method) with:

```typescript
  /**
   * Reconciles prepayments vs actual costs for a contract.
   * Assumes that the utility prepayment (Nebenkostenabschlag) is part of RentPayments.
   */
  public async calculateBalance(
    contractId: number,
    billingYear: number,
    totalAllocatedCosts: number
  ) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!contract || contract.companyId !== this.companyId) {
      throw new AppError("Vertrag nicht gefunden oder kein Zugriff", 404);
    }

    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);

    const payments = await prisma.rentPayment.findMany({
      where: {
        contractId: contractId,
        companyId: this.companyId,
        month: {
          gte: startOfYear,
          lte: endOfYear
        },
        status: {
          in: ["PUENKTLICH", "VERSPAETET"]
        }
      }
    });

    let totalPrepaid = 0;
    for (const p of payments) {
      if (p.amountPaid >= p.amountDue) {
        totalPrepaid += contract.utilityPrepayment;
      } else {
        // Partial payment: assume rent is paid first, remainder is utility prepayment
        const remainder = p.amountPaid - contract.monthlyRent;
        if (remainder > 0) {
          totalPrepaid += Math.min(remainder, contract.utilityPrepayment);
        }
      }
    }

    const balance = totalPrepaid - totalAllocatedCosts;
    const isRefund = balance > 0;

    return {
      totalCosts: totalAllocatedCosts,
      totalPrepaid,
      balance,
      isRefund,
      isAdditionalPayment: !isRefund && balance < 0
    };
  }
```

Note: the `AppError` constructor here is `(message, statusCode)` per this file's existing usage — check the actual signature used at the top of the file matches `AppError` from `../lib/errors.js` (`statusCode` first, `message` second per `lib/errors.ts`). The existing code in this file already calls it as `new AppError("Vertrag nicht gefunden oder kein Zugriff", 404)` — **this was already backwards before your change** (should be `new AppError(404, "...")`). Fix it while you're in this method: `throw new AppError(404, "Vertrag nicht gefunden oder kein Zugriff");`.

- [ ] **Step 4: Run the tests again**

Run: `cd backend && npx vitest run src/test/utility-billing.service.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/utility-billing.service.ts backend/src/test/utility-billing.service.test.ts
git commit -m "fix(utility-billing): wire real Contract.utilityPrepayment into calculateBalance, add test coverage"
```

---

## Task 3: Let admins tag transactions with `betrkvCategory`/`co2TaxAmount`

**Files:**
- Modify: `backend/src/schemas/finance.schema.ts` (`updateTransactionSchema`)
- Modify: `backend/src/services/finance.service.ts:247-258` (`updateTransaction`)
- Test: Create `backend/src/test/finance.service.test.ts`

**Interfaces:**
- Produces: `PATCH /finance/transactions/:id` accepts `{ betrkvCategory?: string | null, co2TaxAmount?: number }` in its body, used by Task 9 (admin wizard inline edit).

Without this, `Transaction.co2TaxAmount` can never be set by anyone (not by KI-scan, not by auto-matching, not manually) — the whole CO2-Stufenmodell branch in `generateStatement` (Task 4) would be permanently dead code. `betrkvCategory` is currently only set by `matchUtilityTransactions` auto-matching; admins need to be able to set/correct it manually too.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/test/finance.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { transaction: { findFirst: mockFindFirst, update: mockUpdate } },
}));

import { updateTransaction } from "../services/finance.service.js";

describe("finance.service updateTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes betrkvCategory and co2TaxAmount through to prisma.transaction.update", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 5, companyId: 1 });
    mockUpdate.mockResolvedValueOnce({ id: 5, betrkvCategory: "WASSERVERSORGUNG", co2TaxAmount: 42.5 });

    await updateTransaction(1, 5, { betrkvCategory: "WASSERVERSORGUNG", co2TaxAmount: 42.5 });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { betrkvCategory: "WASSERVERSORGUNG", co2TaxAmount: 42.5 },
    });
  });
});
```

- [ ] **Step 2: Run it, confirm it fails on the type signature**

Run: `cd backend && npx vitest run src/test/finance.service.test.ts`
Expected: FAIL — TypeScript error, `betrkvCategory`/`co2TaxAmount` don't exist on the `updateTransaction` parameter type yet.

- [ ] **Step 3: Extend the Zod schema**

In `backend/src/schemas/finance.schema.ts`, replace `updateTransactionSchema`:

```typescript
export const updateTransactionSchema = z.object({
  allocatable: z.boolean().optional(),
  category: z.string().max(200).optional(),
  betrkvCategory: z.enum([
    "GRUNDSTEUER", "WASSERVERSORGUNG", "ENTWAESSERUNG", "AUFZUG",
    "STRASSENREINIGUNG_MUELL", "GEBAEUDE_REINIGUNG", "GARTENPFLEGE",
    "BELEUCHTUNG", "SCHORNSTEINREINIGUNG", "VERSICHERUNGEN", "HAUSWART",
    "GEMEINSCHAFTS_ANTENNE", "WASCHRAUM", "SONSTIGE_KOSTEN",
  ]).nullable().optional(),
  co2TaxAmount: z.number().min(0).optional(),
});
```

- [ ] **Step 4: Extend the service function**

In `backend/src/services/finance.service.ts`, replace `updateTransaction`:

```typescript
export async function updateTransaction(
  companyId: number,
  id: number,
  data: { allocatable?: boolean; category?: string; betrkvCategory?: string | null; co2TaxAmount?: number }
) {
  const existing = await prisma.transaction.findFirst({ where: { id, companyId } });
  if (!existing) {
    const { NotFoundError } = await import("../lib/errors.js");
    throw new NotFoundError("Transaktion", id);
  }
  return prisma.transaction.update({ where: { id }, data: data as never });
}
```

(`data as never` mirrors the existing enum-cast pattern used in `meter.service.ts`'s `createMeter`.)

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `cd backend && npx vitest run src/test/finance.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the full test suite and typecheck still pass**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all green (no route/controller changes needed — `finance.controller.ts`'s `patchTransaction` already forwards `req.body` generically).

- [ ] **Step 7: Commit**

```bash
git add backend/src/schemas/finance.schema.ts backend/src/services/finance.service.ts backend/src/test/finance.service.test.ts
git commit -m "feat(finance): allow tagging transactions with betrkvCategory/co2TaxAmount via PATCH"
```

---

## Task 4: `UtilityBillingService.generateStatement()` — the composition method

**Files:**
- Modify: `backend/src/services/utility-billing.service.ts` (add `generateStatement`, modify `generateOwnerVacancyInvoice`'s return shape)
- Test: Modify `backend/src/test/utility-billing.service.test.ts` (add a `generateStatement` describe block)

**Interfaces:**
- Consumes: `calculateProRataFixedCosts`, `applyCO2Stufenmodell`, `calculateBalance` (Task 2), `generateOwnerVacancyInvoice` (existing, modified here).
- Produces:
  ```typescript
  interface UtilityStatement {
    year: number;
    propertyId: number;
    totalCosts: number;
    co2: { energyClass: string | null; co2Emissions: number | null; landlordPercentage: number; tenantShare: number; landlordShare: number };
    vacancy: { amount: number; vacancyDays: number; affectedUnits: string[] } | null;
    items: Array<{ contractId: number; unitId: number; unitNumber: string; tenantName: string; area: number; amount: number; balance: number; isRefund: boolean }>;
    transactions: Array<{ id: number; description: string; amount: number; betrkvCategory: string | null; maintenanceWarning: string | null; co2TaxAmount: number | null }>;
  }
  ```
  `UtilityBillingService.generateStatement(propertyId, year): Promise<UtilityStatement>` — used by Task 6 (admin controller) and Task 7 (tenant `getUtilitySummary`).
  `generateOwnerVacancyInvoice(...)` now returns `{ transaction: Transaction; vacancyDays: number; affectedUnits: string[] } | null` instead of a bare `Transaction | null` (safe — nothing else calls this method yet).

- [ ] **Step 1: Modify `generateOwnerVacancyInvoice` to return richer vacancy detail**

In `backend/src/services/utility-billing.service.ts`, replace the whole `generateOwnerVacancyInvoice` method body:

```typescript
  public async generateOwnerVacancyInvoice(propertyId: number, billingYear: number, totalFixedCosts: number) {
    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);

    const units = await prisma.unit.findMany({
      where: { propertyId, companyId: this.companyId },
      include: {
        contracts: {
          where: {
            startDate: { lte: endOfYear },
            OR: [
              { endDate: null },
              { endDate: { gte: startOfYear } }
            ]
          }
        }
      }
    });

    let totalVacancyDays = 0;
    const affectedUnits: string[] = [];
    const daysInYear = isLeapYear(startOfYear) ? 366 : 365;

    for (const unit of units) {
      let unitVacancyDays = 0;
      let current = new Date(startOfYear);

      while (isBefore(current, endOfYear) || current.getTime() === endOfYear.getTime()) {
        const hasActiveContract = unit.contracts.some(c =>
          (isBefore(c.startDate, current) || c.startDate.getTime() === current.getTime()) &&
          (!c.endDate || isAfter(c.endDate, current) || c.endDate.getTime() === current.getTime())
        );

        if (!hasActiveContract) {
          unitVacancyDays++;
        }
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }

      if (unitVacancyDays > 0) affectedUnits.push(unit.number);
      totalVacancyDays += unitVacancyDays;
    }

    if (totalVacancyDays === 0) return null;

    const totalUnitDays = units.length * daysInYear;
    const vacancyRatio = totalVacancyDays / totalUnitDays;
    const ownerCost = totalFixedCosts * vacancyRatio;

    const transaction = await prisma.transaction.create({
      data: {
        date: endOfYear,
        description: `Eigentümer-Abrechnung Leerstand ${billingYear}`,
        type: "EINNAHME",
        amount: ownerCost,
        category: "Leerstands-Ausgleich",
        allocatable: false,
        propertyId,
        companyId: this.companyId
      }
    });

    return { transaction, vacancyDays: totalVacancyDays, affectedUnits };
  }
```

- [ ] **Step 2: Write the failing test for `generateStatement`**

Append to `backend/src/test/utility-billing.service.test.ts`. First extend the hoisted mocks and `vi.mock` block at the top of the file to cover the additional Prisma methods `generateStatement` touches:

```typescript
const {
  mockEnergyPassportFindUnique, mockContractFindUnique, mockRentPaymentFindMany,
  mockPropertyFindFirst, mockTransactionFindMany, mockUnitFindMany, mockContractFindMany,
} = vi.hoisted(() => ({
  mockEnergyPassportFindUnique: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockRentPaymentFindMany: vi.fn(),
  mockPropertyFindFirst: vi.fn(),
  mockTransactionFindMany: vi.fn(),
  mockUnitFindMany: vi.fn(),
  mockContractFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    energyPassport: { findUnique: mockEnergyPassportFindUnique },
    contract: { findUnique: mockContractFindUnique, findMany: mockContractFindMany },
    rentPayment: { findMany: mockRentPaymentFindMany },
    property: { findFirst: mockPropertyFindFirst },
    transaction: { findMany: mockTransactionFindMany },
    unit: { findMany: mockUnitFindMany },
  },
}));
```

This replaces the narrower `vi.hoisted`/`vi.mock` pair from Task 2 — since both live at the top of the same file, delete the Task-2 versions and use this combined one instead.

Then add the test block:

```typescript
  describe("generateStatement", () => {
    it("throws when the property doesn't belong to this company", async () => {
      mockPropertyFindFirst.mockResolvedValueOnce(null);
      const svc = new UtilityBillingService(1);
      await expect(svc.generateStatement(99, 2026)).rejects.toThrow("Immobilie nicht gefunden");
    });

    it("computes a full-year, single-unit, no-vacancy, no-CO2 statement", async () => {
      mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
      mockTransactionFindMany.mockResolvedValueOnce([
        { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
      ]);
      mockEnergyPassportFindUnique.mockResolvedValueOnce(null); // direct fetch for co2 card details
      mockUnitFindMany.mockResolvedValueOnce([
        {
          id: 5, number: "EG links", area: 50,
          contracts: [{ startDate: new Date(2025, 0, 1), endDate: null }],
        },
      ]);
      mockContractFindMany.mockResolvedValueOnce([
        {
          id: 42, startDate: new Date(2025, 0, 1), endDate: null,
          unit: { id: 5, number: "EG links", area: 50 },
          tenant: { id: 7, name: "Mustermann" },
        },
      ]);
      mockContractFindUnique.mockResolvedValueOnce({ id: 42, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
      mockRentPaymentFindMany.mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, i) => ({ id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH" }))
      );

      const svc = new UtilityBillingService(1);
      const result = await svc.generateStatement(1, 2026);

      expect(result.totalCosts).toBe(1200);
      expect(result.co2).toEqual({ energyClass: null, co2Emissions: null, landlordPercentage: 0, tenantShare: 0, landlordShare: 0 });
      expect(result.vacancy).toBeNull();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ contractId: 42, unitId: 5, unitNumber: "EG links", tenantName: "Mustermann", amount: 1200, balance: 0, isRefund: false });
      expect(result.transactions).toEqual([
        { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
      ]);
    });
  });
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/utility-billing.service.test.ts`
Expected: FAIL — `svc.generateStatement is not a function`.

- [ ] **Step 4: Implement `generateStatement`**

In `backend/src/services/utility-billing.service.ts`, add this method to the `UtilityBillingService` class (after `calculateBalance`):

```typescript
  /**
   * Composes pro-rata allocation, CO2-Stufenmodell, and Leerstands-Routing into
   * a single per-contract statement for a property/year. Recomputed live on every
   * call — nothing here is persisted as a "finalized" statement.
   */
  public async generateStatement(propertyId: number, year: number) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: this.companyId },
    });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        companyId: this.companyId,
        propertyId,
        type: "AUSGABE",
        allocatable: true,
        date: { gte: startDate, lt: endDate },
      },
    });

    let totalCo2LandlordShare = 0;
    let totalCo2TenantShare = 0;
    let landlordPercentage = 0;
    for (const tx of transactions) {
      if (tx.co2TaxAmount && tx.co2TaxAmount > 0) {
        const split = await this.applyCO2Stufenmodell(propertyId, tx.co2TaxAmount);
        totalCo2LandlordShare += split.landlordShare;
        totalCo2TenantShare += split.tenantShare;
        landlordPercentage = split.landlordPercentage;
      }
    }

    const passport = await prisma.energyPassport.findUnique({ where: { propertyId } });

    const grossCosts = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalAllocatable = grossCosts - totalCo2LandlordShare;

    const vacancyResult = await this.generateOwnerVacancyInvoice(propertyId, year, totalAllocatable);
    const vacancyDeduction = vacancyResult?.transaction.amount ?? 0;
    const netAllocatable = totalAllocatable - vacancyDeduction;

    const contracts = await prisma.contract.findMany({
      where: {
        propertyId,
        companyId: this.companyId,
        startDate: { lte: endDate },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
      include: {
        unit: { select: { id: true, number: true, area: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    const totalArea = contracts.reduce((sum, c) => sum + c.unit.area, 0);

    const items = [];
    for (const contract of contracts) {
      const areaShare = totalArea > 0 ? netAllocatable * (contract.unit.area / totalArea) : 0;
      const proRataShare = this.calculateProRataFixedCosts(areaShare, year, contract.startDate, contract.endDate);
      const balance = await this.calculateBalance(contract.id, year, proRataShare);
      items.push({
        contractId: contract.id,
        unitId: contract.unit.id,
        unitNumber: contract.unit.number,
        tenantName: contract.tenant.name,
        area: contract.unit.area,
        amount: Math.round(proRataShare * 100) / 100,
        balance: Math.round(balance.balance * 100) / 100,
        isRefund: balance.isRefund,
      });
    }

    return {
      year,
      propertyId,
      totalCosts: Math.round(grossCosts * 100) / 100,
      co2: {
        energyClass: passport?.energyClass ?? null,
        co2Emissions: passport?.co2Emissions ?? null,
        landlordPercentage,
        tenantShare: Math.round(totalCo2TenantShare * 100) / 100,
        landlordShare: Math.round(totalCo2LandlordShare * 100) / 100,
      },
      vacancy: vacancyResult
        ? {
            amount: Math.round(vacancyDeduction * 100) / 100,
            vacancyDays: vacancyResult.vacancyDays,
            affectedUnits: vacancyResult.affectedUnits,
          }
        : null,
      items,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        betrkvCategory: tx.betrkvCategory,
        maintenanceWarning: tx.maintenanceWarning,
        co2TaxAmount: tx.co2TaxAmount,
      })),
    };
  }
```

- [ ] **Step 5: Run all tests in the file**

Run: `cd backend && npx vitest run src/test/utility-billing.service.test.ts`
Expected: all PASS, including the earlier `calculateBalance` tests (unaffected by the mock consolidation since `vi.hoisted` variable names stayed the same).

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/utility-billing.service.ts backend/src/test/utility-billing.service.test.ts
git commit -m "feat(utility-billing): add generateStatement composing pro-rata/CO2/vacancy/balance"
```

---

## Task 5: `billing-dispute.service.ts`

**Files:**
- Create: `backend/src/services/billing-dispute.service.ts`
- Test: Create `backend/src/test/billing-dispute.service.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type DisputeStatus = "OPEN" | "IN_BEARBEITUNG" | "GELOEST" | "ABGELEHNT";
  export async function createDispute(companyId: number, contractId: number, data: { reason: string; amount?: number }): Promise<BillingDispute>;
  export async function listDisputesByCompany(companyId: number, status?: string): Promise<BillingDispute[]>;
  export async function listDisputesByContract(companyId: number, contractId: number): Promise<BillingDispute[]>;
  export async function updateDisputeStatus(companyId: number, id: number, status: DisputeStatus): Promise<BillingDispute>;
  ```
  Used by Task 6 (admin controller: `listDisputesByCompany`, `updateDisputeStatus`) and Task 8 (tenant controller: `createDispute`, `listDisputesByContract`).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/test/billing-dispute.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockFindMany, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    billingDispute: { create: mockCreate, findMany: mockFindMany, findFirst: mockFindFirst, update: mockUpdate },
  },
}));

import * as disputeSvc from "../services/billing-dispute.service.js";

describe("billing-dispute.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createDispute always starts a dispute as OPEN", async () => {
    mockCreate.mockResolvedValueOnce({ id: 1, status: "OPEN" });
    await disputeSvc.createDispute(1, 42, { reason: "Zu teuer", amount: 50 });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { contractId: 42, companyId: 1, reason: "Zu teuer", amount: 50, status: "OPEN" },
    });
  });

  it("listDisputesByCompany filters by status when given", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await disputeSvc.listDisputesByCompany(1, "OPEN");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { companyId: 1, status: "OPEN" },
      include: { contract: { include: { tenant: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("updateDisputeStatus throws NotFoundError when the dispute belongs to another company", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(disputeSvc.updateDisputeStatus(1, 999, "GELOEST")).rejects.toThrow("nicht gefunden");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/billing-dispute.service.test.ts`
Expected: FAIL — module `../services/billing-dispute.service.js` does not exist.

- [ ] **Step 3: Implement the service**

```typescript
// backend/src/services/billing-dispute.service.ts
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

export const DISPUTE_STATUSES = ["OPEN", "IN_BEARBEITUNG", "GELOEST", "ABGELEHNT"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export async function createDispute(
  companyId: number,
  contractId: number,
  data: { reason: string; amount?: number }
) {
  return prisma.billingDispute.create({
    data: {
      contractId,
      companyId,
      reason: data.reason,
      amount: data.amount ?? null,
      status: "OPEN",
    },
  });
}

export async function listDisputesByCompany(companyId: number, status?: string) {
  return prisma.billingDispute.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: { contract: { include: { tenant: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listDisputesByContract(companyId: number, contractId: number) {
  return prisma.billingDispute.findMany({
    where: { companyId, contractId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDisputeStatus(companyId: number, id: number, status: DisputeStatus) {
  const existing = await prisma.billingDispute.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Widerspruch", id);
  return prisma.billingDispute.update({ where: { id }, data: { status } });
}
```

- [ ] **Step 4: Run the tests again**

Run: `cd backend && npx vitest run src/test/billing-dispute.service.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/billing-dispute.service.ts backend/src/test/billing-dispute.service.test.ts
git commit -m "feat(billing-dispute): add shared service for creating/listing/resolving disputes"
```

---

## Task 6: Admin `/api/utility-billing` routes

**Files:**
- Create: `backend/src/schemas/utility-billing.schema.ts`
- Create: `backend/src/controllers/utility-billing.controller.ts`
- Create: `backend/src/routes/utility-billing.routes.ts`
- Modify: `backend/src/routes/index.ts` (mount the router)
- Test: Create `backend/src/test/utility-billing.controller.test.ts`

**Interfaces:**
- Consumes: `UtilityBillingService.generateStatement` (Task 4), `billing-dispute.service.ts` (Task 5).
- Produces: `POST /api/utility-billing/statements/generate`, `GET /api/utility-billing/disputes`, `PATCH /api/utility-billing/disputes/:id` — used by Task 9/10 (admin frontend hook).

- [ ] **Step 1: Write the schema**

```typescript
// backend/src/schemas/utility-billing.schema.ts
import { z } from "zod";
import { DISPUTE_STATUSES } from "../services/billing-dispute.service.js";

export const generateStatementSchema = z.object({
  propertyId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
});

export const listDisputesQuerySchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
});

export const updateDisputeStatusSchema = z.object({
  status: z.enum(DISPUTE_STATUSES),
});
```

- [ ] **Step 2: Write the failing controller test**

```typescript
// backend/src/test/utility-billing.controller.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockGenerateStatement } = vi.hoisted(() => ({ mockGenerateStatement: vi.fn() }));
vi.mock("../services/utility-billing.service.js", () => ({
  UtilityBillingService: vi.fn().mockImplementation(() => ({ generateStatement: mockGenerateStatement })),
}));

const { mockListDisputesByCompany, mockUpdateDisputeStatus } = vi.hoisted(() => ({
  mockListDisputesByCompany: vi.fn(),
  mockUpdateDisputeStatus: vi.fn(),
}));
vi.mock("../services/billing-dispute.service.js", () => ({
  listDisputesByCompany: mockListDisputesByCompany,
  updateDisputeStatus: mockUpdateDisputeStatus,
}));

import * as ctrl from "../controllers/utility-billing.controller.js";
import { requireRole } from "../middleware/requireRole.js";

function makeRes() {
  return { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as unknown as Response;
}

describe("utility-billing.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requireRole rejects READONLY from generating statements (RBAC gate on the route)", () => {
    const next = vi.fn();
    const req = { user: { id: 1, companyId: 1, role: "READONLY" } } as unknown as Request;
    const res = makeRes();

    requireRole("ADMIN", "VERWALTER", "BUCHHALTER")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("generateStatement scopes the service to req.companyId and returns its result", async () => {
    mockGenerateStatement.mockResolvedValueOnce({ year: 2026, propertyId: 3 });
    const req = { companyId: 1, body: { propertyId: 3, year: 2026 } } as unknown as Request;
    const res = makeRes();

    await ctrl.generateStatement(req, res);

    expect(mockGenerateStatement).toHaveBeenCalledWith(3, 2026);
    expect(res.json).toHaveBeenCalledWith({ data: { year: 2026, propertyId: 3 } });
  });

  it("listDisputes forwards the status query param", async () => {
    mockListDisputesByCompany.mockResolvedValueOnce([]);
    const req = { companyId: 1, query: { status: "OPEN" } } as unknown as Request;
    const res = makeRes();

    await ctrl.listDisputes(req, res);

    expect(mockListDisputesByCompany).toHaveBeenCalledWith(1, "OPEN");
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/utility-billing.controller.test.ts`
Expected: FAIL — `../controllers/utility-billing.controller.js` does not exist.

- [ ] **Step 4: Implement the controller**

```typescript
// backend/src/controllers/utility-billing.controller.ts
import type { Request, Response } from "express";
import { UtilityBillingService } from "../services/utility-billing.service.js";
import * as disputeSvc from "../services/billing-dispute.service.js";
import type { DisputeStatus } from "../services/billing-dispute.service.js";

export async function generateStatement(req: Request, res: Response): Promise<void> {
  const { propertyId, year } = req.body as { propertyId: number; year: number };
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.generateStatement(propertyId, year);
  res.json({ data });
}

export async function listDisputes(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const data = await disputeSvc.listDisputesByCompany(req.companyId!, status);
  res.json({ data });
}

export async function updateDisputeStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: DisputeStatus };
  const data = await disputeSvc.updateDisputeStatus(req.companyId!, Number(req.params.id), status);
  res.json({ data });
}
```

- [ ] **Step 5: Implement the routes**

```typescript
// backend/src/routes/utility-billing.routes.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { idParamSchema } from "../schemas/common.schema.js";
import {
  generateStatementSchema,
  listDisputesQuerySchema,
  updateDisputeStatusSchema,
} from "../schemas/utility-billing.schema.js";
import * as ctrl from "../controllers/utility-billing.controller.js";

const router = Router();

router.post(
  "/statements/generate",
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ body: generateStatementSchema }),
  ctrl.generateStatement
);
router.get("/disputes", validate({ query: listDisputesQuerySchema }), ctrl.listDisputes);
router.patch(
  "/disputes/:id",
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: updateDisputeStatusSchema }),
  ctrl.updateDisputeStatus
);

export { router as utilityBillingRouter };
```

- [ ] **Step 6: Mount the router**

In `backend/src/routes/index.ts`:
- Add the import next to `financeRouter`: `import { utilityBillingRouter } from "./utility-billing.routes.js";`
- Add the mount line next to the `/finance` mount: `router.use("/utility-billing", requireAuth, tenantGuard, subscriptionGuard, utilityBillingRouter);`

- [ ] **Step 7: Run tests + typecheck**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/utility-billing.schema.ts backend/src/controllers/utility-billing.controller.ts backend/src/routes/utility-billing.routes.ts backend/src/routes/index.ts backend/src/test/utility-billing.controller.test.ts
git commit -m "feat(utility-billing): add admin /api/utility-billing routes (generate statement, list/resolve disputes)"
```

---

## Task 7: Tenant-portal — utility summary + meter self-service

**Files:**
- Modify: `backend/src/schemas/tenantPortal.schema.ts` (add `utilityQuerySchema`)
- Modify: `backend/src/services/tenantPortal.service.ts` (add `getActiveContract`, `getUtilitySummary`, `getOwnMeters`, `addOwnMeterReading`)
- Modify: `backend/src/controllers/tenantPortal.controller.ts` (add `getUtility`, `getMeters`, `addMeterReading`, `scanMeterReadingPhoto`)
- Modify: `backend/src/routes/tenantPortal.routes.ts` (wire the routes)
- Test: Create `backend/src/test/tenantPortal.utility.test.ts`

**Interfaces:**
- Consumes: `UtilityBillingService.generateStatement` (Task 4), existing `createMeterReadingSchema` from `backend/src/schemas/meter.schema.ts`, existing `scanMeterReading` from `backend/src/services/receipt.service.ts`, existing `tenantPhotoMiddleware` from `backend/src/middleware/tenantUpload.ts`.
- Produces: `GET /api/tenant/:slug/utility?year=`, `GET /api/tenant/:slug/meters`, `POST /api/tenant/:slug/meters/:id/readings`, `POST /api/tenant/:slug/meters/:id/readings/scan` — used by Task 11/12 (tenant-portal frontend hooks).

- [ ] **Step 1: Write the failing isolation tests**

```typescript
// backend/src/test/tenantPortal.utility.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTenantFindUnique, mockMeterFindMany, mockMeterFindFirst, mockMeterReadingCreate, mockContractFindFirst } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockMeterFindMany: vi.fn(),
  mockMeterFindFirst: vi.fn(),
  mockMeterReadingCreate: vi.fn(),
  mockContractFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenant: { findUnique: mockTenantFindUnique },
    meter: { findMany: mockMeterFindMany, findFirst: mockMeterFindFirst },
    meterReading: { create: mockMeterReadingCreate },
    contract: { findFirst: mockContractFindFirst },
  },
}));

import { getOwnMeters, addOwnMeterReading } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service utility/meters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getOwnMeters only queries meters attached to the tenant's own units", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ units: [{ id: 5 }, { id: 6 }] });
    mockMeterFindMany.mockResolvedValueOnce([]);

    await getOwnMeters(tenantUser);

    expect(mockMeterFindMany).toHaveBeenCalledWith({
      where: { companyId: 1, unitId: { in: [5, 6] } },
      include: { readings: { orderBy: { readAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
  });

  it("addOwnMeterReading rejects a meter that isn't on one of the tenant's own units", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ units: [{ id: 5 }] });
    mockMeterFindFirst.mockResolvedValueOnce(null); // meter 99 belongs to unit 7, filtered out by unitId: { in: [5] }

    await expect(
      addOwnMeterReading(tenantUser, 99, { value: 100, readAt: "2026-01-01T00:00:00.000Z" })
    ).rejects.toThrow("nicht gefunden");

    expect(mockMeterReadingCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/tenantPortal.utility.test.ts`
Expected: FAIL — `getOwnMeters`/`addOwnMeterReading` are not exported from `tenantPortal.service.js`.

- [ ] **Step 3: Add the schema**

In `backend/src/schemas/tenantPortal.schema.ts`, add:

```typescript
export const utilityQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
```

- [ ] **Step 4: Add the service functions**

In `backend/src/services/tenantPortal.service.ts`, add (near the top, after the `TenantUser` type, and reusing the `UtilityBillingService` import):

```typescript
import { UtilityBillingService } from "./utility-billing.service.js";

async function getActiveContract(tenantUser: TenantUser) {
  const contract = await prisma.contract.findFirst({
    where: { tenantId: tenantUser.tenantId, companyId: tenantUser.companyId, status: "AKTIV" },
    orderBy: { startDate: "desc" },
  });
  if (!contract) throw new NotFoundError("Aktiver Vertrag", tenantUser.tenantId);
  return contract;
}

export async function getUtilitySummary(tenantUser: TenantUser, year?: number) {
  const contract = await getActiveContract(tenantUser);
  const targetYear = year ?? new Date().getFullYear() - 1;
  const svc = new UtilityBillingService(tenantUser.companyId);
  const statement = await svc.generateStatement(contract.propertyId, targetYear);
  const item = statement.items.find((i) => i.contractId === contract.id);
  return {
    year: targetYear,
    totalCosts: item?.amount ?? 0,
    balance: item?.balance ?? 0,
    isRefund: item?.isRefund ?? false,
    categories: statement.transactions
      .filter((tx) => tx.betrkvCategory)
      .map((tx) => ({ category: tx.betrkvCategory, amount: Math.abs(tx.amount) })),
  };
}

export async function getOwnMeters(tenantUser: TenantUser) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantUser.tenantId },
    select: { units: { select: { id: true } } },
  });
  const unitIds = tenant?.units.map((u) => u.id) ?? [];
  return prisma.meter.findMany({
    where: { companyId: tenantUser.companyId, unitId: { in: unitIds } },
    include: { readings: { orderBy: { readAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addOwnMeterReading(
  tenantUser: TenantUser,
  meterId: number,
  data: { value: number; readAt: string; note?: string }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantUser.tenantId },
    select: { units: { select: { id: true } } },
  });
  const unitIds = tenant?.units.map((u) => u.id) ?? [];
  const meter = await prisma.meter.findFirst({
    where: { id: meterId, companyId: tenantUser.companyId, unitId: { in: unitIds } },
  });
  if (!meter) throw new NotFoundError("Zähler", meterId);
  return prisma.meterReading.create({
    data: { value: data.value, readAt: new Date(data.readAt), note: data.note, meterId, companyId: tenantUser.companyId },
  });
}
```

Note: `getActiveContract` throwing `NotFoundError` means a tenant with no `AKTIV` contract gets a 404 on `GET /utility` — expected, since there's nothing to bill.

- [ ] **Step 5: Add the controller functions**

In `backend/src/controllers/tenantPortal.controller.ts`, add the imports at the top:

```typescript
import fs from "fs";
import { env } from "../config/env.js";
import { scanMeterReading } from "../services/receipt.service.js";
```

Then add, in a new `// ─── Utility Billing ───` section:

```typescript
export async function getUtility(req: Request, res: Response): Promise<void> {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const data = await svc.getUtilitySummary(req.tenantUser!, year);
  res.json({ data });
}

export async function getMeters(req: Request, res: Response): Promise<void> {
  const data = await svc.getOwnMeters(req.tenantUser!);
  res.json({ data });
}

export async function addMeterReading(req: Request, res: Response): Promise<void> {
  const data = await svc.addOwnMeterReading(
    req.tenantUser!,
    Number(req.params.id),
    req.body as { value: number; readAt: string; note?: string }
  );
  res.status(201).json({ data });
}

export async function scanMeterReadingPhoto(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Kein Foto hochgeladen" });
    return;
  }
  if (!env.ANTHROPIC_API_KEY) {
    fs.unlink(file.path, () => {});
    res.status(503).json({ error: "KI-Scan ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)" });
    return;
  }
  try {
    const data = await scanMeterReading(file.path, file.mimetype);
    res.json({ data });
  } finally {
    fs.unlink(file.path, () => {});
  }
}
```

- [ ] **Step 6: Wire the routes**

In `backend/src/routes/tenantPortal.routes.ts`:
- Add to the imports: `import { utilityQuerySchema } from "../schemas/tenantPortal.schema.js";` and `import { createMeterReadingSchema } from "../schemas/meter.schema.js";`
- Add after the `// ─── Finances ───` block:

```typescript
// ─── Utility Billing ────────────────────────────────────────────────────────
router.get("/utility", validate({ query: utilityQuerySchema }), ctrl.getUtility);
router.get("/meters", ctrl.getMeters);
router.post(
  "/meters/:id/readings",
  validate({ params: tenantPortalIdParamSchema, body: createMeterReadingSchema }),
  ctrl.addMeterReading
);
router.post("/meters/:id/readings/scan", tenantPhotoMiddleware, ctrl.scanMeterReadingPhoto);
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `cd backend && npx vitest run src/test/tenantPortal.utility.test.ts && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/tenantPortal.schema.ts backend/src/services/tenantPortal.service.ts backend/src/controllers/tenantPortal.controller.ts backend/src/routes/tenantPortal.routes.ts backend/src/test/tenantPortal.utility.test.ts
git commit -m "feat(tenant-portal): add utility summary + meter self-service endpoints (manual + photo OCR)"
```

---

## Task 8: Tenant-portal — billing disputes

**Files:**
- Modify: `backend/src/schemas/tenantPortal.schema.ts` (add `createDisputeSchema`)
- Modify: `backend/src/services/tenantPortal.service.ts` (add `createDispute`, `getDisputes`)
- Modify: `backend/src/controllers/tenantPortal.controller.ts` (add `createDispute`, `getDisputes`)
- Modify: `backend/src/routes/tenantPortal.routes.ts` (wire the routes)
- Test: Create `backend/src/test/tenantPortal.disputes.test.ts`

**Interfaces:**
- Consumes: `getActiveContract` (private helper added in Task 7), `billing-dispute.service.ts` (Task 5).
- Produces: `POST /api/tenant/:slug/billing-disputes`, `GET /api/tenant/:slug/billing-disputes` — used by Task 13 (tenant-portal frontend hook).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/test/tenantPortal.disputes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockContractFindFirst, mockDisputeCreate } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockDisputeCreate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contract: { findFirst: mockContractFindFirst },
    billingDispute: { create: mockDisputeCreate },
  },
}));

import { createDispute } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service createDispute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets contractId from the tenant's own active contract, never from client input", async () => {
    mockContractFindFirst.mockResolvedValueOnce({ id: 77, propertyId: 3 });
    mockDisputeCreate.mockResolvedValueOnce({ id: 1, status: "OPEN" });

    await createDispute(tenantUser, { reason: "Gartenpflege zu teuer", amount: 40 });

    expect(mockContractFindFirst).toHaveBeenCalledWith({
      where: { tenantId: 10, companyId: 1, status: "AKTIV" },
      orderBy: { startDate: "desc" },
    });
    expect(mockDisputeCreate).toHaveBeenCalledWith({
      data: { contractId: 77, companyId: 1, reason: "Gartenpflege zu teuer", amount: 40, status: "OPEN" },
    });
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/tenantPortal.disputes.test.ts`
Expected: FAIL — `createDispute` is not exported from `tenantPortal.service.js`.

- [ ] **Step 3: Add the schema**

In `backend/src/schemas/tenantPortal.schema.ts`, add:

```typescript
export const createDisputeSchema = z.object({
  reason: z.string().min(10, "Begründung muss mindestens 10 Zeichen lang sein").max(1000),
  amount: z.number().positive().optional(),
});
```

- [ ] **Step 4: Add the service functions**

In `backend/src/services/tenantPortal.service.ts`, add the import and functions:

```typescript
import * as disputeSvc from "./billing-dispute.service.js";

export async function createDispute(tenantUser: TenantUser, data: { reason: string; amount?: number }) {
  const contract = await getActiveContract(tenantUser);
  return disputeSvc.createDispute(tenantUser.companyId, contract.id, data);
}

export async function getDisputes(tenantUser: TenantUser) {
  const contract = await getActiveContract(tenantUser);
  return disputeSvc.listDisputesByContract(tenantUser.companyId, contract.id);
}
```

- [ ] **Step 5: Add the controller functions**

In `backend/src/controllers/tenantPortal.controller.ts`, add:

```typescript
export async function createDispute(req: Request, res: Response): Promise<void> {
  const data = await svc.createDispute(req.tenantUser!, req.body as { reason: string; amount?: number });
  res.status(201).json({ data });
}

export async function getDisputes(req: Request, res: Response): Promise<void> {
  const data = await svc.getDisputes(req.tenantUser!);
  res.json({ data });
}
```

- [ ] **Step 6: Wire the routes**

In `backend/src/routes/tenantPortal.routes.ts`:
- Add to imports: `import { createDisputeSchema } from "../schemas/tenantPortal.schema.js";` (combine with the `utilityQuerySchema` import from Task 7 into one import statement)
- Add after the `// ─── Utility Billing ───` block:

```typescript
// ─── Billing Disputes ─────────────────────────────────────────────────────────
router.post("/billing-disputes", validate({ body: createDisputeSchema }), ctrl.createDispute);
router.get("/billing-disputes", ctrl.getDisputes);
```

- [ ] **Step 7: Run the tests and full backend suite**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/tenantPortal.schema.ts backend/src/services/tenantPortal.service.ts backend/src/controllers/tenantPortal.controller.ts backend/src/routes/tenantPortal.routes.ts backend/src/test/tenantPortal.disputes.test.ts
git commit -m "feat(tenant-portal): add billing-dispute self-service endpoints"
```

---

## Task 9: Admin frontend — `UtilityBillingWizard.tsx` config + validation tabs

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useUtilityBilling.ts`
- Modify: `cozy-estate-central/src/hooks/api/useFinance.ts:160-169` (widen `useUpdateTransaction`'s type)
- Modify: `cozy-estate-central/src/pages/UtilityBillingWizard.tsx`

**Interfaces:**
- Consumes: `POST /utility-billing/statements/generate` (Task 6), `PATCH /finance/transactions/:id` with `betrkvCategory`/`co2TaxAmount` (Task 3), existing `useProperties` hook, existing `api` from `@/lib/api`.
- Produces: `useGenerateUtilityStatement()`, `UtilityStatement`/`UtilityStatementItem`/`UtilityStatementTransaction` types — used by Task 10 (same file, disputes tab). Widened `useUpdateTransaction` data type — used by this task's own wizard wiring.

- [ ] **Step 1: Widen `useUpdateTransaction`'s type to accept the new tagging fields**

In `cozy-estate-central/src/hooks/api/useFinance.ts`, replace the `useUpdateTransaction` function:

```typescript
export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { allocatable?: boolean; category?: string; betrkvCategory?: string; co2TaxAmount?: number } }) =>
      api(`/finance/transactions/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
  });
}
```

- [ ] **Step 2: Create the hook**

```typescript
// cozy-estate-central/src/hooks/api/useUtilityBilling.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface UtilityStatementTransaction {
  id: number;
  description: string;
  amount: number;
  betrkvCategory: string | null;
  maintenanceWarning: string | null;
  co2TaxAmount: number | null;
}

export interface UtilityStatementItem {
  contractId: number;
  unitId: number;
  unitNumber: string;
  tenantName: string;
  area: number;
  amount: number;
  balance: number;
  isRefund: boolean;
}

export interface UtilityStatement {
  year: number;
  propertyId: number;
  totalCosts: number;
  co2: { energyClass: string | null; co2Emissions: number | null; landlordPercentage: number; tenantShare: number; landlordShare: number };
  vacancy: { amount: number; vacancyDays: number; affectedUnits: string[] } | null;
  items: UtilityStatementItem[];
  transactions: UtilityStatementTransaction[];
}

export function useGenerateUtilityStatement() {
  return useMutation({
    mutationFn: (data: { propertyId: number; year: number }) =>
      api<{ data: UtilityStatement }>("/utility-billing/statements/generate", {
        method: "POST",
        body: data,
      }),
  });
}

export interface UtilityDispute {
  id: number;
  reason: string;
  status: string;
  amount: number | null;
  createdAt: string;
  contract: { tenant: { id: number; name: string } };
}

export function useUtilityDisputes(status?: string) {
  return useQuery({
    queryKey: ["utility-billing", "disputes", status],
    queryFn: () => api<{ data: UtilityDispute[] }>("/utility-billing/disputes", { params: { status } }),
  });
}

export function useUpdateDisputeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/utility-billing/disputes/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["utility-billing", "disputes"] }),
  });
}
```

- [ ] **Step 3: Rewrite the config + validation tabs of `UtilityBillingWizard.tsx`**

Replace the entire file content with (this keeps the "Generierung" tab as a static placeholder unchanged — building real PDF generation for the new statement format is out of scope for this pass per the approved spec — and stubs the "Widersprüche" tab, completed in Task 10):

```tsx
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, Settings, FileText, Send, AlertTriangle, Leaf, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useProperties } from "@/hooks/api/useProperties";
import { useGenerateUtilityStatement } from "@/hooks/api/useUtilityBilling";
import type { UtilityStatementTransaction } from "@/hooks/api/useUtilityBilling";
import { useUpdateTransaction } from "@/hooks/api/useFinance";

const BETRKV_CATEGORIES = [
  "GRUNDSTEUER", "WASSERVERSORGUNG", "ENTWAESSERUNG", "AUFZUG",
  "STRASSENREINIGUNG_MUELL", "GEBAEUDE_REINIGUNG", "GARTENPFLEGE",
  "BELEUCHTUNG", "SCHORNSTEINREINIGUNG", "VERSICHERUNGEN", "HAUSWART",
  "GEMEINSCHAFTS_ANTENNE", "WASCHRAUM", "SONSTIGE_KOSTEN",
];

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function UtilityBillingWizard() {
  const [activeTab, setActiveTab] = useState("config");
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const { toast } = useToast();

  const { data: propertiesRes } = useProperties();
  const properties = propertiesRes?.data ?? [];
  const generateStatement = useGenerateUtilityStatement();
  const updateTransaction = useUpdateTransaction();
  const statement = generateStatement.data?.data ?? null;

  const handleGenerate = () => {
    if (!propertyId) {
      toast({ title: "Bitte zuerst eine Immobilie auswählen", variant: "destructive" });
      return;
    }
    generateStatement.mutate(
      { propertyId, year },
      {
        onSuccess: () => setActiveTab("validation"),
        onError: (err: unknown) =>
          toast({ title: "Berechnung fehlgeschlagen", description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleTagUpdate = (tx: UtilityStatementTransaction, field: "betrkvCategory" | "co2TaxAmount", value: string) => {
    const data = field === "co2TaxAmount" ? { co2TaxAmount: Number(value) || 0 } : { betrkvCategory: value };
    updateTransaction.mutate(
      { id: tx.id, data },
      {
        onSuccess: () => {
          if (propertyId) generateStatement.mutate({ propertyId, year });
        },
      }
    );
  };

  const warningCount = statement?.transactions.filter((t) => t.maintenanceWarning).length ?? 0;

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nebenkosten-Assistent</h1>
          <p className="text-muted-foreground mt-1">
            Geführter Prozess zur rechtssicheren Erstellung der Betriebskostenabrechnung.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            1. Konfiguration
          </TabsTrigger>
          <TabsTrigger value="validation" className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            2. Validierung
            {warningCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {warningCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="generation" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            3. Generierung
          </TabsTrigger>
          <TabsTrigger value="disputes" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            4. Widersprüche
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Konfiguration ─── */}
        <TabsContent value="config">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Immobilie & Abrechnungsjahr</CardTitle>
                <CardDescription>
                  Wählen Sie die Immobilie und das Abrechnungsjahr, für das die Nebenkosten berechnet werden sollen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Select value={propertyId ? String(propertyId) : undefined} onValueChange={(v) => setPropertyId(Number(v))}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Immobilie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((offset) => {
                        const y = new Date().getFullYear() - 1 - offset;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleGenerate} disabled={generateStatement.isPending}>
                    {generateStatement.isPending ? "Berechne..." : "Kosten berechnen"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {statement && (
              <>
                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Leaf className="w-5 h-5" />
                      CO₂-Kostenaufteilung (Stufenmodell)
                    </CardTitle>
                    <CardDescription>
                      Automatische Berechnung gem. CO2KostAufG basierend auf dem Energieausweis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Energieklasse</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{statement.co2.energyClass ?? "–"}</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">CO₂ kg/m²/a</p>
                        <p className="text-2xl font-bold">{statement.co2.co2Emissions ?? "–"}</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Vermieter-Anteil</p>
                        <p className="text-lg font-bold text-red-600">{statement.co2.landlordPercentage}% = {formatEur(statement.co2.landlordShare)}</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Mieter-Anteil</p>
                        <p className="text-lg font-bold text-blue-600">{formatEur(statement.co2.tenantShare)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {statement.vacancy && (
                  <Card className="border-amber-200 dark:border-amber-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Building2 className="w-5 h-5" />
                        Leerstand erkannt
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm">
                        <p>
                          <strong>{statement.vacancy.affectedUnits.join(", ")}</strong> war insgesamt <strong>{statement.vacancy.vacancyDays} Tage</strong> im Abrechnungszeitraum unvermietet.
                        </p>
                        <p className="mt-2">
                          Die anteiligen Fixkosten von <strong>{formatEur(statement.vacancy.amount)}</strong> werden automatisch dem Eigentümer zugeordnet und <em>nicht</em> auf die übrigen Mieter umgelegt.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end mt-6">
                  <Button onClick={() => setActiveTab("validation")}>
                    Weiter zur Kosten-Validierung
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ─── Tab 2: Validierung ─── */}
        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle>Validierung der Belege & Kosten</CardTitle>
              <CardDescription>
                Überprüfen Sie die vorklassifizierten Buchungen (KI/PSD2). Nur freigegebene Kosten fließen in die Abrechnung ein.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!statement || statement.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bitte zuerst in Schritt 1 die Kosten berechnen.</p>
              ) : (
                statement.transactions.map((tx) => (
                  <div key={tx.id} className="space-y-0">
                    <div className={`flex justify-between items-center p-3 rounded-lg border ${tx.maintenanceWarning ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                      <div className="flex items-center gap-3 flex-1">
                        <div>
                          <span className="font-medium">{tx.description}</span>
                          <div className="flex gap-2 mt-1 items-center">
                            <Select value={tx.betrkvCategory ?? undefined} onValueChange={(v) => handleTagUpdate(tx, "betrkvCategory", v)}>
                              <SelectTrigger className="h-7 text-xs w-[220px]">
                                <SelectValue placeholder="BetrKV-Kategorie" />
                              </SelectTrigger>
                              <SelectContent>
                                {BETRKV_CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="CO₂-Steuer €"
                              defaultValue={tx.co2TaxAmount ?? ""}
                              onBlur={(e) => handleTagUpdate(tx, "co2TaxAmount", e.target.value)}
                              className="h-7 w-28 text-xs rounded border border-input px-2"
                            />
                            {tx.co2TaxAmount != null && tx.co2TaxAmount > 0 && (
                              <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                                <Leaf className="w-3 h-3 mr-1" />
                                CO₂: {formatEur(tx.co2TaxAmount)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="font-bold text-right">{formatEur(tx.amount)}</div>
                    </div>

                    {tx.maintenanceWarning && (
                      <div className="flex items-start gap-3 p-3 mx-2 -mt-1 bg-amber-100 dark:bg-amber-950/40 border border-t-0 border-amber-300 dark:border-amber-800 rounded-b-lg text-sm text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-semibold">⚠ KI-Warnung: Nicht-umlagefähige Reparaturkosten erkannt</p>
                          <p className="mt-1">{tx.maintenanceWarning}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("config")}>
                  Zurück
                </Button>
                <Button onClick={() => setActiveTab("generation")}>
                  Weiter zur Generierung
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Generierung ─── */}
        <TabsContent value="generation">
          <Card>
            <CardHeader>
              <CardTitle>Massen-Generierung</CardTitle>
              <CardDescription>
                Der Export der neuen, erweiterten Abrechnung (CO₂/Leerstand-bereinigt) als PDF ist noch nicht Teil dieses Assistenten — nutzen Sie bis dahin den bestehenden PDF-Export unter Finanzen &gt; Nebenkostenabrechnung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statement && (
                <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900 text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Berechnung abgeschlossen</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    {statement.items.length} Vertrag/Verträge und {statement.transactions.length} freigegebene Buchungen berücksichtigt.
                  </p>
                </div>
              )}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("validation")}>
                  Zurück
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Widersprüche ─── */}
        <TabsContent value="disputes">
          {/* wired in a follow-up task */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Run `cd cozy-estate-central && npm run dev`, log in, navigate to `/utility-billing`. Select a property + year, click "Kosten berechnen". Confirm the CO2/vacancy cards and transaction list render from real API data (not the old hardcoded mock array), and that editing a transaction's BetrKV-Kategorie/CO₂-Steuer field persists (check via `GET /finance/transactions` or reload).

- [ ] **Step 5: Typecheck**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useUtilityBilling.ts cozy-estate-central/src/hooks/api/useFinance.ts cozy-estate-central/src/pages/UtilityBillingWizard.tsx
git commit -m "feat(admin): wire UtilityBillingWizard config+validation tabs to real /utility-billing API"
```

---

## Task 10: Admin frontend — `UtilityBillingWizard.tsx` disputes tab

**Files:**
- Modify: `cozy-estate-central/src/pages/UtilityBillingWizard.tsx`

**Interfaces:**
- Consumes: `useUtilityDisputes`, `useUpdateDisputeStatus`, `UtilityDispute` (Task 9's hook file).

- [ ] **Step 1: Wire the disputes tab**

In `cozy-estate-central/src/pages/UtilityBillingWizard.tsx`:

Add to the imports:
```tsx
import { useUtilityDisputes, useUpdateDisputeStatus } from "@/hooks/api/useUtilityBilling";
```

Inside the `UtilityBillingWizard` component, add near the other hooks:
```tsx
  const { data: disputesRes } = useUtilityDisputes("OPEN");
  const disputes = disputesRes?.data ?? [];
  const updateDisputeStatus = useUpdateDisputeStatus();
```

Update the "4. Widersprüche" `TabsTrigger` to show the real count (replace the existing trigger markup):
```tsx
          <TabsTrigger value="disputes" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            4. Widersprüche
            {disputes.length > 0 && (
              <Badge variant="outline" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] border-amber-500 text-amber-600">
                {disputes.length}
              </Badge>
            )}
          </TabsTrigger>
```

Replace the `<TabsContent value="disputes">` placeholder from Task 9:
```tsx
        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Offene Abrechnungs-Widersprüche
              </CardTitle>
              <CardDescription>
                Mieter haben über das Mieter-Portal „Zahlung unter Vorbehalt" gewählt. Bitte prüfen und beantworten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {disputes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
                  <p>Keine offenen Widersprüche. Alles erledigt!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div key={d.id} className="border rounded-lg p-4 bg-white dark:bg-slate-800 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{d.contract.tenant.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{d.reason}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="border-amber-500 text-amber-600">{d.status}</Badge>
                          {d.amount != null && <p className="text-sm font-bold mt-1">{formatEur(d.amount)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          Eingereicht am {new Date(d.createdAt).toLocaleDateString("de-DE")}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateDisputeStatus.mutate({ id: d.id, status: "ABGELEHNT" })}
                          >
                            Ablehnen
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => updateDisputeStatus.mutate({ id: d.id, status: "GELOEST" })}
                          >
                            Als gelöst markieren
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
```

- [ ] **Step 2: Manually verify in the browser**

With a `BillingDispute` row seeded in the DB (via Prisma Studio or the tenant-portal flow from Task 13), navigate to `/utility-billing`, open the "Widersprüche" tab, confirm the real dispute shows, and clicking "Als gelöst markieren" updates its status (list refetches and the item disappears since the query is filtered to `status=OPEN`).

- [ ] **Step 3: Typecheck**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/pages/UtilityBillingWizard.tsx
git commit -m "feat(admin): wire UtilityBillingWizard disputes tab to real /utility-billing/disputes API"
```

---

## Task 11: Tenant frontend — `MeterReadingSelfService.tsx`

**Files:**
- Create: `tenant-portal/src/hooks/api/useTenantMeters.ts`
- Modify: `tenant-portal/src/pages/MeterReadingSelfService.tsx`

**Interfaces:**
- Consumes: `GET /meters`, `POST /meters/:id/readings`, `POST /meters/:id/readings/scan` (Task 7), existing `tenantApi` from `@/lib/api`.

- [ ] **Step 1: Create the hook**

```typescript
// tenant-portal/src/hooks/api/useTenantMeters.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantMeter {
  id: number;
  label: string;
  type: string;
  readings: { id: number; value: number; readAt: string }[];
}

export function useTenantMeters(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "meters"],
    queryFn: () => tenantApi<{ data: TenantMeter[] }>(slug, "/meters"),
    select: (res) => res.data,
  });
}

export function useSubmitMeterReading(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ meterId, value, readAt, note }: { meterId: number; value: number; readAt: string; note?: string }) =>
      tenantApi(slug, `/meters/${meterId}/readings`, { method: "POST", body: { value, readAt, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "meters"] }),
  });
}

export interface ScannedMeterReading {
  value: number | null;
  unit: string | null;
}

export function useScanMeterReading(slug: string) {
  return useMutation({
    mutationFn: ({ meterId, photo }: { meterId: number; photo: File }) => {
      const form = new FormData();
      form.append("photo", photo);
      return tenantApi<{ data: ScannedMeterReading }>(slug, `/meters/${meterId}/readings/scan`, {
        method: "POST",
        body: form,
        isFormData: true,
      });
    },
  });
}
```

- [ ] **Step 2: Rewrite the page**

Replace `tenant-portal/src/pages/MeterReadingSelfService.tsx` entirely:

```tsx
import React, { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTenantMeters, useSubmitMeterReading, useScanMeterReading } from "@/hooks/api/useTenantMeters";

export default function MeterReadingSelfService() {
  const { slug } = useParams<{ slug: string }>();
  const { data: meters, isLoading } = useTenantMeters(slug!);
  const submitReading = useSubmitMeterReading(slug!);
  const scanReading = useScanMeterReading(slug!);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [meterId, setMeterId] = useState<number | null>(null);
  const [reading, setReading] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const selectedMeter = meters?.find((m) => m.id === meterId) ?? null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !meterId) return;
    setPhoto(file);
    try {
      const res = await scanReading.mutateAsync({ meterId, photo: file });
      if (res.data.value != null) {
        setReading(String(res.data.value));
        toast.success("Zählerstand erkannt — bitte prüfen");
      } else {
        toast.error("Zählerstand konnte nicht automatisch erkannt werden. Bitte manuell eingeben.");
      }
    } catch {
      toast.error("KI-Scan fehlgeschlagen. Bitte Zählerstand manuell eingeben.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meterId || !reading) {
      toast.error("Bitte Zähler auswählen und Zählerstand eingeben.");
      return;
    }
    try {
      await submitReading.mutateAsync({ meterId, value: Number(reading), readAt: new Date().toISOString() });
      setSubmitted(true);
      toast.success("Zählerstand erfolgreich übermittelt");
    } catch {
      toast.error("Übermittlung fehlgeschlagen. Bitte erneut versuchen.");
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold">Vielen Dank!</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Dein Zählerstand wurde erfolgreich übermittelt und wird für die nächste Nebenkostenabrechnung verwendet.
        </p>
        <Button
          variant="outline"
          onClick={() => { setSubmitted(false); setReading(""); setPhoto(null); setMeterId(null); }}
          className="mt-4"
        >
          Weiteren Zähler erfassen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Zählerstand melden</h1>
        <p className="text-sm text-muted-foreground">
          Stichtagsmeldung für Wasser, Strom oder Heizung.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex gap-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p>Wichtiger Hinweis: Ein Foto des Zählers ist für die rechtssichere Nebenkostenabrechnung zwingend erforderlich.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zählerdaten eingeben</CardTitle>
          <CardDescription>
            {isLoading ? "Lade Zähler..." : meters?.length ? "Zähler auswählen und Stand erfassen" : "Keine Zähler gefunden"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="meter">Zähler</Label>
              <select
                id="meter"
                className="w-full h-10 rounded-md border border-input px-3 text-sm bg-background"
                value={meterId ?? ""}
                onChange={(e) => setMeterId(Number(e.target.value) || null)}
                required
              >
                <option value="" disabled>Zähler wählen</option>
                {(meters ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label} ({m.type})</option>
                ))}
              </select>
              {selectedMeter?.readings[0] && (
                <p className="text-xs text-muted-foreground">
                  Letzter Stand: {selectedMeter.readings[0].value} am {new Date(selectedMeter.readings[0].readAt).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reading">Aktueller Zählerstand</Label>
              <Input
                id="reading"
                type="number"
                step="0.001"
                placeholder="z.B. 145.5"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Belegfoto (empfohlen, KI liest den Stand automatisch aus)</Label>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              <div
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-3 transition-colors ${
                  photo ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" : "hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                {photo ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Foto aufgenommen{scanReading.isPending ? " — wird analysiert..." : ""}</p>
                      <button type="button" onClick={() => { setPhoto(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-xs text-muted-foreground underline mt-1">
                        Neu aufnehmen
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <Button type="button" variant="secondary" disabled={!meterId} onClick={() => fileInputRef.current?.click()}>
                        <Camera className="w-4 h-4 mr-2" />
                        Foto aufnehmen
                      </Button>
                      <Button type="button" variant="outline" disabled={!meterId} onClick={() => fileInputRef.current?.click()}>
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Datei wählen
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {meterId ? "Bitte stelle sicher, dass die Zählernummer und der Stand gut lesbar sind." : "Bitte zuerst einen Zähler auswählen."}
                    </p>
                  </>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!reading || !meterId || submitReading.isPending}>
              {submitReading.isPending ? "Wird gesendet..." : "Zählerstand verbindlich übermitteln"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Run `cd tenant-portal && npm run dev`, log in as a tenant with at least one meter (seed data or via admin `POST /meters`), navigate to the meter-reading page. Confirm the meter dropdown lists real meters, manual entry submits and shows the success screen, and (if `ANTHROPIC_API_KEY` is configured) uploading a photo pre-fills the reading value.

- [ ] **Step 4: Typecheck**

Run: `cd tenant-portal && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add tenant-portal/src/hooks/api/useTenantMeters.ts tenant-portal/src/pages/MeterReadingSelfService.tsx
git commit -m "feat(tenant-portal): wire MeterReadingSelfService to real meter/reading API (manual + photo OCR)"
```

---

## Task 12: Tenant frontend — `UtilityTransparency.tsx`

**Files:**
- Create: `tenant-portal/src/hooks/api/useTenantUtility.ts`
- Modify: `tenant-portal/src/pages/UtilityTransparency.tsx`

**Interfaces:**
- Consumes: `GET /utility?year=` (Task 7).

This page currently renders entirely decorative, hardcoded bar-chart mockups with no real backing data model. Per the approved spec, the real endpoint provides a cost-category breakdown + Nachzahlung/Guthaben balance — not month-by-month consumption history (that would need a separate feature building on `MeterReading` deltas). This task replaces the mock charts with the real breakdown, dropping the decorative consumption comparison.

- [ ] **Step 1: Create the hook**

```typescript
// tenant-portal/src/hooks/api/useTenantUtility.ts
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantUtilityCategory {
  category: string;
  amount: number;
}

export interface TenantUtilitySummary {
  year: number;
  totalCosts: number;
  balance: number;
  isRefund: boolean;
  categories: TenantUtilityCategory[];
}

export function useTenantUtility(slug: string, year?: number) {
  return useQuery({
    queryKey: ["tenant", slug, "utility", year],
    queryFn: () => tenantApi<{ data: TenantUtilitySummary }>(slug, year ? `/utility?year=${year}` : "/utility"),
    select: (res) => res.data,
  });
}
```

- [ ] **Step 2: Rewrite the page**

Replace `tenant-portal/src/pages/UtilityTransparency.tsx` entirely:

```tsx
import React from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ListChecks } from "lucide-react";
import { useTenantUtility } from "@/hooks/api/useTenantUtility";

function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function UtilityTransparency() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useTenantUtility(slug!);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Verbrauchstransparenz</h1>
        <p className="text-sm text-muted-foreground">
          Deine Nebenkosten {data ? `für ${data.year}` : ""} im Überblick.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white border rounded-2xl p-6 animate-pulse h-32" />
      ) : !data ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Noch keine Abrechnungsdaten für dein Vertragsjahr verfügbar.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={data.balance < 0 ? "border-red-200 dark:border-red-900" : "border-green-200 dark:border-green-900"}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {data.balance < 0 ? "Nachzahlung" : "Guthaben"}
                  </p>
                  <p className={`text-3xl font-bold ${data.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatEur(Math.abs(data.balance))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Gesamtkosten: {formatEur(data.totalCosts)}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${data.balance < 0 ? "bg-red-100" : "bg-green-100"}`}>
                  <CreditCard className={`w-6 h-6 ${data.balance < 0 ? "text-red-600" : "text-green-600"}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                Kostenaufstellung nach Kategorie
              </CardTitle>
              <CardDescription>Anteil der einzelnen Betriebskostenarten an deiner Abrechnung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine kategorisierten Kosten vorhanden.</p>
              ) : (
                data.categories.map((c, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                    <span>{c.category}</span>
                    <span className="font-medium">{formatEur(c.amount)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Navigate to the tenant portal's `/utility` route for a tenant with an `AKTIV` contract whose property has allocatable transactions for last year. Confirm the balance card and category list render real numbers (or the "no data" empty state if the admin hasn't generated a statement for that property/year yet).

- [ ] **Step 4: Typecheck**

Run: `cd tenant-portal && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add tenant-portal/src/hooks/api/useTenantUtility.ts tenant-portal/src/pages/UtilityTransparency.tsx
git commit -m "feat(tenant-portal): replace mock UtilityTransparency charts with real cost-breakdown + balance"
```

---

## Task 13: Tenant frontend — `BillingDisputeForm.tsx`

**Files:**
- Create: `tenant-portal/src/hooks/api/useTenantDisputes.ts`
- Modify: `tenant-portal/src/pages/BillingDisputeForm.tsx`

**Interfaces:**
- Consumes: `POST /billing-disputes` (Task 8), `useTenantUtility` (Task 12, for the real balance shown at the top of the page instead of the `totalBalance` prop default).

- [ ] **Step 1: Create the hook**

```typescript
// tenant-portal/src/hooks/api/useTenantDisputes.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export function useCreateDispute(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string; amount?: number }) =>
      tenantApi(slug, "/billing-disputes", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "disputes"] }),
  });
}
```

- [ ] **Step 2: Wire the form**

Replace `tenant-portal/src/pages/BillingDisputeForm.tsx` entirely:

```tsx
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, ShieldAlert, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTenantUtility } from "@/hooks/api/useTenantUtility";
import { useCreateDispute } from "@/hooks/api/useTenantDisputes";

const BETRKV_CATEGORIES = [
  "Grundsteuer", "Wasserversorgung", "Entwässerung", "Aufzug",
  "Straßenreinigung & Müll", "Gebäudereinigung", "Gartenpflege",
  "Beleuchtung", "Schornsteinreinigung", "Versicherungen", "Hauswart",
  "Gemeinschaftsantenne", "Waschraum", "Sonstige Kosten",
];

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function BillingDisputeForm() {
  const { slug } = useParams<{ slug: string }>();
  const { data: utility } = useTenantUtility(slug!);
  const createDispute = useCreateDispute(slug!);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0 || !reason.trim()) {
      toast.error("Bitte wähle mindestens eine Kostenart und gib eine Begründung ein.");
      return;
    }
    const fullReason = `Kostenart(en): ${selectedCategories.join(", ")}. Begründung: ${reason.trim()}`;
    try {
      await createDispute.mutateAsync({
        reason: fullReason,
        amount: utility ? Math.abs(utility.balance) : undefined,
      });
      setSubmitted(true);
      toast.success("Widerspruch erfolgreich eingereicht");
    } catch {
      toast.error("Einreichung fehlgeschlagen. Bitte erneut versuchen.");
    }
  };

  const balance = utility?.balance ?? 0;

  if (submitted) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex flex-col items-center justify-center space-y-4 py-16">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-center">Widerspruch eingereicht</h2>
          <p className="text-muted-foreground text-center max-w-sm text-sm">
            Dein Widerspruch wurde erfolgreich an die Hausverwaltung übermittelt.
            Du zahlst den strittigen Betrag vorerst <strong>unter Vorbehalt</strong>.
          </p>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 max-w-sm">
            <p className="font-semibold">Dein Widerspruch umfasst:</p>
            <ul className="mt-2 space-y-1">
              {selectedCategories.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Nebenkostenabrechnung {utility?.year ?? ""}</h1>
        <p className="text-sm text-muted-foreground">
          Wenn du mit deiner Abrechnung nicht einverstanden bist, kannst du hier Widerspruch einlegen.
        </p>
      </div>

      <Card className={balance < 0 ? "border-red-200 dark:border-red-900" : "border-green-200 dark:border-green-900"}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {balance < 0 ? "Nachzahlung" : "Guthaben"}
              </p>
              <p className={`text-3xl font-bold ${balance < 0 ? "text-red-600" : "text-green-600"}`}>
                {formatEur(Math.abs(balance))}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${balance < 0 ? "bg-red-100" : "bg-green-100"}`}>
              <CreditCard className={`w-6 h-6 ${balance < 0 ? "text-red-600" : "text-green-600"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="dispute-form" className="border-amber-200 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            Widerspruch – Zahlung unter Vorbehalt
          </CardTitle>
          <CardDescription>
            Wähle die Kostenart(en), die du beanstandest, und begründe deinen Widerspruch. Die Hausverwaltung wird benachrichtigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="font-semibold">Betroffene Kostenart(en) auswählen:</Label>
              <div className="grid grid-cols-2 gap-2">
                {BETRKV_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`text-left text-xs p-2 rounded-lg border transition-colors ${
                      selectedCategories.includes(cat)
                        ? "bg-amber-100 border-amber-400 text-amber-900 font-medium dark:bg-amber-950 dark:text-amber-200"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedCategories.includes(cat) && "✓ "}{cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="font-semibold">Begründung</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="z.B. Die Gartenpflegekosten sind im Vergleich zum Vorjahr um 40% gestiegen. Bitte um Nachweis der Einzelpositionen."
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Tipp: Je konkreter deine Begründung, desto schneller kann die Verwaltung antworten.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={selectedCategories.length === 0 || !reason.trim() || createDispute.isPending}
            >
              {createDispute.isPending ? "Wird gesendet..." : "Widerspruch verbindlich einreichen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Navigate to the tenant portal's `/billing-dispute` route, select at least one category, enter a reason (≥10 characters), submit. Confirm the success screen appears, and that `GET /billing-disputes` (or the admin wizard's disputes tab from Task 10) shows the new dispute with `status: OPEN`.

- [ ] **Step 4: Typecheck**

Run: `cd tenant-portal && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add tenant-portal/src/hooks/api/useTenantDisputes.ts tenant-portal/src/pages/BillingDisputeForm.tsx
git commit -m "feat(tenant-portal): wire BillingDisputeForm to real /billing-disputes API and real balance"
```

---

## Final Verification

- [ ] Run the full backend suite: `cd backend && npm test && npx tsc --noEmit` — all green.
- [ ] Run both frontend typechecks: `cd cozy-estate-central && npx tsc --noEmit` and `cd tenant-portal && npx tsc --noEmit` — no errors.
- [ ] Manual end-to-end pass: as admin, tag a transaction with a BetrKV category + CO2 amount and generate a statement in the wizard; as a tenant, submit a meter reading, view utility transparency, and file a dispute; back as admin, confirm the dispute appears and can be resolved.
- [ ] Update `PROJEKTDOKUMENTATION.md` per `CLAUDE.md` convention: add an entry describing the new `/utility-billing` module, tenant-portal utility/meter/dispute endpoints, and the `calculateHeatingBaseCostPercentage`-not-yet-wired deviation.
