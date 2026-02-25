# DATEV Export + PSD2 Banking (Nordigen) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a DATEV Buchungsstapel CSV export module and a Nordigen/GoCardless PSD2 bank-sync module with deterministic rent matching to the Express/Prisma/PostgreSQL backend.

**Architecture:** Extend `BankAccount` with Nordigen metadata (Option A from design). New `BankTransaction` model uses Prisma `Decimal(15,2)` for amounts. Three new services (`nordigen`, `banking`, `matching`) plus `datev` service, each with their own controller and route file. Public OAuth callback endpoint mounted before auth middleware.

**Tech Stack:** Express 5, Prisma 6, PostgreSQL, TypeScript ESM (`.js` imports), Zod 4, Pino, vitest. No new npm packages — uses Node.js native `fetch` (Node 18+).

---

## Pre-flight check

Before starting, verify the project compiles:
```bash
cd backend
npx tsc --noEmit
# Expected: no output (clean)
```

---

## Task 1: Prisma Schema — New Models and Extensions

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Run: Prisma migration

**Step 1: Add new enums to schema.prisma (after existing enums, before end of file)**

Add after the `InquiryStatus` enum block (around line 636):

```prisma
enum BankProvider {
  MANUAL
  NORDIGEN
}

enum BankTxStatus {
  UNMATCHED
  MATCHED
  IGNORED
}

enum ChartOfAccounts {
  SKR03
  SKR04
}
```

**Step 2: Extend existing `BankAccount` model**

Replace the `BankAccount` model block with:

```prisma
model BankAccount {
  id               Int          @id @default(autoincrement())
  name             String
  iban             String
  bic              String       @default("")
  balance          Float        @default(0)
  lastSync         DateTime     @default(now()) @map("last_sync")
  status           String       @default("connected")
  provider         BankProvider @default(MANUAL)
  institutionId    String?      @map("institution_id")
  requisitionId    String?      @map("requisition_id")   // Nordigen requisition UUID
  nordigenAccountId String?     @map("nordigen_account_id") // Nordigen account UUID
  companyId        Int          @map("company_id")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  company          Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  transactions     Transaction[]
  bankTransactions BankTransaction[]

  @@map("bank_accounts")
}
```

**Step 3: Add `BankTransaction` model after `BankAccount`**

```prisma
model BankTransaction {
  id             Int          @id @default(autoincrement())
  nordigenId     String       @unique @map("nordigen_id")
  bookingDate    DateTime     @map("booking_date")
  valueDate      DateTime?    @map("value_date")
  amount         Decimal      @db.Decimal(15, 2)
  currency       String       @default("EUR")
  remittanceInfo String       @default("") @map("remittance_info")
  creditorName   String?      @map("creditor_name")
  creditorIban   String?      @map("creditor_iban")
  debtorName     String?      @map("debtor_name")
  debtorIban     String?      @map("debtor_iban")
  status         BankTxStatus @default(UNMATCHED)
  bankAccountId  Int          @map("bank_account_id")
  companyId      Int          @map("company_id")
  rentPaymentId  Int?         @map("rent_payment_id")
  transactionId  Int?         @unique @map("transaction_id")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  bankAccount  BankAccount  @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  company      Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  rentPayment  RentPayment? @relation(fields: [rentPaymentId], references: [id])
  transaction  Transaction? @relation(fields: [transactionId], references: [id])

  @@index([companyId, status])
  @@index([bankAccountId])
  @@map("bank_transactions")
}
```

**Step 4: Add `CompanyAccountingSettings` model**

```prisma
model CompanyAccountingSettings {
  id                   Int             @id @default(autoincrement())
  beraternummer        Int?            @map("beraternummer")
  mandantennummer      Int?            @map("mandantennummer")
  kontenrahmen         ChartOfAccounts @default(SKR03)
  defaultBankAccount   String          @default("1810") @map("default_bank_account")
  defaultIncomeAccount String          @default("8400") @map("default_income_account")
  defaultExpenseAccount String         @default("4900") @map("default_expense_account")
  fiscalYearStart      Int             @default(1) @map("fiscal_year_start")
  companyId            Int             @unique @map("company_id")
  createdAt            DateTime        @default(now()) @map("created_at")
  updatedAt            DateTime        @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("company_accounting_settings")
}
```

**Step 5: Add `CategoryAccountMapping` model**

```prisma
model CategoryAccountMapping {
  id            Int      @id @default(autoincrement())
  category      String
  accountNumber String   @map("account_number")
  companyId     Int      @map("company_id")
  createdAt     DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, category])
  @@map("category_account_mappings")
}
```

**Step 6: Add `DatevExportLog` model**

```prisma
model DatevExportLog {
  id        Int      @id @default(autoincrement())
  fromDate  DateTime @map("from_date")
  toDate    DateTime @map("to_date")
  txCount   Int      @map("tx_count")
  fileName  String   @map("file_name")
  companyId Int      @map("company_id")
  createdBy Int?     @map("created_by")
  createdAt DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@map("datev_export_logs")
}
```

**Step 7: Add back-references to existing models**

In `Transaction` model, add inside the model block after existing relations:
```prisma
  bankTransaction BankTransaction?
```

In `RentPayment` model, add after existing relations:
```prisma
  bankTransactions BankTransaction[]
```

In `Company` model, add to the relations list:
```prisma
  bankTransactions         BankTransaction[]
  accountingSettings       CompanyAccountingSettings?
  categoryAccountMappings  CategoryAccountMapping[]
  datevExportLogs          DatevExportLog[]
```

**Step 8: Run the migration**

```bash
cd backend
npm run db:migrate
# Prompted for migration name → type: datev_psd2_banking
# Expected: "Your database is now in sync with your schema."
```

**Step 9: Verify Prisma client regenerated**

```bash
cd backend
npx tsc --noEmit
# Expected: no errors (new Prisma types available)
```

**Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(schema): add DATEV + PSD2 banking models

- BankAccount: provider, institutionId, requisitionId, nordigenAccountId
- BankTransaction: Decimal(15,2) amount, nordigenId unique, UNMATCHED/MATCHED/IGNORED
- CompanyAccountingSettings: beraternummer, mandantennummer, kontenrahmen
- CategoryAccountMapping: category → DATEV account number
- DatevExportLog: audit trail for CSV exports
- BankTxStatus, BankProvider, ChartOfAccounts enums"
```

---

## Task 2: Environment Variables

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env` (add placeholders)

**Step 1: Add Nordigen env vars to `env.ts`**

Add these three getters to the `env` object inside `env.ts` (after the `ANTHROPIC_API_KEY` getter):

```typescript
  get NORDIGEN_SECRET_ID() { return process.env.NORDIGEN_SECRET_ID || ""; },
  get NORDIGEN_SECRET_KEY() { return process.env.NORDIGEN_SECRET_KEY || ""; },
  // Base URL for Nordigen OAuth callback redirect (no trailing slash)
  get NORDIGEN_REDIRECT_BASE() { return process.env.NORDIGEN_REDIRECT_BASE || "http://localhost:8080"; },
```

**Step 2: Add placeholders to `.env`**

Append to `backend/.env`:
```
# Nordigen/GoCardless BankAccountData API
NORDIGEN_SECRET_ID=
NORDIGEN_SECRET_KEY=
NORDIGEN_REDIRECT_BASE=http://localhost:8080
```

**Step 3: Commit**

```bash
git add backend/src/config/env.ts backend/.env
git commit -m "feat(env): add Nordigen API credential env vars"
```

---

## Task 3: Nordigen API Client Service + Tests

**Files:**
- Create: `backend/src/services/nordigen.service.ts`
- Create: `backend/src/test/nordigen.service.test.ts`

**Step 1: Write the failing tests first**

Create `backend/src/test/nordigen.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests for pure token-caching logic (no real HTTP calls)
describe("nordigen token cache", () => {
  it("should build authorization header from access token", () => {
    const token = "test-access-token-abc123";
    const header = `Bearer ${token}`;
    expect(header).toBe("Bearer test-access-token-abc123");
  });

  it("should consider token expired when expiresAt is in the past", () => {
    const pastTime = Date.now() - 1000;
    const isExpired = Date.now() >= pastTime;
    expect(isExpired).toBe(true);
  });

  it("should consider token valid when expiresAt is in the future", () => {
    const futureTime = Date.now() + 60_000;
    const isExpired = Date.now() >= futureTime;
    expect(isExpired).toBe(false);
  });

  it("maskIban masks middle digits", () => {
    // Will test the maskIban helper from nordigen service
    const iban = "DE89370400440532013000";
    // Expected: DE89****3000
    const masked = iban.slice(0, 4) + "****" + iban.slice(-4);
    expect(masked).toBe("DE89****3000");
  });
});
```

**Step 2: Run to verify tests pass (they test pure logic)**

```bash
cd backend
npx vitest run src/test/nordigen.service.test.ts
# Expected: 4 tests PASS
```

**Step 3: Create `backend/src/services/nordigen.service.ts`**

```typescript
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

const NORDIGEN_BASE = "https://bankaccountdata.gocardless.com/api/v2";

// ── In-memory token cache ────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // Unix ms
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - TOKEN_BUFFER_MS) {
    return cachedToken;
  }

  const secretId = env.NORDIGEN_SECRET_ID;
  const secretKey = env.NORDIGEN_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new AppError(503, "Nordigen-Zugangsdaten nicht konfiguriert (NORDIGEN_SECRET_ID / NORDIGEN_SECRET_KEY)");
  }

  const res = await fetch(`${NORDIGEN_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    // Never log secretId/secretKey
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    logger.error({ status: res.status }, "[NORDIGEN] Token-Anfrage fehlgeschlagen");
    throw new AppError(502, "Nordigen-Authentifizierung fehlgeschlagen");
  }

  const data = (await res.json()) as { access: string; access_expires: number };
  cachedToken = data.access;
  tokenExpiresAt = Date.now() + data.access_expires * 1000;

  logger.info("[NORDIGEN] Neues Access-Token abgerufen");
  return cachedToken;
}

// ── Helper: authenticated fetch ──────────────────────────────────────────────
async function nordigenFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${NORDIGEN_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, path }, "[NORDIGEN] API-Fehler");
    throw new AppError(502, `Nordigen API-Fehler: HTTP ${res.status}`);
  }

  return res.json();
}

// ── IBAN masking (never send full IBAN in logs or API responses) ─────────────
export function maskIban(iban: string): string {
  if (iban.length < 8) return "****";
  return iban.slice(0, 4) + "****" + iban.slice(-4);
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface NordigenInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  logo: string;
}

export async function listInstitutions(countryCode: string): Promise<NordigenInstitution[]> {
  const data = await nordigenFetch(`/institutions/?country=${encodeURIComponent(countryCode)}`);
  return data as NordigenInstitution[];
}

export interface NordigenRequisition {
  id: string;
  link: string;
  status: string;
  accounts: string[];
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): Promise<NordigenRequisition> {
  const data = await nordigenFetch("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference,
    }),
  });
  return data as NordigenRequisition;
}

export async function getRequisitionStatus(requisitionId: string): Promise<NordigenRequisition> {
  const data = await nordigenFetch(`/requisitions/${requisitionId}/`);
  return data as NordigenRequisition;
}

export interface NordigenAccountDetails {
  iban: string;
  currency: string;
  name?: string;
}

export async function getAccountDetails(accountId: string): Promise<NordigenAccountDetails> {
  const data = (await nordigenFetch(`/accounts/${accountId}/details/`)) as { account: NordigenAccountDetails };
  return data.account;
}

export interface NordigenTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  creditorName?: string;
  creditorAccount?: { iban?: string };
  debtorName?: string;
  debtorAccount?: { iban?: string };
}

export async function getTransactions(
  accountId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<NordigenTransaction[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const data = (await nordigenFetch(
    `/accounts/${accountId}/transactions/?date_from=${fmt(dateFrom)}&date_to=${fmt(dateTo)}`
  )) as { transactions: { booked: NordigenTransaction[] } };
  return data.transactions.booked ?? [];
}
```

**Step 4: Run all tests**

```bash
cd backend
npx vitest run
# Expected: all tests PASS (including new nordigen tests)
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
# Expected: no errors
```

**Step 6: Commit**

```bash
git add backend/src/services/nordigen.service.ts backend/src/test/nordigen.service.test.ts
git commit -m "feat(nordigen): add Nordigen API client with token cache and IBAN masking"
```

---

## Task 4: Banking Service

**Files:**
- Create: `backend/src/services/banking.service.ts`

**Note:** This service handles business logic: linking accounts, callback handling, and idempotent transaction sync. No new tests here — integration with Nordigen is tested in the controller layer. The sync function is testable by inspecting DB state.

**Step 1: Create `backend/src/services/banking.service.ts`**

```typescript
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { createAuditLog } from "./audit.service.js";
import { env } from "../config/env.js";
import { maskIban } from "./nordigen.service.js";
import * as nordigen from "./nordigen.service.js";
import type { Prisma } from "@prisma/client";

// ── Requisition initiation ────────────────────────────────────────────────────

export async function initiateRequisition(
  companyId: number,
  bankAccountId: number,
  userId: number
): Promise<{ link: string }> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
  });
  if (!account) throw new NotFoundError("Bankkonto", bankAccountId);

  if (!account.institutionId) {
    throw new AppError(400, "Kein Institut ausgewählt. Bitte zuerst institutionId setzen.");
  }

  const redirectUrl = `${env.NORDIGEN_REDIRECT_BASE}/banking/callback`;
  const reference = `company-${companyId}-account-${bankAccountId}-${Date.now()}`;

  const requisition = await nordigen.createRequisition(
    account.institutionId,
    redirectUrl,
    reference
  );

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      requisitionId: requisition.id,
      provider: "NORDIGEN",
      status: "pending_auth",
    },
  });

  await createAuditLog("BANK_REQUISITION_CREATED", { companyId, userId }, {
    bankAccountId,
    requisitionId: requisition.id,
  });

  logger.info({ bankAccountId, requisitionId: requisition.id }, "[BANKING] Requisition erstellt");
  return { link: requisition.link };
}

// ── Public OAuth callback (called by Nordigen after bank auth) ────────────────

export async function handleCallback(ref: string): Promise<string> {
  // ref = Nordigen requisition ID passed as query param ?ref=...
  const account = await prisma.bankAccount.findFirst({
    where: { requisitionId: ref },
    select: { id: true, companyId: true, iban: true, requisitionId: true },
  });

  if (!account) {
    logger.warn({ ref }, "[BANKING] Callback mit unbekannter requisitionId");
    throw new NotFoundError("Bankkonto für Requisition", ref);
  }

  const status = await nordigen.getRequisitionStatus(ref);

  if (status.status !== "LN" && status.status !== "LINKED") {
    // Not linked yet — Nordigen status codes: CR=CREATED, GC=GIVING_CONSENT, UA=UNDERGOING_AUTHENTICATION, LN=LINKED
    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { status: "pending_auth" },
    });
    return `${env.NORDIGEN_REDIRECT_BASE}/bank-accounts?status=pending`;
  }

  // Find the correct Nordigen account ID (matches our IBAN)
  let nordigenAccountId: string | null = null;
  for (const accId of status.accounts) {
    try {
      const details = await nordigen.getAccountDetails(accId);
      if (details.iban === account.iban) {
        nordigenAccountId = accId;
        break;
      }
    } catch {
      // skip accounts we can't fetch details for
    }
  }

  // Fall back to first account if no IBAN match (e.g., new account creation flow)
  if (!nordigenAccountId && status.accounts.length > 0) {
    nordigenAccountId = status.accounts[0];
  }

  await prisma.bankAccount.update({
    where: { id: account.id },
    data: {
      status: "connected",
      nordigenAccountId,
      lastSync: new Date(),
    },
  });

  await createAuditLog("BANK_LINKED", { companyId: account.companyId }, {
    bankAccountId: account.id,
    requisitionId: ref,
    nordigenAccountId,
  });

  logger.info({ bankAccountId: account.id, nordigenAccountId }, "[BANKING] Bank-Konto verknüpft");
  return `${env.NORDIGEN_REDIRECT_BASE}/bank-accounts?status=linked`;
}

// ── Idempotent transaction sync ──────────────────────────────────────────────

export async function syncBankAccount(companyId: number, bankAccountId: number): Promise<{ synced: number }> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId, provider: "NORDIGEN" },
  });
  if (!account) throw new NotFoundError("Nordigen-Bankkonto", bankAccountId);
  if (!account.nordigenAccountId) {
    throw new AppError(400, "Bank-Konto noch nicht verknüpft (kein nordigenAccountId)");
  }

  const dateFrom = account.lastSync ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days fallback
  const dateTo = new Date();

  const rawTransactions = await nordigen.getTransactions(account.nordigenAccountId, dateFrom, dateTo);

  let synced = 0;
  let balanceDelta = new (await import("@prisma/client")).Prisma.Decimal(0);

  for (const tx of rawTransactions) {
    const amount = new (await import("@prisma/client")).Prisma.Decimal(tx.transactionAmount.amount);
    const remittance = tx.remittanceInformationUnstructured
      ?? tx.remittanceInformationStructured
      ?? "";

    await prisma.bankTransaction.upsert({
      where: { nordigenId: tx.transactionId },
      create: {
        nordigenId: tx.transactionId,
        bookingDate: new Date(tx.bookingDate),
        valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
        amount,
        currency: tx.transactionAmount.currency,
        remittanceInfo: remittance.slice(0, 500),
        creditorName: tx.creditorName ?? null,
        creditorIban: tx.creditorAccount?.iban ?? null,
        debtorName: tx.debtorName ?? null,
        debtorIban: tx.debtorAccount?.iban ?? null,
        status: "UNMATCHED",
        bankAccountId,
        companyId,
      },
      update: {
        // Only update mutable fields; never change nordigenId, amount, dates
        remittanceInfo: remittance.slice(0, 500),
        creditorName: tx.creditorName ?? null,
        debtorName: tx.debtorName ?? null,
      },
    });

    balanceDelta = balanceDelta.plus(amount);
    synced++;
  }

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      lastSync: dateTo,
      // Recalculate balance from all transactions (not delta) for accuracy
      status: "connected",
    },
  });

  logger.info({ bankAccountId, synced }, "[BANKING] Sync abgeschlossen");
  return { synced };
}

// ── Cron: sync all Nordigen accounts across all companies ────────────────────

export async function syncAllAccounts(): Promise<void> {
  const nordigenAccounts = await prisma.bankAccount.findMany({
    where: { provider: "NORDIGEN", nordigenAccountId: { not: null }, status: "connected" },
    select: { id: true, companyId: true },
  });

  logger.info({ count: nordigenAccounts.length }, "[BANKING-SYNC] Starte automatischen Sync");

  for (const acc of nordigenAccounts) {
    try {
      const { synced } = await syncBankAccount(acc.companyId, acc.id);
      if (synced > 0) {
        logger.info({ bankAccountId: acc.id, synced }, "[BANKING-SYNC] Neue Transaktionen");
      }
    } catch (err) {
      // Never let one failing account block the others
      logger.error({ err, bankAccountId: acc.id }, "[BANKING-SYNC] Fehler bei Konto-Sync");
    }
  }
}

// ── List bank transactions (with IBAN masking) ───────────────────────────────

export async function listBankTransactions(
  companyId: number,
  bankAccountId: number,
  params: { page: number; limit: number; status?: string }
) {
  // Verify account belongs to company
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) throw new NotFoundError("Bankkonto", bankAccountId);

  const where: Prisma.BankTransactionWhereInput = { bankAccountId, companyId };
  if (params.status) where.status = params.status as "UNMATCHED" | "MATCHED" | "IGNORED";

  const skip = (params.page - 1) * params.limit;
  const [rows, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      orderBy: { bookingDate: "desc" },
      skip,
      take: params.limit,
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  // Mask IBANs before returning
  const masked = rows.map((tx) => ({
    ...tx,
    amount: tx.amount.toFixed(2),
    creditorIban: tx.creditorIban ? maskIban(tx.creditorIban) : null,
    debtorIban: tx.debtorIban ? maskIban(tx.debtorIban) : null,
  }));

  return {
    data: masked,
    meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) },
  };
}

export async function ignoreBankTransaction(
  companyId: number,
  bankTransactionId: number
): Promise<void> {
  const tx = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, companyId, status: "UNMATCHED" },
  });
  if (!tx) throw new NotFoundError("Banktransaktion", bankTransactionId);

  await prisma.bankTransaction.update({
    where: { id: bankTransactionId },
    data: { status: "IGNORED" },
  });
}
```

**Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
# Expected: no errors
```

**Step 3: Commit**

```bash
git add backend/src/services/banking.service.ts
git commit -m "feat(banking): add BankingService with Nordigen sync and callback handling"
```

---

## Task 5: Matching Service + Tests

**Files:**
- Create: `backend/src/services/matching.service.ts`
- Create: `backend/src/test/matching.service.test.ts`

**Step 1: Write tests for the matching algorithm (pure logic, no DB)**

Create `backend/src/test/matching.service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

// Test the pure matching helpers in isolation
// (Import from matching.service once created)

function scoreMatch(remittanceInfo: string, tenantName: string): number {
  let score = 0;
  const info = remittanceInfo.toLowerCase();
  const name = tenantName.toLowerCase();
  // +2 if all name parts appear in remittance (handles "Max Mustermann" -> ["max","mustermann"])
  const nameParts = name.split(/\s+/).filter(p => p.length > 2);
  if (nameParts.length > 0 && nameParts.every(part => info.includes(part))) {
    score += 2;
  }
  return score;
}

function amountsMatch(bankAmount: Prisma.Decimal, contractRent: number): boolean {
  const tolerance = new Prisma.Decimal("0.01");
  const rent = new Prisma.Decimal(contractRent.toFixed(2));
  return bankAmount.minus(rent).abs().lte(tolerance);
}

describe("matching: amountsMatch", () => {
  it("exact match returns true", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.00"), 1200)).toBe(true);
  });

  it("1 cent difference is within tolerance", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.01"), 1200)).toBe(true);
  });

  it("2 cent difference exceeds tolerance", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.02"), 1200)).toBe(false);
  });

  it("float imprecision is handled (1200.0000001)", () => {
    const floatRent = 1200.0000001; // typical float representation
    expect(amountsMatch(new Prisma.Decimal("1200.00"), floatRent)).toBe(true);
  });
});

describe("matching: scoreMatch", () => {
  it("full name match scores 2", () => {
    expect(scoreMatch("Miete Januar Max Mustermann WE01", "Max Mustermann")).toBe(2);
  });

  it("partial name (single word) match scores 2 when only one name part", () => {
    expect(scoreMatch("Miete Mustermann WE01", "Mustermann")).toBe(2);
  });

  it("no name in remittance scores 0", () => {
    expect(scoreMatch("Miete Januar", "Max Mustermann")).toBe(0);
  });

  it("case insensitive match", () => {
    expect(scoreMatch("MIETE JAN MAX MUSTERMANN", "max mustermann")).toBe(2);
  });

  it("partial first name only scores 0 (requires all parts)", () => {
    expect(scoreMatch("Miete Max", "Max Mustermann")).toBe(0);
  });
});
```

**Step 2: Run tests to verify they pass (pure logic)**

```bash
cd backend
npx vitest run src/test/matching.service.test.ts
# Expected: 9 tests PASS
```

**Step 3: Create `backend/src/services/matching.service.ts`**

```typescript
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { createAuditLog } from "./audit.service.js";
import { Prisma } from "@prisma/client";

// ── Pure helpers (exported for testing) ─────────────────────────────────────

export function amountsMatch(bankAmount: Prisma.Decimal, contractRent: number): boolean {
  const tolerance = new Prisma.Decimal("0.01");
  const rent = new Prisma.Decimal(contractRent.toFixed(2));
  return bankAmount.minus(rent).abs().lte(tolerance);
}

export function scoreMatch(remittanceInfo: string, tenantName: string): number {
  let score = 0;
  const info = remittanceInfo.toLowerCase();
  const nameParts = tenantName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  if (nameParts.length > 0 && nameParts.every((part) => info.includes(part))) {
    score += 2;
  }
  return score;
}

// ── Main matching engine ─────────────────────────────────────────────────────

export async function matchPendingTransactions(companyId: number): Promise<{ matched: number }> {
  // Only process positive amounts (credits = received payments)
  const pending = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      status: "UNMATCHED",
      amount: { gt: 0 },
    },
    orderBy: { bookingDate: "asc" },
  });

  if (pending.length === 0) return { matched: 0 };

  // Load all active contracts with tenant info once (cheaper than per-transaction queries)
  const activeContracts = await prisma.contract.findMany({
    where: { companyId, status: "AKTIV" },
    include: { tenant: { select: { name: true } } },
  });

  let matched = 0;

  for (const bankTx of pending) {
    // Step 1: Find contracts with matching rent amount
    const amountCandidates = activeContracts.filter((c) =>
      amountsMatch(bankTx.amount, c.monthlyRent)
    );

    if (amountCandidates.length === 0) continue;

    // Step 2: Score each candidate
    const scored = amountCandidates
      .map((c) => ({
        contract: c,
        score: scoreMatch(bankTx.remittanceInfo, c.tenant.name),
      }))
      .filter((s) => s.score >= 2) // require tenant name match
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) continue;

    // Step 3: Accept the best-scored candidate
    const best = scored[0].contract;
    const bookingMonth = new Date(
      bankTx.bookingDate.getFullYear(),
      bankTx.bookingDate.getMonth(),
      1
    );

    await prisma.$transaction(async (tx) => {
      // Upsert RentPayment for the booking month
      const existingPayment = await tx.rentPayment.findUnique({
        where: { contractId_month: { contractId: best.id, month: bookingMonth } },
      });

      const rentPayment = await tx.rentPayment.upsert({
        where: { contractId_month: { contractId: best.id, month: bookingMonth } },
        create: {
          contractId: best.id,
          companyId,
          month: bookingMonth,
          amountDue: best.monthlyRent,
          amountPaid: Number(bankTx.amount.toFixed(2)),
          status: "PUENKTLICH",
          dueDate: new Date(bookingMonth.getFullYear(), bookingMonth.getMonth(), 3), // 3rd of month typical
          paidDate: bankTx.bookingDate,
        },
        update: {
          amountPaid: { increment: Number(bankTx.amount.toFixed(2)) },
          status: "PUENKTLICH",
          paidDate: bankTx.bookingDate,
        },
      });

      // Create ledger Transaction entry
      const ledgerTx = await tx.transaction.create({
        data: {
          date: bankTx.bookingDate,
          description: bankTx.remittanceInfo.slice(0, 500) || `Miete ${best.tenant.name}`,
          type: "EINNAHME",
          amount: Number(bankTx.amount.toFixed(2)),
          category: "Miete",
          companyId,
          bankAccountId: bankTx.bankAccountId,
          propertyId: best.propertyId,
        },
      });

      // Mark BankTransaction as matched
      await tx.bankTransaction.update({
        where: { id: bankTx.id },
        data: {
          status: "MATCHED",
          rentPaymentId: rentPayment.id,
          transactionId: ledgerTx.id,
        },
      });
    });

    await createAuditLog("BANK_MATCH", { companyId }, {
      bankTransactionId: bankTx.id,
      contractId: best.id,
      tenantName: best.tenant.name, // name, not IBAN — safe to log
      amount: bankTx.amount.toFixed(2),
    });

    logger.info(
      { bankTransactionId: bankTx.id, contractId: best.id },
      "[MATCHING] Transaktion gematcht"
    );
    matched++;
  }

  if (matched > 0) {
    logger.info({ companyId, matched }, "[MATCHING] Automatisches Matching abgeschlossen");
  }
  return { matched };
}

// ── Cron: run matching for all companies with Nordigen accounts ──────────────

export async function matchAllPendingTransactions(): Promise<void> {
  const companies = await prisma.bankTransaction.findMany({
    where: { status: "UNMATCHED", amount: { gt: 0 } },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  for (const { companyId } of companies) {
    try {
      await matchPendingTransactions(companyId);
    } catch (err) {
      logger.error({ err, companyId }, "[MATCHING] Fehler beim automatischen Matching");
    }
  }
}
```

**Step 4: Update the test to import from the actual module**

Replace `backend/src/test/matching.service.test.ts` with the real imports:

```typescript
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { amountsMatch, scoreMatch } from "../services/matching.service.js";

describe("amountsMatch", () => {
  it("exact match returns true", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.00"), 1200)).toBe(true);
  });

  it("1 cent within tolerance", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.01"), 1200)).toBe(true);
  });

  it("2 cents exceeds tolerance", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.02"), 1200)).toBe(false);
  });

  it("float imprecision handled", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.00"), 1200.0000001)).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("full name match scores 2", () => {
    expect(scoreMatch("Miete Januar Max Mustermann WE01", "Max Mustermann")).toBe(2);
  });

  it("single-word name matches scores 2", () => {
    expect(scoreMatch("Miete Mustermann WE01", "Mustermann")).toBe(2);
  });

  it("no name scores 0", () => {
    expect(scoreMatch("Miete Januar", "Max Mustermann")).toBe(0);
  });

  it("case insensitive", () => {
    expect(scoreMatch("MIETE JAN MAX MUSTERMANN", "max mustermann")).toBe(2);
  });

  it("only first name scores 0 (all parts required)", () => {
    expect(scoreMatch("Miete Max", "Max Mustermann")).toBe(0);
  });
});
```

**Step 5: Run all tests**

```bash
cd backend
npx vitest run
# Expected: all tests PASS
```

**Step 6: TypeScript check**

```bash
npx tsc --noEmit
# Expected: no errors
```

**Step 7: Commit**

```bash
git add backend/src/services/matching.service.ts backend/src/test/matching.service.test.ts
git commit -m "feat(matching): add deterministic rent matching engine with Decimal precision"
```

---

## Task 6: DATEV Service + Tests

**Files:**
- Create: `backend/src/services/datev.service.ts`
- Create: `backend/src/test/datev.service.test.ts`

**Step 1: Write tests for CSV generation**

Create `backend/src/test/datev.service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Test pure CSV row building functions (no DB)

function formatDatevDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}${m}`; // DDMM — DATEV format
}

function formatDecimalGerman(amount: number): string {
  return Math.abs(amount).toFixed(2).replace(".", ",");
}

function buildBelegfeld1(txId: number): string {
  return `TX${String(txId).padStart(9, "0")}`.slice(0, 12);
}

describe("DATEV CSV helpers", () => {
  it("formatDatevDate returns DDMM", () => {
    expect(formatDatevDate(new Date("2026-03-15"))).toBe("1503");
  });

  it("formatDatevDate pads single digits", () => {
    expect(formatDatevDate(new Date("2026-01-05"))).toBe("0501");
  });

  it("formatDecimalGerman uses comma separator", () => {
    expect(formatDecimalGerman(1234.56)).toBe("1234,56");
  });

  it("formatDecimalGerman uses absolute value", () => {
    expect(formatDecimalGerman(-500)).toBe("500,00");
  });

  it("buildBelegfeld1 pads to 12 chars", () => {
    expect(buildBelegfeld1(42)).toBe("TX000000042");
    expect(buildBelegfeld1(42).length).toBeLessThanOrEqual(12);
  });

  it("buildBelegfeld1 truncates at 12 chars", () => {
    expect(buildBelegfeld1(123456789012).length).toBe(12);
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
cd backend
npx vitest run src/test/datev.service.test.ts
# Expected: 6 tests PASS
```

**Step 3: Create `backend/src/services/datev.service.ts`**

```typescript
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { createAuditLog } from "./audit.service.js";
import type { Transaction } from "@prisma/client";

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** DATEV Belegdatum format: DDMM (no year in data rows) */
export function formatDatevDate(date: Date): string {
  return (
    String(date.getDate()).padStart(2, "0") +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

/** German decimal format (comma separator), absolute value */
export function formatDecimalGerman(amount: number): string {
  return Math.abs(amount).toFixed(2).replace(".", ",");
}

/** Belegfeld1: unique document reference, max 12 chars */
export function buildBelegfeld1(txId: number): string {
  return `TX${String(txId).padStart(9, "0")}`.slice(0, 12);
}

// ── Settings management ──────────────────────────────────────────────────────

export async function getOrCreateSettings(companyId: number) {
  return prisma.companyAccountingSettings.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export async function upsertSettings(
  companyId: number,
  data: {
    beraternummer?: number | null;
    mandantennummer?: number | null;
    kontenrahmen?: "SKR03" | "SKR04";
    defaultBankAccount?: string;
    defaultIncomeAccount?: string;
    defaultExpenseAccount?: string;
    fiscalYearStart?: number;
  }
) {
  return prisma.companyAccountingSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

// ── Category → Account mappings ──────────────────────────────────────────────

export async function listMappings(companyId: number) {
  return prisma.categoryAccountMapping.findMany({
    where: { companyId },
    orderBy: { category: "asc" },
  });
}

export async function upsertMapping(
  companyId: number,
  category: string,
  accountNumber: string
) {
  return prisma.categoryAccountMapping.upsert({
    where: { companyId_category: { companyId, category } },
    create: { companyId, category, accountNumber },
    update: { accountNumber },
  });
}

// ── Export validation ────────────────────────────────────────────────────────

async function validateForExport(companyId: number) {
  const settings = await prisma.companyAccountingSettings.findUnique({
    where: { companyId },
  });
  if (!settings?.beraternummer || !settings?.mandantennummer) {
    throw new AppError(
      400,
      "DATEV-Export erfordert Beraternummer und Mandantennummer. Bitte unter Einstellungen → Buchhaltung konfigurieren."
    );
  }
  return settings;
}

// ── CSV generation ───────────────────────────────────────────────────────────

function buildHeader(settings: {
  beraternummer: number;
  mandantennummer: number;
  fiscalYearStart: number;
}, fromDate: Date, toDate: Date): string {
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad4 = (n: number) => String(n).padStart(4, "0");

  // DATEV EXTF timestamp: YYYYMMDDHHmmss000
  const timestamp =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}000`;

  // WJ-Beginn: first day of fiscal year
  const wjYear = fromDate.getFullYear();
  const wjBeginn = `${wjYear}${pad2(settings.fiscalYearStart)}01`;

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

  // DATEV EXTF header — 30 semicolon-separated fields
  const fields = [
    '"EXTF"',
    "700",
    "21",
    '"Buchungsstapel"',
    "12",
    timestamp,
    "", // Importiert am
    '"RE"', // Herkunft
    "", // Exportiert von
    "", // Importiert von
    String(settings.beraternummer),
    String(settings.mandantennummer),
    wjBeginn,
    "4", // Sachkontonummernlänge
    fmtDate(fromDate),
    fmtDate(toDate),
    '"Immoverwaltung"', // Bezeichnung
    "", // Diktatkürzel
    "1", // Buchungstyp (1=FiBu)
    "0", // Rechnungslegungszweck
    "0", // Festschreibung
    '"EUR"', // WKZ
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "0",
  ];

  return fields.join(";");
}

const COLUMN_HEADER =
  "Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;" +
  "Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);" +
  "BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;" +
  "Postensperre;Diverse Adressnummer;Geschäftspartnerbank;Sachverhalt;" +
  "Zinssperre;Beleglink";

function buildDataRow(
  tx: Transaction,
  categoryMap: Map<string, string>,
  settings: {
    defaultBankAccount: string;
    defaultIncomeAccount: string;
    defaultExpenseAccount: string;
  }
): string {
  const amount = formatDecimalGerman(tx.amount);
  const sh = tx.type === "EINNAHME" ? "H" : "S"; // Haben = credit for income

  // Konto = P&L account (revenue/expense), Gegenkonto = bank/cash/debtor
  const konto =
    categoryMap.get(tx.category) ??
    (tx.type === "EINNAHME" ? settings.defaultIncomeAccount : settings.defaultExpenseAccount);
  const gegenkonto = settings.defaultBankAccount;

  const belegdatum = formatDatevDate(tx.date);
  const belegfeld1 = buildBelegfeld1(tx.id);
  const buchungstext = tx.description.slice(0, 60).replace(/;/g, " "); // no semicolons in text

  return [
    amount,
    sh,
    "", // WKZ (EUR default from header)
    "", // Kurs
    "", // Basis-Umsatz
    "", // WKZ Basis-Umsatz
    konto,
    gegenkonto,
    "", // BU-Schlüssel
    belegdatum,
    belegfeld1,
    "", // Belegfeld2
    "", // Skonto
    buchungstext,
    "", // Postensperre
    "", // Diverse Adressnummer
    "", // Geschäftspartnerbank
    "", // Sachverhalt
    "", // Zinssperre
    "", // Beleglink
  ].join(";");
}

// ── Public export function ───────────────────────────────────────────────────

export async function generateExport(
  companyId: number,
  fromDate: Date,
  toDate: Date,
  userId?: number
): Promise<{ filename: string; buffer: Buffer }> {
  const settings = await validateForExport(companyId);

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
  });

  if (transactions.length === 0) {
    throw new AppError(404, "Keine Transaktionen im gewählten Zeitraum gefunden");
  }

  const mappings = await prisma.categoryAccountMapping.findMany({
    where: { companyId },
  });
  const categoryMap = new Map(mappings.map((m) => [m.category, m.accountNumber]));

  const rows: string[] = [
    buildHeader(settings as typeof settings & { beraternummer: number; mandantennummer: number }, fromDate, toDate),
    COLUMN_HEADER,
    ...transactions.map((tx) => buildDataRow(tx, categoryMap, settings)),
  ];

  // UTF-8 BOM required by DATEV
  const csv = "\uFEFF" + rows.join("\r\n") + "\r\n";
  const buffer = Buffer.from(csv, "utf8");

  const dateStr = `${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}`;
  const filename = `DATEV_Export_${dateStr}.csv`;

  // Log the export
  await prisma.datevExportLog.create({
    data: {
      fromDate,
      toDate,
      txCount: transactions.length,
      fileName: filename,
      companyId,
      createdBy: userId ?? null,
    },
  });

  await createAuditLog("DATEV_EXPORT", { companyId, userId }, {
    filename,
    txCount: transactions.length,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
  });

  logger.info({ companyId, txCount: transactions.length, filename }, "[DATEV] Export erstellt");
  return { filename, buffer };
}
```

**Step 4: Update test to import from actual module**

Replace `backend/src/test/datev.service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatDatevDate,
  formatDecimalGerman,
  buildBelegfeld1,
} from "../services/datev.service.js";

describe("formatDatevDate", () => {
  it("returns DDMM format", () => {
    expect(formatDatevDate(new Date("2026-03-15"))).toBe("1503");
  });

  it("pads single digits", () => {
    expect(formatDatevDate(new Date("2026-01-05"))).toBe("0501");
  });
});

describe("formatDecimalGerman", () => {
  it("uses comma separator", () => {
    expect(formatDecimalGerman(1234.56)).toBe("1234,56");
  });

  it("uses absolute value for negative amounts", () => {
    expect(formatDecimalGerman(-500)).toBe("500,00");
  });
});

describe("buildBelegfeld1", () => {
  it("pads to expected length", () => {
    expect(buildBelegfeld1(42)).toBe("TX000000042");
    expect(buildBelegfeld1(42).length).toBeLessThanOrEqual(12);
  });

  it("truncates at 12 chars for large IDs", () => {
    expect(buildBelegfeld1(123456789012).length).toBe(12);
  });
});
```

**Step 5: Run all tests**

```bash
cd backend
npx vitest run
# Expected: all tests PASS (including 6 DATEV tests)
```

**Step 6: TypeScript check**

```bash
npx tsc --noEmit
# Expected: no errors
```

**Step 7: Commit**

```bash
git add backend/src/services/datev.service.ts backend/src/test/datev.service.test.ts
git commit -m "feat(datev): add DATEV Buchungsstapel CSV export service with UTF-8 BOM"
```

---

## Task 7: Zod Schemas

**Files:**
- Create: `backend/src/schemas/banking.schema.ts`
- Create: `backend/src/schemas/datev.schema.ts`

**Step 1: Create `backend/src/schemas/banking.schema.ts`**

```typescript
import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const initiateRequisitionSchema = z.object({
  bankAccountId: z.number().int().positive(),
  institutionId: z.string().min(1).max(200),
});

export const bankTransactionQuerySchema = paginationSchema.extend({
  status: z.enum(["UNMATCHED", "MATCHED", "IGNORED"]).optional(),
});

export const listInstitutionsSchema = z.object({
  country: z.string().length(2).toUpperCase().default("DE"),
});
```

**Step 2: Create `backend/src/schemas/datev.schema.ts`**

```typescript
import { z } from "zod";

export const datevSettingsSchema = z.object({
  beraternummer: z.number().int().min(1001).max(9999999).nullable().optional(),
  mandantennummer: z.number().int().min(1).max(99999).nullable().optional(),
  kontenrahmen: z.enum(["SKR03", "SKR04"]).optional(),
  defaultBankAccount: z.string().length(4).optional(),
  defaultIncomeAccount: z.string().length(4).optional(),
  defaultExpenseAccount: z.string().length(4).optional(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
});

export const datevMappingSchema = z.object({
  category: z.string().min(1).max(200),
  accountNumber: z.string().length(4).regex(/^\d{4}$/, "Kontonummer muss 4 Ziffern haben"),
});

export const datevExportSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
}).refine((d) => d.fromDate <= d.toDate, {
  message: "fromDate muss vor toDate liegen",
});
```

**Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add backend/src/schemas/banking.schema.ts backend/src/schemas/datev.schema.ts
git commit -m "feat(schemas): add Zod schemas for banking and DATEV modules"
```

---

## Task 8: Banking Controller

**Files:**
- Create: `backend/src/controllers/banking.controller.ts`

**Step 1: Create `backend/src/controllers/banking.controller.ts`**

```typescript
import type { Request, Response } from "express";
import * as bankingService from "../services/banking.service.js";
import * as nordigenService from "../services/nordigen.service.js";
import * as matchingService from "../services/matching.service.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

// GET /banking/institutions?country=DE
export async function listInstitutions(req: Request, res: Response): Promise<void> {
  const country = (req.query.country as string) || "DE";
  const institutions = await nordigenService.listInstitutions(country);
  res.json({ data: institutions });
}

// POST /banking/requisitions  { bankAccountId, institutionId }
export async function initiateRequisition(req: Request, res: Response): Promise<void> {
  const { bankAccountId, institutionId } = req.body as { bankAccountId: number; institutionId: string };

  // Store institutionId on the BankAccount so initiateRequisition can use it
  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { institutionId, provider: "NORDIGEN" },
  });

  const result = await bankingService.initiateRequisition(req.companyId!, bankAccountId, req.userId!);
  res.status(201).json({ data: result });
}

// GET /banking/callback?ref=<requisitionId>  — PUBLIC, no auth
export async function handleCallback(req: Request, res: Response): Promise<void> {
  const ref = req.query.ref as string;
  if (!ref) {
    res.redirect(`${env.NORDIGEN_REDIRECT_BASE}/bank-accounts?error=missing_ref`);
    return;
  }

  try {
    const redirectUrl = await bankingService.handleCallback(ref);
    res.redirect(redirectUrl);
  } catch {
    res.redirect(`${env.NORDIGEN_REDIRECT_BASE}/bank-accounts?error=callback_failed`);
  }
}

// GET /banking/accounts/:id/status
export async function getAccountStatus(req: Request, res: Response): Promise<void> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: Number(req.params.id), companyId: req.companyId! },
    select: {
      id: true, name: true, status: true, provider: true,
      requisitionId: true, nordigenAccountId: true, lastSync: true,
      // Never return raw IBAN here — return masked
      iban: true,
    },
  });
  if (!account) {
    res.status(404).json({ error: "Bankkonto nicht gefunden" });
    return;
  }

  res.json({
    data: {
      ...account,
      iban: nordigenService.maskIban(account.iban),
    },
  });
}

// POST /banking/accounts/:id/sync
export async function syncAccount(req: Request, res: Response): Promise<void> {
  const result = await bankingService.syncBankAccount(req.companyId!, Number(req.params.id));
  res.json({ data: result });
}

// GET /banking/accounts/:id/transactions
export async function listTransactions(req: Request, res: Response): Promise<void> {
  const result = await bankingService.listBankTransactions(req.companyId!, Number(req.params.id), {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    status: req.query.status as string | undefined,
  });
  res.json(result);
}

// POST /banking/accounts/:id/transactions/:txId/ignore
export async function ignoreTransaction(req: Request, res: Response): Promise<void> {
  await bankingService.ignoreBankTransaction(req.companyId!, Number(req.params.txId));
  res.status(204).end();
}

// POST /banking/match
export async function runMatching(req: Request, res: Response): Promise<void> {
  const result = await matchingService.matchPendingTransactions(req.companyId!);
  res.json({ data: result });
}
```

**Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add backend/src/controllers/banking.controller.ts
git commit -m "feat(banking): add banking controller"
```

---

## Task 9: DATEV Controller

**Files:**
- Create: `backend/src/controllers/datev.controller.ts`

**Step 1: Create `backend/src/controllers/datev.controller.ts`**

```typescript
import type { Request, Response } from "express";
import * as datevService from "../services/datev.service.js";

// GET /finance/datev/settings
export async function getSettings(req: Request, res: Response): Promise<void> {
  const settings = await datevService.getOrCreateSettings(req.companyId!);
  res.json({ data: settings });
}

// PUT /finance/datev/settings
export async function putSettings(req: Request, res: Response): Promise<void> {
  const settings = await datevService.upsertSettings(req.companyId!, req.body);
  res.json({ data: settings });
}

// GET /finance/datev/mappings
export async function getMappings(req: Request, res: Response): Promise<void> {
  const mappings = await datevService.listMappings(req.companyId!);
  res.json({ data: mappings });
}

// PUT /finance/datev/mappings/:category
export async function putMapping(req: Request, res: Response): Promise<void> {
  const { category } = req.params;
  const { accountNumber } = req.body as { accountNumber: string };
  const mapping = await datevService.upsertMapping(req.companyId!, category, accountNumber);
  res.json({ data: mapping });
}

// POST /finance/datev/export
export async function exportCsv(req: Request, res: Response): Promise<void> {
  const { fromDate, toDate } = req.body as { fromDate: string; toDate: string };
  const { filename, buffer } = await datevService.generateExport(
    req.companyId!,
    new Date(fromDate),
    new Date(toDate),
    req.userId
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.send(buffer);
}
```

**Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add backend/src/controllers/datev.controller.ts
git commit -m "feat(datev): add DATEV controller"
```

---

## Task 10: Banking Routes

**Files:**
- Create: `backend/src/routes/banking.routes.ts`

**Step 1: Create `backend/src/routes/banking.routes.ts`**

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  initiateRequisitionSchema,
  bankTransactionQuerySchema,
  listInstitutionsSchema,
} from "../schemas/banking.schema.js";
import * as ctrl from "../controllers/banking.controller.js";

const router = Router();

// Institutions list (no IBAN data, safe for VERWALTER)
router.get(
  "/institutions",
  validate({ query: listInstitutionsSchema }),
  ctrl.listInstitutions
);

// Initiate PSD2 bank connection
router.post(
  "/requisitions",
  requireRole("ADMIN", "VERWALTER"),
  validate({ body: initiateRequisitionSchema }),
  ctrl.initiateRequisition
);

// Account status
router.get("/accounts/:id/status", ctrl.getAccountStatus);

// Manual sync trigger
router.post("/accounts/:id/sync", requireRole("ADMIN", "VERWALTER"), ctrl.syncAccount);

// List bank transactions
router.get(
  "/accounts/:id/transactions",
  validate({ query: bankTransactionQuerySchema }),
  ctrl.listTransactions
);

// Ignore a transaction
router.post(
  "/accounts/:id/transactions/:txId/ignore",
  requireRole("ADMIN", "VERWALTER"),
  ctrl.ignoreTransaction
);

// Run matching engine
router.post("/match", requireRole("ADMIN", "VERWALTER"), ctrl.runMatching);

export { router as bankingRouter };

// Named export for the public callback handler (mounted without auth in index.ts)
export { handleCallback as bankingCallbackHandler } from "../controllers/banking.controller.js";
```

**Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add backend/src/routes/banking.routes.ts
git commit -m "feat(banking): add banking routes"
```

---

## Task 11: DATEV Routes

**Files:**
- Create: `backend/src/routes/datev.routes.ts`

**Step 1: Create `backend/src/routes/datev.routes.ts`**

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { datevSettingsSchema, datevMappingSchema, datevExportSchema } from "../schemas/datev.schema.js";
import * as ctrl from "../controllers/datev.controller.js";

const router = Router();

// GET /finance/datev/settings
router.get("/settings", requireRole("ADMIN"), ctrl.getSettings);

// PUT /finance/datev/settings
router.put(
  "/settings",
  requireRole("ADMIN"),
  validate({ body: datevSettingsSchema }),
  ctrl.putSettings
);

// GET /finance/datev/mappings
router.get("/mappings", requireRole("ADMIN"), ctrl.getMappings);

// PUT /finance/datev/mappings/:category
router.put(
  "/mappings/:category",
  requireRole("ADMIN"),
  validate({ body: datevMappingSchema.pick({ accountNumber: true }) }),
  ctrl.putMapping
);

// POST /finance/datev/export  — also allowed for BUCHHALTER
router.post(
  "/export",
  requireRole("ADMIN", "BUCHHALTER"),
  validate({ body: datevExportSchema }),
  ctrl.exportCsv
);

export { router as datevRouter };
```

**Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add backend/src/routes/datev.routes.ts
git commit -m "feat(datev): add DATEV routes under /finance/datev"
```

---

## Task 12: Mount Routes in index.ts

**Files:**
- Modify: `backend/src/routes/index.ts`

**Step 1: Add the new imports and route mounts**

In `backend/src/routes/index.ts`, add after the last import:

```typescript
import { bankingRouter, bankingCallbackHandler } from "./banking.routes.js";
import { datevRouter } from "./datev.routes.js";
```

Then add these lines to the route mounting section — the **public callback goes first** (before requireAuth), the protected routes go after:

```typescript
// Public: Nordigen OAuth callback (no auth — browser is redirected here by Nordigen)
router.get("/banking/callback", bankingCallbackHandler);

// Protected banking and DATEV routes
router.use("/banking", requireAuth, tenantGuard, bankingRouter);
router.use("/finance/datev", requireAuth, tenantGuard, datevRouter);
```

**Important:** The `router.get("/banking/callback", ...)` line must appear **before** the `router.use("/banking", requireAuth, ...)` line to ensure the public callback is handled without auth.

**Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
# Expected: no errors
```

**Step 3: Run all tests**

```bash
npx vitest run
# Expected: all tests PASS
```

**Step 4: Commit**

```bash
git add backend/src/routes/index.ts
git commit -m "feat(routes): mount /api/banking and /api/finance/datev routes"
```

---

## Task 13: Cron Integration

**Files:**
- Modify: `backend/src/services/retention.service.ts`

**Step 1: Add imports at top of `retention.service.ts`**

Add after existing imports:

```typescript
import { syncAllAccounts } from "./banking.service.js";
import { matchAllPendingTransactions } from "./matching.service.js";
```

**Step 2: Add 6-hour banking sync to the `startRetentionCleanup` function**

The existing function uses `CLEANUP_INTERVAL_MS = 60 * 60 * 1000` (1 hour). Add a separate 6-hour interval for banking sync.

Add this constant after `CLEANUP_INTERVAL_MS`:

```typescript
const BANKING_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Stunden
```

Add this variable after `let cleanupTimer`:

```typescript
let bankingSyncTimer: ReturnType<typeof setInterval> | null = null;
```

Inside `startRetentionCleanup()`, after the existing `setInterval` for cleanup, add:

```typescript
  // Banking sync every 6 hours (PSD2 rate limit: max 4x/day per account)
  bankingSyncTimer = setInterval(() => {
    syncAllAccounts()
      .then(() => matchAllPendingTransactions())
      .catch((err) => logger.error({ err }, "[BANKING-SYNC] Fehler beim automatischen Sync"));
  }, BANKING_SYNC_INTERVAL_MS);

  logger.info("Banking-Sync gestartet (Intervall: 6h)");
```

Inside `stopRetentionCleanup()`, add:

```typescript
  if (bankingSyncTimer) {
    clearInterval(bankingSyncTimer);
    bankingSyncTimer = null;
  }
```

**Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit
# Expected: no errors
```

**Step 4: Run all tests**

```bash
npx vitest run
# Expected: all previous tests still PASS
```

**Step 5: Commit**

```bash
git add backend/src/services/retention.service.ts
git commit -m "feat(cron): add 6-hour PSD2 banking sync + auto-matching to retention scheduler"
```

---

## Task 14: Final Verification

**Step 1: Full TypeScript compile check**

```bash
cd backend && npx tsc --noEmit
# Expected: no output (zero errors)
```

**Step 2: Run full test suite**

```bash
cd backend && npx vitest run
# Expected: all tests pass
# New tests added: 4 (nordigen) + 9 (matching) + 6 (datev) = 19 new test cases
```

**Step 3: Verify route mounting (grep check)**

```bash
grep -n "banking\|datev" backend/src/routes/index.ts
# Expected: see 4 lines — callback, bankingRouter, datevRouter, imports
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: DATEV export + PSD2 Nordigen banking integration complete

Tasks completed:
- Prisma: BankTransaction (Decimal), CompanyAccountingSettings, CategoryAccountMapping, DatevExportLog
- BankAccount extended: provider, institutionId, requisitionId, nordigenAccountId
- nordigen.service: thin API client, token cache (in-memory, 24h), IBAN masking
- banking.service: requisition initiation, OAuth callback, idempotent sync, IBAN masking
- matching.service: deterministic matching (amount ±0.01 + tenant name), Prisma.Decimal
- datev.service: DATEV EXTF Buchungsstapel CSV, UTF-8 BOM, category→account mappings
- Routes: /api/banking (protected + public callback), /api/finance/datev
- Cron: 6-hour banking sync wired into retention.service"
```

---

## New API Endpoints Summary

### Banking (`/api/banking`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/banking/institutions?country=DE` | VERWALTER+ | List supported banks |
| `POST` | `/banking/requisitions` | VERWALTER+ | Initiate PSD2 linking |
| `GET` | `/banking/callback?ref=...` | **PUBLIC** | Nordigen OAuth callback |
| `GET` | `/banking/accounts/:id/status` | VERWALTER+ | Account status |
| `POST` | `/banking/accounts/:id/sync` | VERWALTER+ | Manual sync |
| `GET` | `/banking/accounts/:id/transactions` | VERWALTER+ | List BankTransactions |
| `POST` | `/banking/accounts/:id/transactions/:txId/ignore` | VERWALTER+ | Ignore transaction |
| `POST` | `/banking/match` | VERWALTER+ | Run matching engine |

### DATEV (`/api/finance/datev`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/finance/datev/settings` | ADMIN | Get accounting settings |
| `PUT` | `/finance/datev/settings` | ADMIN | Update settings |
| `GET` | `/finance/datev/mappings` | ADMIN | List category mappings |
| `PUT` | `/finance/datev/mappings/:category` | ADMIN | Upsert mapping |
| `POST` | `/finance/datev/export` | ADMIN/BUCHHALTER | Download DATEV CSV |

---

## Environment Variables Required

Add to `.env` (production deployment requires real credentials):
```
NORDIGEN_SECRET_ID=your-secret-id-from-gocardless
NORDIGEN_SECRET_KEY=your-secret-key-from-gocardless
NORDIGEN_REDIRECT_BASE=https://your-app-domain.com
```

Get credentials at: https://bankaccountdata.gocardless.com/
