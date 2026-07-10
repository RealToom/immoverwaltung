# Nebenkostenabrechnung PDF-Finalisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap found during manual production testing of the Nebenkosten-Assistent: give the admin a way to actually finalize a utility statement into per-tenant, legally-structured PDF documents, deliver them via the tenant portal, and fix the tenant-portal's missing document-download capability that would otherwise make those PDFs unreachable.

**Architecture:** A new `finalizeStatement()` method on the existing `UtilityBillingService` orchestrates: (1) reusing the already-tested `generateStatement()` for the correct numbers, (2) idempotently persisting the owner-vacancy ledger entry, (3) generating one PDF per tenant via a new, narrowly-scoped PDF-rendering service, (4) storing each via the existing `document.service.ts` (which already handles ownership validation and encryption). A new tenant-portal download route (mirroring the existing admin one) closes the delivery gap.

**Tech Stack:** Express 5, Prisma 6, `pdfkit` (already a dependency), Vitest, React Query.

## Global Constraints

- Imports use `.js` extension (ESM).
- All service functions take `companyId` (or `tenantUser: { id, tenantId, companyId }`) as the tenant-isolation boundary — every Prisma query must filter by it.
- API response format: `{ data: ... }`.
- Error handling via `AppError`/`NotFoundError`/`BadRequestError` from `backend/src/lib/errors.ts`.
- No automatic email sending, no changes to the existing `finance.controller.ts` PDF export, no signature requirement on the new documents (`requiresSignature` stays at its default `false`), no automatic retention-period (`retentionUntil: null`).
- **Deviation from the approved spec, decided during planning:** the spec's text says `finalizeStatement()` "ruft die persistierende `generateOwnerVacancyInvoice()` auf". This plan instead persists the vacancy `Transaction` directly using `statement.vacancy.amount` (the value `generateStatement()` already computed and rounded) rather than calling `generateOwnerVacancyInvoice()` a second time. Calling it again would re-run `calculateVacancyDeduction()` against a *reconstructed* `totalAllocatable` (derived from already-rounded return fields), which is unnecessary duplicate work with no benefit — using the already-computed, already-displayed amount directly guarantees the persisted ledger entry always matches exactly what's shown in the statement/PDF, with no risk of drift between two independent computations of the same number. The intent of the spec (the vacancy deduction gets actually persisted on finalize) is preserved; only the internal mechanism differs. `generateOwnerVacancyInvoice()` itself is untouched and remains available for any future caller.

---

## Task 1: PDF rendering service for a single tenant's statement

**Files:**
- Modify: `backend/src/lib/pdf.ts` (add `createPdfFile`)
- Create: `backend/src/services/utility-statement-pdf.service.ts`
- Test: `backend/src/test/utility-statement-pdf.service.test.ts`

**Interfaces:**
- Produces: `createPdfFile(filePath: string): { doc: PDFKit.PDFDocument; done: Promise<void> }` and `generateTenantStatementPdf(input: TenantStatementPdfInput, outputPath: string): Promise<{ filePath: string; fileSizeBytes: number }>` — both used by Task 2 (`finalizeStatement`).
- `TenantStatementPdfInput` shape (exported from the new file):
  ```typescript
  export interface TenantStatementCategoryLine {
    category: string;
    amount: number;
  }
  export interface TenantStatementPdfInput {
    companyName: string;
    propertyName: string;
    tenantName: string;
    unitNumber: string;
    year: number;
    amount: number;
    balance: number;
    isRefund: boolean;
    categories: TenantStatementCategoryLine[];
    co2: { landlordPercentage: number; landlordShare: number; tenantShare: number; energyClass: string | null } | null;
  }
  ```

This task has no dependency on any other new code from this plan — it takes plain data in, writes a real PDF file, and returns its size. Fully testable in isolation with a real filesystem write to a temp path (no Prisma mocking needed).

- [ ] **Step 1: Add `createPdfFile` to `lib/pdf.ts`**

Current full content of `backend/src/lib/pdf.ts`:
```typescript
import PDFDocument from "pdfkit";
import type { Response } from "express";

export function createPdfResponse(res: Response, filename: string): PDFKit.PDFDocument {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  return doc;
}
```

Replace it with (adds `createPdfFile`, keeps `createPdfResponse` unchanged):
```typescript
import PDFDocument from "pdfkit";
import fs from "node:fs";
import type { Response } from "express";

export function createPdfResponse(res: Response, filename: string): PDFKit.PDFDocument {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  return doc;
}

/**
 * Like createPdfResponse, but pipes to a file on disk instead of an HTTP
 * response — for batch-generating documents that get stored (via
 * document.service.ts) rather than streamed to a single requester.
 */
export function createPdfFile(filePath: string): { doc: PDFKit.PDFDocument; done: Promise<void> } {
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  const done = new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return { doc, done };
}
```

- [ ] **Step 2: Write the failing test for `generateTenantStatementPdf`**

```typescript
// backend/src/test/utility-statement-pdf.service.test.ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateTenantStatementPdf } from "../services/utility-statement-pdf.service.js";

describe("generateTenantStatementPdf", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) {
      try { fs.unlinkSync(f); } catch { /* already gone */ }
    }
  });

  it("writes a real PDF file and returns its size", async () => {
    const outputPath = path.join(os.tmpdir(), `test-statement-${Date.now()}.pdf`);
    tmpFiles.push(outputPath);

    const result = await generateTenantStatementPdf(
      {
        companyName: "Mustermann Hausverwaltung GmbH",
        propertyName: "Residenz Am Park",
        tenantName: "Max Mustermann",
        unitNumber: "4A",
        year: 2025,
        amount: 1540,
        balance: -120.5,
        isRefund: false,
        categories: [
          { category: "GRUNDSTEUER", amount: 533.33 },
          { category: "HAUSWART", amount: 800 },
        ],
        co2: { landlordPercentage: 60, landlordShare: 480, tenantShare: 320, energyClass: "E" },
      },
      outputPath
    );

    expect(result.filePath).toBe(outputPath);
    expect(result.fileSizeBytes).toBeGreaterThan(1000);

    const buffer = fs.readFileSync(outputPath);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("handles a statement with no CO2 split and no categories without throwing", async () => {
    const outputPath = path.join(os.tmpdir(), `test-statement-empty-${Date.now()}.pdf`);
    tmpFiles.push(outputPath);

    const result = await generateTenantStatementPdf(
      {
        companyName: "Firma",
        propertyName: "Haus",
        tenantName: "Erika Musterfrau",
        unitNumber: "1B",
        year: 2025,
        amount: 0,
        balance: 0,
        isRefund: true,
        categories: [],
        co2: null,
      },
      outputPath
    );

    expect(result.fileSizeBytes).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/utility-statement-pdf.service.test.ts`
Expected: FAIL — module `../services/utility-statement-pdf.service.js` does not exist.

- [ ] **Step 4: Implement `generateTenantStatementPdf`**

```typescript
// backend/src/services/utility-statement-pdf.service.ts
import fs from "node:fs";
import { createPdfFile } from "../lib/pdf.js";

export interface TenantStatementCategoryLine {
  category: string;
  amount: number;
}

export interface TenantStatementPdfInput {
  companyName: string;
  propertyName: string;
  tenantName: string;
  unitNumber: string;
  year: number;
  amount: number;
  balance: number;
  isRefund: boolean;
  categories: TenantStatementCategoryLine[];
  co2: { landlordPercentage: number; landlordShare: number; tenantShare: number; energyClass: string | null } | null;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

/**
 * Renders one tenant's finalized utility statement as a PDF and writes it
 * to outputPath. Pure rendering — no Prisma access, no I/O beyond the file
 * write itself, so it's testable without mocking anything but the filesystem.
 */
export async function generateTenantStatementPdf(
  input: TenantStatementPdfInput,
  outputPath: string
): Promise<{ filePath: string; fileSizeBytes: number }> {
  const { doc, done } = createPdfFile(outputPath);

  doc.fontSize(18).font("Helvetica-Bold").text("Nebenkostenabrechnung", { align: "center" });
  doc.fontSize(11).font("Helvetica").text(`Abrechnungszeitraum: ${input.year}`, { align: "center" });
  doc.moveDown(1.5);

  doc.fontSize(11).text(`Vermieter: ${input.companyName}`);
  doc.text(`Mieter: ${input.tenantName}`);
  doc.text(`Einheit: ${input.unitNumber}, ${input.propertyName}`);
  doc.moveDown();

  doc.fontSize(13).font("Helvetica-Bold").text("Kostenaufstellung nach Kategorie");
  doc.font("Helvetica").fontSize(10).moveDown(0.5);
  if (input.categories.length === 0) {
    doc.text("Keine kategorisierten Kosten vorhanden.");
  } else {
    for (const c of input.categories) {
      doc.text(`${c.category}: ${formatEur(c.amount)}`);
    }
  }
  doc.moveDown();

  if (input.co2 && input.co2.landlordShare > 0) {
    doc.fontSize(13).font("Helvetica-Bold").text("CO2-Kostenaufteilung (CO2KostAufG)");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(`Energieklasse des Gebäudes: ${input.co2.energyClass ?? "unbekannt"}`);
    doc.text(
      `Vermieter-Anteil: ${input.co2.landlordPercentage}% (${formatEur(input.co2.landlordShare)}) — bereits von den umgelegten Kosten abgezogen.`
    );
    doc.moveDown();
  }

  doc.fontSize(13).font("Helvetica-Bold").text("Ergebnis");
  doc.font("Helvetica").fontSize(11).moveDown(0.5);
  doc.text(`Ihr Kostenanteil: ${formatEur(input.amount)}`);
  doc.text(
    input.isRefund
      ? `Guthaben: ${formatEur(Math.abs(input.balance))}`
      : `Nachzahlung: ${formatEur(Math.abs(input.balance))}`
  );
  doc.moveDown(2);

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#555555")
    .text(
      "Hinweis: Gemäß § 556 Abs. 3 BGB können Einwendungen gegen diese Abrechnung innerhalb von 12 Monaten nach " +
        'Zugang schriftlich erhoben werden. Ein Widerspruch kann bequem über das Mieter-Portal (Menüpunkt "Abrechnung ' +
        'prüfen") eingereicht werden.',
      { align: "left" }
    );

  doc.end();
  await done;

  const stats = fs.statSync(outputPath);
  return { filePath: outputPath, fileSizeBytes: stats.size };
}
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `cd backend && npx vitest run src/test/utility-statement-pdf.service.test.ts`
Expected: both tests PASS.

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/pdf.ts backend/src/services/utility-statement-pdf.service.ts backend/src/test/utility-statement-pdf.service.test.ts
git commit -m "feat(utility-billing): add per-tenant statement PDF renderer"
```

---

## Task 2: `UtilityBillingService.finalizeStatement()`

**Files:**
- Modify: `backend/src/services/utility-billing.service.ts` (add `tenantId` to `generateStatement()`'s items, add `finalizeStatement()`)
- Test: Create `backend/src/test/utility-billing.finalize.test.ts`

**Interfaces:**
- Consumes: `generateTenantStatementPdf` (Task 1), `document.service.ts`'s `createDocument`/`deleteDocument` (existing, unchanged).
- Produces: `UtilityBillingService.finalizeStatement(propertyId: number, year: number): Promise<{ propertyId: number; year: number; generatedCount: number; items: UtilityStatementItem[] }>` where `UtilityStatementItem` now includes `tenantId: number` — used by Task 3 (admin controller) and read by Task 5 (frontend, already has `items` in its local state from the existing generate call, but the type now also carries `tenantId`).

- [ ] **Step 1: Write the failing test**

Read `backend/src/services/utility-billing.service.ts` first (`generateStatement`'s current item-push block and full class structure) to confirm your edit target line-for-line before changing it — the file was last touched by an earlier plan and its exact current state is the base for this diff.

```typescript
// backend/src/test/utility-billing.finalize.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPropertyFindFirst, mockTransactionFindMany, mockEnergyPassportFindUnique,
  mockUnitFindMany, mockContractFindMany, mockContractFindUnique, mockRentPaymentFindMany,
  mockTransactionDeleteMany, mockTransactionCreate, mockDocumentFindFirst, mockCompanyFindUnique,
} = vi.hoisted(() => ({
  mockPropertyFindFirst: vi.fn(),
  mockTransactionFindMany: vi.fn(),
  mockEnergyPassportFindUnique: vi.fn(),
  mockUnitFindMany: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockRentPaymentFindMany: vi.fn(),
  mockTransactionDeleteMany: vi.fn(),
  mockTransactionCreate: vi.fn(),
  mockDocumentFindFirst: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    property: { findFirst: mockPropertyFindFirst },
    transaction: { findMany: mockTransactionFindMany, deleteMany: mockTransactionDeleteMany, create: mockTransactionCreate },
    energyPassport: { findUnique: mockEnergyPassportFindUnique },
    unit: { findMany: mockUnitFindMany },
    contract: { findMany: mockContractFindMany, findUnique: mockContractFindUnique },
    rentPayment: { findMany: mockRentPaymentFindMany },
    document: { findFirst: mockDocumentFindFirst },
    company: { findUnique: mockCompanyFindUnique },
  },
}));

const { mockCreateDocument, mockDeleteDocument } = vi.hoisted(() => ({
  mockCreateDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
}));
vi.mock("../services/document.service.js", () => ({
  createDocument: mockCreateDocument,
  deleteDocument: mockDeleteDocument,
}));

const { mockGenerateTenantStatementPdf } = vi.hoisted(() => ({
  mockGenerateTenantStatementPdf: vi.fn(),
}));
vi.mock("../services/utility-statement-pdf.service.js", () => ({
  generateTenantStatementPdf: mockGenerateTenantStatementPdf,
}));

import { UtilityBillingService } from "../services/utility-billing.service.js";

// Single contract, full year 2025, no vacancy, no CO2 — mirrors the
// no-vacancy fixture already used for generateStatement's own tests.
function mockNoVacancyFullYearScenario() {
  mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
  mockTransactionFindMany.mockResolvedValueOnce([
    { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
  ]);
  mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
  mockUnitFindMany.mockResolvedValueOnce([
    { id: 5, number: "EG links", area: 50, contracts: [{ startDate: new Date(2025, 0, 1), endDate: null }] },
  ]);
  mockContractFindMany.mockResolvedValueOnce([
    {
      id: 42, tenantId: 7, startDate: new Date(2025, 0, 1), endDate: null,
      unit: { id: 5, number: "EG links", area: 50 },
      tenant: { id: 7, name: "Mustermann" },
    },
  ]);
  mockContractFindUnique.mockResolvedValueOnce({ id: 42, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
  mockRentPaymentFindMany.mockResolvedValueOnce(
    Array.from({ length: 12 }, (_, i) => ({ id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH" }))
  );
  mockCompanyFindUnique.mockResolvedValueOnce({ name: "Testfirma GmbH" });
  // finalizeStatement's own property lookup (separate from generateStatement's internal one)
  mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1, name: "Residenz Am Park" });
}

describe("UtilityBillingService.finalizeStatement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes tenantId on generateStatement's items", async () => {
    // Self-contained: exercises generateStatement() directly (not finalizeStatement),
    // so it only needs the subset of mocks generateStatement itself calls — no property
    // lookup queueing dance needed for a second, finalize-only call.
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
    mockTransactionFindMany.mockResolvedValueOnce([
      { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
    ]);
    mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
    mockUnitFindMany.mockResolvedValueOnce([
      { id: 5, number: "EG links", area: 50, contracts: [{ startDate: new Date(2025, 0, 1), endDate: null }] },
    ]);
    mockContractFindMany.mockResolvedValueOnce([
      {
        id: 42, tenantId: 7, startDate: new Date(2025, 0, 1), endDate: null,
        unit: { id: 5, number: "EG links", area: 50 },
        tenant: { id: 7, name: "Mustermann" },
      },
    ]);
    mockContractFindUnique.mockResolvedValueOnce({ id: 42, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
    mockRentPaymentFindMany.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, i) => ({ id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH" }))
    );

    const svc = new UtilityBillingService(1);
    const statement = await svc.generateStatement(1, 2025);
    expect(statement.items[0].tenantId).toBe(7);
  });

  it("creates one document per item and clears any stale vacancy transaction, without persisting a new one when there is no vacancy", async () => {
    mockNoVacancyFullYearScenario();
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no pre-existing document for this tenant/year
    mockGenerateTenantStatementPdf.mockResolvedValueOnce({ filePath: "/fake/path.pdf", fileSizeBytes: 4096 });
    mockCreateDocument.mockResolvedValueOnce({ id: 99 });

    const svc = new UtilityBillingService(1);
    const result = await svc.finalizeStatement(1, 2025);

    expect(mockTransactionDeleteMany).toHaveBeenCalledWith({
      where: {
        propertyId: 1,
        companyId: 1,
        category: "Leerstands-Ausgleich",
        date: { gte: new Date(2025, 0, 1), lte: new Date(2025, 11, 31) },
      },
    });
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(mockDeleteDocument).not.toHaveBeenCalled();
    expect(mockCreateDocument).toHaveBeenCalledWith(1, {
      name: "Nebenkostenabrechnung_2025_1.pdf",
      fileType: "PDF",
      fileSize: "4.0 KB",
      filePath: "/fake/path.pdf",
      tenantId: 7,
      propertyId: 1,
    });
    expect(result).toEqual({
      propertyId: 1,
      year: 2025,
      generatedCount: 1,
      items: expect.any(Array),
    });
  });

  it("deletes an existing document for the same tenant/year before creating the replacement", async () => {
    mockNoVacancyFullYearScenario();
    mockDocumentFindFirst.mockResolvedValueOnce({ id: 55 });
    mockGenerateTenantStatementPdf.mockResolvedValueOnce({ filePath: "/fake/path2.pdf", fileSizeBytes: 2048 });
    mockCreateDocument.mockResolvedValueOnce({ id: 100 });

    const svc = new UtilityBillingService(1);
    await svc.finalizeStatement(1, 2025);

    expect(mockDeleteDocument).toHaveBeenCalledWith(1, 55);
    expect(mockCreateDocument).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/utility-billing.finalize.test.ts`
Expected: FAIL — `generateStatement`'s items have no `tenantId` field yet, and `svc.finalizeStatement is not a function`.

- [ ] **Step 3: Add `tenantId` to `generateStatement()`'s items**

In `backend/src/services/utility-billing.service.ts`, find the `items.push({...})` block inside `generateStatement` (currently `contractId, unitId, unitNumber, tenantName, area, amount, balance, isRefund`) and add `tenantId: contract.tenantId,` right after `unitId`:

```typescript
      items.push({
        contractId: contract.id,
        unitId: contract.unit.id,
        tenantId: contract.tenantId,
        unitNumber: contract.unit.number,
        tenantName: contract.tenant.name,
        area: contract.unit.area,
        amount: Math.round(share * 100) / 100,
        balance: Math.round(balance.balance * 100) / 100,
        isRefund: balance.isRefund,
      });
```

(`contract.tenantId` is a plain scalar column on `Contract`, already returned by the existing Prisma query — no query change needed.)

- [ ] **Step 4: Add the new imports and `finalizeStatement` method**

At the top of `backend/src/services/utility-billing.service.ts`, add these imports (alongside the existing ones):
```typescript
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env.js";
import * as documentService from "./document.service.js";
import { generateTenantStatementPdf } from "./utility-statement-pdf.service.js";
```

Add this method to the `UtilityBillingService` class, after `generateStatement`:

```typescript
  /**
   * Turns a statement into durable artifacts: persists the owner-vacancy
   * ledger entry (idempotently — replaces any prior entry for this
   * property/year rather than duplicating it) and generates one PDF per
   * tenant, stored via document.service.ts. Re-running for the same
   * property/year replaces the previous documents instead of duplicating them.
   */
  public async finalizeStatement(propertyId: number, year: number) {
    const statement = await this.generateStatement(propertyId, year);

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // Idempotent: always clear any prior run's vacancy entry first.
    await prisma.transaction.deleteMany({
      where: {
        propertyId,
        companyId: this.companyId,
        category: "Leerstands-Ausgleich",
        date: { gte: startOfYear, lte: endOfYear },
      },
    });

    if (statement.vacancy) {
      await prisma.transaction.create({
        data: {
          date: endOfYear,
          description: `Eigentümer-Abrechnung Leerstand ${year}`,
          type: "EINNAHME",
          amount: statement.vacancy.amount,
          category: "Leerstands-Ausgleich",
          allocatable: false,
          propertyId,
          companyId: this.companyId,
        },
      });
    }

    const company = await prisma.company.findUnique({ where: { id: this.companyId }, select: { name: true } });
    const property = await prisma.property.findFirst({ where: { id: propertyId, companyId: this.companyId } });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");

    const docName = `Nebenkostenabrechnung_${year}_${propertyId}.pdf`;
    let generatedCount = 0;

    for (const item of statement.items) {
      const existing = await prisma.document.findFirst({
        where: { tenantId: item.tenantId, companyId: this.companyId, name: docName },
      });
      if (existing) {
        await documentService.deleteDocument(this.companyId, existing.id);
      }

      const dir = path.join(env.UPLOAD_DIR, String(this.companyId), "tenants", String(item.tenantId));
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${crypto.randomUUID()}.pdf`);

      const shareRatio = statement.totalCosts > 0 ? item.amount / statement.totalCosts : 0;
      const categories = statement.transactions
        .filter((tx) => tx.betrkvCategory)
        .map((tx) => ({
          category: tx.betrkvCategory as string,
          amount: Math.round(Math.abs(tx.amount) * shareRatio * 100) / 100,
        }));

      const { fileSizeBytes } = await generateTenantStatementPdf(
        {
          companyName: company?.name ?? "",
          propertyName: property.name,
          tenantName: item.tenantName,
          unitNumber: item.unitNumber,
          year,
          amount: item.amount,
          balance: item.balance,
          isRefund: item.isRefund,
          categories,
          co2: statement.co2.landlordShare > 0 ? statement.co2 : null,
        },
        filePath
      );

      await documentService.createDocument(this.companyId, {
        name: docName,
        fileType: "PDF",
        fileSize: `${(fileSizeBytes / 1024).toFixed(1)} KB`,
        filePath,
        tenantId: item.tenantId,
        propertyId,
      });
      generatedCount++;
    }

    return { propertyId, year, generatedCount, items: statement.items };
  }
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `cd backend && npx vitest run src/test/utility-billing.finalize.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 6: Run the full existing utility-billing test file too**

Run: `cd backend && npx vitest run src/test/utility-billing.service.test.ts`
Expected: all still PASS (the `tenantId` addition is additive, doesn't change any existing assertion — the existing tests don't check for its absence).

- [ ] **Step 7: Run the full suite + typecheck**

Run: `cd backend && npx vitest run --pool=forks --no-file-parallelism --testTimeout=120000 && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/utility-billing.service.ts backend/src/test/utility-billing.finalize.test.ts
git commit -m "feat(utility-billing): add finalizeStatement (idempotent vacancy persist + per-tenant PDF generation)"
```

---

## Task 3: Admin route `POST /utility-billing/statements/finalize`

**Files:**
- Modify: `backend/src/controllers/utility-billing.controller.ts` (add `finalizeStatement`)
- Modify: `backend/src/routes/utility-billing.routes.ts` (add the route)
- Test: Modify `backend/src/test/utility-billing.controller.test.ts` (add a test case)

**Interfaces:**
- Consumes: `UtilityBillingService.finalizeStatement` (Task 2).
- Produces: `POST /api/utility-billing/statements/finalize` — used by Task 5 (admin frontend hook).

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe("utility-billing.controller", ...)` block in `backend/src/test/utility-billing.controller.test.ts` (the file's mock for `UtilityBillingService` already returns `{ generateStatement: mockGenerateStatement }` from its constructor mock — extend that returned object to also include a `finalizeStatement` mock):

Replace the existing mock block:
```typescript
const { mockGenerateStatement } = vi.hoisted(() => ({ mockGenerateStatement: vi.fn() }));
vi.mock("../services/utility-billing.service.js", () => ({
  // Regular function (not arrow) so it can be invoked with `new` — the
  // controller calls `new UtilityBillingService(...)`, and arrow functions
  // cannot be used as constructors.
  UtilityBillingService: vi.fn().mockImplementation(function () {
    return { generateStatement: mockGenerateStatement };
  }),
}));
```
with:
```typescript
const { mockGenerateStatement, mockFinalizeStatement } = vi.hoisted(() => ({
  mockGenerateStatement: vi.fn(),
  mockFinalizeStatement: vi.fn(),
}));
vi.mock("../services/utility-billing.service.js", () => ({
  // Regular function (not arrow) so it can be invoked with `new` — the
  // controller calls `new UtilityBillingService(...)`, and arrow functions
  // cannot be used as constructors.
  UtilityBillingService: vi.fn().mockImplementation(function () {
    return { generateStatement: mockGenerateStatement, finalizeStatement: mockFinalizeStatement };
  }),
}));
```

Then add this test case inside the `describe` block, after the existing `"generateStatement scopes..."` test:
```typescript
  it("finalizeStatement scopes the service to req.companyId and returns its result", async () => {
    mockFinalizeStatement.mockResolvedValueOnce({ propertyId: 3, year: 2026, generatedCount: 2, items: [] });
    const req = { companyId: 1, body: { propertyId: 3, year: 2026 } } as unknown as Request;
    const res = makeRes();

    await ctrl.finalizeStatement(req, res);

    expect(mockFinalizeStatement).toHaveBeenCalledWith(3, 2026);
    expect(res.json).toHaveBeenCalledWith({ data: { propertyId: 3, year: 2026, generatedCount: 2, items: [] } });
  });
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/utility-billing.controller.test.ts`
Expected: FAIL — `ctrl.finalizeStatement` is not a function.

- [ ] **Step 3: Add the controller function**

In `backend/src/controllers/utility-billing.controller.ts`, add (after `generateStatement`):
```typescript
export async function finalizeStatement(req: Request, res: Response): Promise<void> {
  const { propertyId, year } = req.body as { propertyId: number; year: number };
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.finalizeStatement(propertyId, year);
  res.json({ data });
}
```

- [ ] **Step 4: Add the route**

In `backend/src/routes/utility-billing.routes.ts`, add (after the `/statements/generate` route, reusing the existing `generateStatementSchema` since the body shape is identical — `{ propertyId, year }`):
```typescript
router.post(
  "/statements/finalize",
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ body: generateStatementSchema }),
  ctrl.finalizeStatement
);
```

- [ ] **Step 5: Run the tests + typecheck**

Run: `cd backend && npx vitest run src/test/utility-billing.controller.test.ts && npx tsc --noEmit`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/utility-billing.controller.ts backend/src/routes/utility-billing.routes.ts backend/src/test/utility-billing.controller.test.ts
git commit -m "feat(utility-billing): add POST /statements/finalize route"
```

---

## Task 4: Tenant-portal document download

**Files:**
- Modify: `backend/src/services/tenantPortal.service.ts` (add `downloadDocument`)
- Modify: `backend/src/controllers/tenantPortal.controller.ts` (add `downloadDocument`)
- Modify: `backend/src/routes/tenantPortal.routes.ts` (add the route)
- Test: Create `backend/src/test/tenantPortal.documents.test.ts`

**Interfaces:**
- Produces: `GET /api/tenant/:slug/documents/:id/download` — used by Task 6 (tenant-portal frontend).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/test/tenantPortal.documents.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDocumentFindFirst } = vi.hoisted(() => ({ mockDocumentFindFirst: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({
  prisma: { document: { findFirst: mockDocumentFindFirst } },
}));

import { downloadDocument } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service downloadDocument", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the document when it belongs to the authenticated tenant", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce({ id: 5, tenantId: 10, companyId: 1, filePath: "/some/path.pdf" });

    const doc = await downloadDocument(tenantUser, 5);

    expect(mockDocumentFindFirst).toHaveBeenCalledWith({
      where: { id: 5, tenantId: 10, companyId: 1 },
    });
    expect(doc.id).toBe(5);
  });

  it("throws NotFoundError when the document belongs to another tenant", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null); // filtered out by the tenantId/companyId where-clause

    await expect(downloadDocument(tenantUser, 999)).rejects.toThrow("nicht gefunden");
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx vitest run src/test/tenantPortal.documents.test.ts`
Expected: FAIL — `downloadDocument` is not exported from `tenantPortal.service.js`.

- [ ] **Step 3: Add the service function**

In `backend/src/services/tenantPortal.service.ts`, add (in the `// ─── Documents ───` section, after `signDocument`):
```typescript
export async function downloadDocument(tenantUser: TenantUser, documentId: number) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, tenantId: tenantUser.tenantId, companyId: tenantUser.companyId },
  });
  if (!doc) throw new NotFoundError("Dokument", documentId);
  return doc;
}
```

- [ ] **Step 4: Add the controller function**

In `backend/src/controllers/tenantPortal.controller.ts`, add these imports at the top (alongside the existing ones):
```typescript
import path from "node:path";
import { decryptFile, getOriginalExt } from "../lib/crypto.js";
```

Add this near the top of the file, after the imports (module-level helpers, mirroring `document.controller.ts`'s equivalents):
```typescript
const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function sanitizeName(raw: string): string {
  return raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 255);
}
```

Add the controller function in the `// ─── Documents ───` section, after `signDocument`:
```typescript
export async function downloadDocument(req: Request, res: Response): Promise<void> {
  const doc = await svc.downloadDocument(req.tenantUser!, Number(req.params.id));

  if (!doc.filePath) {
    res.status(400).json({ error: "Keine Datei vorhanden" });
    return;
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (doc.isEncrypted) {
    const decrypted = decryptFile(doc.filePath);
    const ext = getOriginalExt(doc.filePath);
    const mime = MIME_MAP[ext] || "application/octet-stream";
    const safeName = sanitizeName(doc.name);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", decrypted.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.send(decrypted);
    return;
  }

  res.download(doc.filePath, sanitizeName(doc.name));
}
```

Note: `path` is imported for parity with `document.controller.ts`'s pattern but isn't directly referenced in this function body (the extension logic lives in `getOriginalExt`) — if `tsc`/lint flags it as an unused import in Step 6, remove that one line; keep `decryptFile`/`getOriginalExt`.

- [ ] **Step 5: Add the route**

In `backend/src/routes/tenantPortal.routes.ts`, add (in the `// ─── Documents ───` section, after the `/documents/:id/sign` route):
```typescript
router.get(
  "/documents/:id/download",
  validate({ params: tenantPortalIdParamSchema }),
  ctrl.downloadDocument
);
```

- [ ] **Step 6: Run the tests + typecheck**

Run: `cd backend && npx vitest run src/test/tenantPortal.documents.test.ts && npx tsc --noEmit`
Expected: PASS, clean. If `tsc` flags the `path` import as unused per the Step 4 note, remove it.

- [ ] **Step 7: Run the full suite**

Run: `cd backend && npx vitest run --pool=forks --no-file-parallelism --testTimeout=120000`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/tenantPortal.service.ts backend/src/controllers/tenantPortal.controller.ts backend/src/routes/tenantPortal.routes.ts backend/src/test/tenantPortal.documents.test.ts
git commit -m "feat(tenant-portal): add document download route (closes a pre-existing gap — portal listed documents but had no way to retrieve them)"
```

---

## Task 5: Admin frontend — Wizard Step 3 rewrite

**Files:**
- Modify: `cozy-estate-central/src/hooks/api/useUtilityBilling.ts` (add `useFinalizeStatement`, extend `UtilityStatementItem`)
- Modify: `cozy-estate-central/src/pages/UtilityBillingWizard.tsx` (replace the "Generierung" tab content)

**Interfaces:**
- Consumes: `POST /utility-billing/statements/finalize` (Task 3).
- Produces: `useFinalizeStatement()` hook — used only within this task's own page.

This is a UI task; no automated test. Verify manually per Step 3 below.

- [ ] **Step 1: Extend the hook file**

In `cozy-estate-central/src/hooks/api/useUtilityBilling.ts`, update the `UtilityStatementItem` interface to add `tenantId`:
```typescript
export interface UtilityStatementItem {
  contractId: number;
  unitId: number;
  tenantId: number;
  unitNumber: string;
  tenantName: string;
  area: number;
  amount: number;
  balance: number;
  isRefund: boolean;
}
```

Add this new hook at the end of the file:
```typescript
export interface FinalizeStatementResult {
  propertyId: number;
  year: number;
  generatedCount: number;
  items: UtilityStatementItem[];
}

export function useFinalizeStatement() {
  return useMutation({
    mutationFn: (data: { propertyId: number; year: number }) =>
      api<{ data: FinalizeStatementResult }>("/utility-billing/statements/finalize", {
        method: "POST",
        body: data,
      }),
  });
}
```

- [ ] **Step 2: Replace the "Generierung" tab content**

In `cozy-estate-central/src/pages/UtilityBillingWizard.tsx`:

Add to the imports:
```tsx
import { useGenerateUtilityStatement, useUtilityDisputes, useUpdateDisputeStatus, useFinalizeStatement } from "@/hooks/api/useUtilityBilling";
```
(replacing the existing shorter import of the same line).

Add a new piece of local state and the hook, alongside the existing ones inside `UtilityBillingWizard`:
```tsx
  const finalizeStatement = useFinalizeStatement();
  const [finalizedCount, setFinalizedCount] = useState<number | null>(null);
```

Add a handler function near `handleGenerate`/`handleTagUpdate`:
```tsx
  const handleFinalize = () => {
    if (!propertyId) return;
    finalizeStatement.mutate(
      { propertyId, year },
      {
        onSuccess: (res) => {
          setFinalizedCount(res.data.generatedCount);
          toast({ title: "Abrechnungen erstellt", description: `${res.data.generatedCount} Abrechnungen im Mieter-Portal hinterlegt.` });
        },
        onError: (err: unknown) =>
          toast({ title: "Erstellung fehlgeschlagen", description: String(err), variant: "destructive" }),
      }
    );
  };
```

Replace the entire `{/* ─── Tab 3: Generierung ─── */}` `<TabsContent value="generation">` block:
```tsx
        {/* ─── Tab 3: Generierung ─── */}
        <TabsContent value="generation">
          <Card>
            <CardHeader>
              <CardTitle>Massen-Generierung</CardTitle>
              <CardDescription>
                Übersicht der berechneten Beträge pro Mieter. Mit "Abrechnungen erstellen" werden die PDF-Abrechnungen
                erzeugt und im Mieter-Portal hinterlegt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!statement || statement.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bitte zuerst in Schritt 1 die Kosten berechnen.</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="text-left p-3 font-medium">Mieter</th>
                        <th className="text-left p-3 font-medium">Einheit</th>
                        <th className="text-right p-3 font-medium">Betrag</th>
                        <th className="text-right p-3 font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.items.map((item) => (
                        <tr key={item.contractId} className="border-t">
                          <td className="p-3">{item.tenantName}</td>
                          <td className="p-3">{item.unitNumber}</td>
                          <td className="p-3 text-right font-medium">{formatEur(item.amount)}</td>
                          <td className={`p-3 text-right font-medium ${item.isRefund ? "text-green-600" : "text-red-600"}`}>
                            {item.isRefund ? "+" : "−"}{formatEur(Math.abs(item.balance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {finalizedCount != null && (
                <div className="border border-green-200 dark:border-green-900 rounded-md p-4 bg-green-50 dark:bg-green-950/30 text-sm text-green-800 dark:text-green-300">
                  {finalizedCount} Abrechnungen erstellt und im Mieter-Portal hinterlegt.
                </div>
              )}

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("validation")}>
                  Zurück
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={!statement || statement.items.length === 0 || finalizeStatement.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {finalizeStatement.isPending ? "Erstelle..." : "Abrechnungen erstellen & im Mieter-Portal bereitstellen"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
```

Note: `FileText` was only used by the old placeholder card and is no longer referenced — if `tsc`/lint flags it as an unused import in Step 3, remove it from the top-of-file import line; `Send` is already imported and reused here.

- [ ] **Step 3: Manually verify in the browser**

Run `cd cozy-estate-central && npm run dev`, log in, navigate to `/utility-billing`. Select a property with allocatable transactions and generate a statement (seed a couple of test transactions first if none exist, the way earlier manual verification did). Go to Tab 3, confirm the per-tenant table renders with correct amounts (matching Tab 1/2's numbers), click "Abrechnungen erstellen...", confirm the success message shows the right count, and confirm re-clicking it a second time still succeeds (idempotent replace, not an error).

- [ ] **Step 4: Typecheck**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useUtilityBilling.ts cozy-estate-central/src/pages/UtilityBillingWizard.tsx
git commit -m "feat(admin): replace UtilityBillingWizard's dead-end Generierung tab with per-tenant table + finalize action"
```

---

## Task 6: Tenant-portal frontend — document download

**Files:**
- Modify: `tenant-portal/src/hooks/api/useTenantDocuments.ts` (add `downloadTenantDocument`)
- Modify: `tenant-portal/src/pages/Documents.tsx` (add the download button)

**Interfaces:**
- Consumes: `GET /documents/:id/download` (Task 4), `getToken` from `tenant-portal/src/lib/api.ts` (existing export).

This is a UI task; no automated test. Verify manually per Step 3 below.

- [ ] **Step 1: Add the download helper**

In `tenant-portal/src/hooks/api/useTenantDocuments.ts`, add this import and function:
```typescript
import { getToken } from "@/lib/api";
```
```typescript
/**
 * Triggers a browser download of a tenant document. Not a React Query hook —
 * this is an imperative, on-click action, so it's a plain async function.
 */
export async function downloadTenantDocument(slug: string, documentId: number, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/tenant/${slug}/documents/${documentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Download fehlgeschlagen");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Wire the download button**

In `tenant-portal/src/pages/Documents.tsx`:

Add to the imports:
```tsx
import { useTenantDocuments, useTenantUploads, downloadTenantDocument } from "@/hooks/api/useTenantDocuments";
import { FileText, Upload, CheckCircle, PenLine, Download } from "lucide-react";
```
(replacing the existing two shorter import lines with these).

Add a click handler inside the `Documents` component function, before the `return`:
```tsx
  const handleDownload = async (docId: number, name: string) => {
    try {
      await downloadTenantDocument(slug!, docId, name);
    } catch {
      // Silent failure is acceptable here — no toast library is wired into this
      // page today; a failed fetch leaves the user exactly where they were.
    }
  };
```

In the landlord-documents `.map((doc) => ...)` block, the current markup is:
```tsx
                  {doc.requiresSignature && (
                    doc.signedAt ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <button
                        onClick={() => navigate(`/${slug}/documents/${doc.id}/sign`)}
                        className="flex items-center gap-1 text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Signieren
                      </button>
                    )
                  )}
```
Add a download button right after this block (so both the signature-status indicator/button AND the download button show together, since a document can need both):
```tsx
                  {doc.requiresSignature && (
                    doc.signedAt ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <button
                        onClick={() => navigate(`/${slug}/documents/${doc.id}/sign`)}
                        className="flex items-center gap-1 text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Signieren
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handleDownload(doc.id, doc.name)}
                    className="flex items-center gap-1 text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded-lg flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Herunterladen
                  </button>
```

- [ ] **Step 3: Manually verify in the browser**

Run `cd tenant-portal && npm run dev`, log in as a tenant who has at least one document (e.g. run Task 5's finalize action first from the admin side, or use any pre-existing landlord document), navigate to the Documents page, click "Herunterladen", confirm a real file downloads with the correct name and opens correctly (a valid PDF, matching content from the finalize step if testing the new Nebenkosten document).

- [ ] **Step 4: Typecheck**

Run: `cd tenant-portal && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add tenant-portal/src/hooks/api/useTenantDocuments.ts tenant-portal/src/pages/Documents.tsx
git commit -m "feat(tenant-portal): add working document download (previously listed documents with no way to retrieve them)"
```

---

## Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite + typecheck**

Run: `cd backend && npx vitest run --pool=forks --no-file-parallelism --testTimeout=120000 && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Both frontend typechecks**

Run: `cd cozy-estate-central && npx tsc --noEmit` and `cd tenant-portal && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual end-to-end pass**

Using the same manual-testing approach as the earlier production verification (insert a few real allocatable transactions for a test property via the DB, matching realistic BetrKV categories and at least one CO2-tax-bearing transaction, plus a genuine vacancy scenario if convenient): as admin, generate a statement, review Tab 3's table, click "Abrechnungen erstellen", confirm the per-tenant PDFs appear as Documents tied to the correct tenants (verify via a direct DB check: `SELECT * FROM documents WHERE name LIKE 'Nebenkostenabrechnung_%'`). As the corresponding tenant, log into the tenant portal, navigate to Documents, download the PDF, open it, and confirm its content (amounts, categories, CO2 note if applicable, balance, and the § 556 BGB notice) matches what the admin wizard showed. Back as admin, click "Abrechnungen erstellen" a second time for the same property/year and confirm exactly one document per tenant still exists afterward (not two) and the owner-vacancy transaction (if any) wasn't duplicated (`SELECT COUNT(*) FROM transactions WHERE category = 'Leerstands-Ausgleich' AND property_id = ... AND date BETWEEN ... AND ...` should be 0 or 1, never 2+). Clean up any test transactions/documents inserted purely for this verification afterward, the same way the earlier production test cleaned up.

- [ ] **Step 4: Final review**

If working with a human reviewer or the subagent-driven-development workflow, request a final review of the branch diff for this plan's tasks before merging/deploying.
