# Design: DATEV Export + PSD2 Banking (Nordigen/GoCardless)

**Date:** 2026-02-25
**Status:** Approved
**Stack:** Express 5 / Prisma 6 / PostgreSQL / TypeScript ESM

---

## 1. Context

Property management SaaS (multi-tenant). Each `Company` represents one Hausverwaltung. Two new modules:

1. **DATEV Export** — generate Buchungsstapel CSV from `Transaction` records for tax accountants
2. **PSD2 Banking** — connect bank accounts via Nordigen/GoCardless, auto-import `BankTransaction` records, deterministically match them to `RentPayment`

---

## 2. Schema Changes

### New Enum
```prisma
enum BankProvider { MANUAL  NORDIGEN }
enum BankTxStatus  { UNMATCHED  MATCHED  IGNORED }
enum ChartOfAccounts { SKR03  SKR04 }
```

### Extend `BankAccount`
```prisma
provider        BankProvider  @default(MANUAL)
institutionId   String?
requisitionId   String?        // Nordigen requisition UUID
```

### New Model: `BankTransaction`
```prisma
model BankTransaction {
  id             Int          @id @default(autoincrement())
  nordigenId     String       @unique
  bookingDate    DateTime
  valueDate      DateTime?
  amount         Decimal      @db.Decimal(15,2)
  currency       String       @default("EUR")
  remittanceInfo String       @default("")
  creditorName   String?
  creditorIban   String?       // masked in API responses
  debtorName     String?
  debtorIban     String?       // masked in API responses
  status         BankTxStatus @default(UNMATCHED)
  bankAccountId  Int
  companyId      Int
  rentPaymentId  Int?
  transactionId  Int?
  ...relations...
}
```

### New Model: `CompanyAccountingSettings`
```prisma
model CompanyAccountingSettings {
  id                   Int             @id @default(autoincrement())
  companyId            Int             @unique
  beraternummer        Int?
  mandantennummer      Int?
  kontenrahmen         ChartOfAccounts @default(SKR03)
  defaultDebitAccount  String          @default("8400")
  defaultCreditAccount String          @default("1200")
  fiscalYearStart      Int             @default(1)
  ...relation to Company...
}
```

### New Model: `CategoryAccountMapping`
```prisma
model CategoryAccountMapping {
  id           Int    @id @default(autoincrement())
  category     String
  accountNumber String
  companyId    Int
  @@unique([companyId, category])
}
```

### New Model: `DatevExportLog`
```prisma
model DatevExportLog {
  id        Int      @id @default(autoincrement())
  fromDate  DateTime
  toDate    DateTime
  txCount   Int
  fileName  String
  companyId Int
  createdBy Int?
  createdAt DateTime @default(now())
}
```

---

## 3. Services

### `nordigen.service.ts` — thin API client
- `getAccessToken()` — POST /token/new/, module-level cache (24h - 5min buffer), never logged
- `listInstitutions(countryCode)` — GET /institutions/
- `createRequisition(institutionId, redirectUrl)` — returns `{ id, link }`
- `getRequisitionStatus(requisitionId)` — returns status + accountIds
- `getTransactions(nordigenAccountId, dateFrom, dateTo)` — raw bank transactions

### `banking.service.ts` — business logic
- `initiateRequisition(companyId, bankAccountId)` — validates provider=NORDIGEN, calls Nordigen, stores requisitionId, returns link
- `handleCallback(ref)` — looks up BankAccount by requisitionId, confirms LINKED, updates status, returns frontend redirect URL
- `syncBankAccount(companyId, bankAccountId)` — idempotent upsert by nordigenId, updates balance + lastSync
- `syncAllAccounts()` — iterates all NORDIGEN BankAccounts across all companies, used by cron

### `matching.service.ts` — deterministic matching engine
Scoring per UNMATCHED BankTransaction (amount > 0):
1. Find active contracts where `monthlyRent` matches amount within ±0.01
2. Score: +2 if tenant name in remittanceInfo (case-insensitive); +1 if any contract reference present
3. Accept only if score ≥ 2 (requires tenant name match)
4. On match: upsert RentPayment, create Transaction ledger entry, set status=MATCHED
5. Write AuditLog: `BANK_MATCH`

### `datev.service.ts` — DATEV CSV export
- `getOrCreateSettings(companyId)` — lazy create with defaults
- `validateForExport(companyId)` — throws if beraternummer/mandantennummer null
- `generateExport(companyId, fromDate, toDate)` — DATEV Buchungsstapel CSV:
  - UTF-8 with BOM (`\uFEFF`)
  - Semicolon separator
  - DATEV header line 1: metadata (Berater-Nr, Mandant-Nr, WJ-Beginn, etc.)
  - DATEV header line 2: column names
  - Data rows: Umsatz, S/H, Konto, Gegenkonto, Buchungsdatum, Belegfeld1
  - Writes DatevExportLog, returns `{ filename, buffer: Buffer }`

---

## 4. Routes

### `/api/banking` (requireAuth + tenantGuard, except callback)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/institutions` | VERWALTER+ | List banks for country |
| POST | `/requisitions` | VERWALTER+ | Initiate bank linking |
| GET | `/callback` | **public** | Nordigen OAuth callback |
| GET | `/accounts/:id/status` | VERWALTER+ | Requisition status |
| POST | `/accounts/:id/sync` | VERWALTER+ | Manual sync |
| GET | `/accounts/:id/transactions` | VERWALTER+ | List BankTransactions (IBAN masked) |
| POST | `/accounts/:id/transactions/:txId/ignore` | VERWALTER+ | Mark IGNORED |
| POST | `/match` | VERWALTER+ | Run matching engine |

### `/api/finance/datev` (requireAuth + tenantGuard)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings` | ADMIN | Get accounting settings |
| PUT | `/settings` | ADMIN | Upsert settings + mappings |
| GET | `/mappings` | ADMIN | List category mappings |
| POST | `/export` | ADMIN/BUCHHALTER | Generate + stream CSV |

---

## 5. Background Sync

Added to `retention.service.ts` at 6-hour interval:
```ts
syncAllAccounts()  // nordigen sync
  .then(() => matchAllPendingTransactions())  // auto-match per company
  .catch(err => logger.error({ err }, "[BANKING-SYNC] Fehler"))
```

---

## 6. Security

| Concern | Mitigation |
|---------|-----------|
| IBAN in logs | `maskIban()` helper, applied in controller before any log/response |
| Nordigen credentials | `NORDIGEN_SECRET_ID` / `NORDIGEN_SECRET_KEY` via `env.ts`, never logged |
| Access token | In-memory module cache only, never persisted to DB |
| Amount precision | `Decimal.toFixed(2)` for CSV; `Decimal.equals()` for comparisons |
| Idempotency | `BankTransaction.nordigenId @unique` + Prisma upsert |
| Callback forgery | `ref` is Nordigen's own UUID stored in DB; mismatched refs → 404 |
| Rate limiting | Cron job has 6h cooldown; no user-facing rate limit issue |

---

## 7. New Environment Variables

```env
NORDIGEN_SECRET_ID=...
NORDIGEN_SECRET_KEY=...
NORDIGEN_REDIRECT_BASE=https://app.immoverwalt.de   # no trailing slash
```

---

## 8. Implementation Order

1. Prisma schema + migration
2. `env.ts` additions
3. `nordigen.service.ts`
4. `banking.service.ts` + `matching.service.ts`
5. `datev.service.ts`
6. Schemas (Zod) for both modules
7. Controllers (banking, datev)
8. Routes (banking, datev) + mount in `index.ts`
9. Cron integration in `retention.service.ts`
10. TypeScript check
