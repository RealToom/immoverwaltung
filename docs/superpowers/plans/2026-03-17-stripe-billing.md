# Stripe Billing Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Stripe Billing so companies self-service subscribe via Checkout, with Superadmin manual override, a subscription guard blocking expired/unpaid accounts, and a BillingLocked lock screen.

**Architecture:** New Prisma enums + Company fields → `billing.service.ts` wraps Stripe SDK → `subscriptionGuard` middleware blocks all tenant routes except `/billing/*` and `/auth/*` → Stripe webhook (registered before `express.json()` in `app.ts`) keeps DB in sync. Frontend: AuthContext fetches billing status in parallel with `/auth/me`, 402 intercept redirects to `/billing-locked`, Settings "Abonnement" tab for self-service.

**Tech Stack:** Stripe Node SDK (`stripe`), Prisma 6, Express 5, React 18, React Query, Shadcn/UI, Zod, TypeScript.

---

## File Map

### Backend — Create
| File | Responsibility |
|------|---------------|
| `backend/src/schemas/billing.schema.ts` | Zod schemas: checkout body (`plan: "PRO"\|"BUSINESS"`), updateSubscription body |
| `backend/src/services/billing.service.ts` | Stripe SDK wrapper: getOrCreateStripeCustomer, createCheckoutSession, createPortalSession, price→PlanType mapping |
| `backend/src/controllers/billing.controller.ts` | Handler functions: getBillingStatus, createCheckout, createPortal |
| `backend/src/routes/billing.routes.ts` | Protected billing routes (requireAuth + tenantGuard, no subscriptionGuard) |
| `backend/src/routes/stripe-webhook.routes.ts` | Raw-body webhook handler export |
| `backend/src/middleware/subscriptionGuard.ts` | 402 guard for expired/canceled subscriptions |
| `backend/src/test/subscriptionGuard.test.ts` | Unit tests for all 6 guard logic branches |
| `backend/src/test/billing.service.test.ts` | Unit tests for billing service with mocked Stripe |
| `backend/src/test/stripe-webhook.test.ts` | Unit test: manualOverride=true skips updates |
| `backend/prisma/migrations/[timestamp]_billing_fields/migration.sql` | Auto-generated + manual data migration |

### Backend — Modify
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `SubscriptionStatus`, `PlanType` enums + 7 billing fields to Company |
| `backend/src/config/env.ts` | Add 4 Stripe env vars + `CLIENT_URL` |
| `backend/src/app.ts` | Register Stripe webhook BEFORE `express.json()` |
| `backend/src/routes/index.ts` | Import billingRouter (no guard); apply `subscriptionGuard` to all tenant routes |
| `backend/src/controllers/superadmin.controller.ts` | `createCompany` sets trial fields; `deleteCompany` cancels Stripe resources; new `updateSubscription` handler |
| `backend/src/routes/superadmin.routes.ts` | Add `PATCH /companies/:id/subscription` |

### Frontend — Create
| File | Responsibility |
|------|---------------|
| `cozy-estate-central/src/pages/BillingLocked.tsx` | Full-page lock screen with plan cards + upgrade buttons |
| `cozy-estate-central/src/hooks/api/useBilling.ts` | React Query hooks: useBillingStatus, useCreateCheckout, useCreatePortalSession |

### Frontend — Modify
| File | Change |
|------|--------|
| `cozy-estate-central/src/lib/api.ts` | Add 402 intercept: redirect to /billing-locked for non-billing, non-auth paths |
| `cozy-estate-central/src/contexts/AuthContext.tsx` | Fetch /auth/me + /billing/status in parallel; store subscription state |
| `cozy-estate-central/src/App.tsx` | Add /billing-locked as public route outside ProtectedRoute |
| `cozy-estate-central/src/pages/Settings.tsx` | New "Abonnement" tab with status display + upgrade/portal buttons + post-checkout polling |
| `cozy-estate-central/src/pages/SuperAdmin.tsx` | "Abo" badge column + "Abo setzen" dialog |
| `cozy-estate-central/src/hooks/api/useSuperAdmin.ts` | Add `useUpdateSubscription` mutation + `SuperAdminCompany` billing fields |

---

## Task 1: Install Stripe SDK

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install stripe package**

```bash
cd backend && npm install stripe
```

- [ ] **Step 2: Verify installation**

```bash
cd backend && node -e "import('stripe').then(() => console.log('OK'))"
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install stripe SDK"
```

---

## Task 2: Prisma Schema — Billing Fields

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add enums and Company fields**

In `schema.prisma`, add after the existing enums section (before or after `UserRole`):

```prisma
enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELED
  MANUAL
}

enum PlanType {
  TRIAL
  PRO
  BUSINESS
}
```

In the `Company` model, add these fields after `updatedAt`:

```prisma
  stripeCustomerId      String?            @map("stripe_customer_id")
  stripeSubscriptionId  String?            @map("stripe_subscription_id")
  subscriptionStatus    SubscriptionStatus @map("subscription_status")
  planType              PlanType           @map("plan_type")
  trialEndsAt           DateTime?          @map("trial_ends_at")
  currentPeriodEnd      DateTime?          @map("current_period_end")
  manualOverride        Boolean            @default(false) @map("manual_override")
```

- [ ] **Step 2: Create migration**

```bash
cd backend && npx prisma migrate dev --name billing_fields
```

Expected: Migration file created in `backend/prisma/migrations/`.

- [ ] **Step 3: Edit generated migration to add data migration for existing companies**

Open the generated `migration.sql` and append at the end (before the closing if there is one):

```sql
-- Set existing companies to MANUAL/PRO so they retain full access
UPDATE companies
SET subscription_status = 'MANUAL',
    plan_type = 'PRO',
    manual_override = true
WHERE subscription_status IS NULL;
```

> Note: The migration adds NOT NULL columns `subscription_status` and `plan_type` without defaults (no `@default()` in schema). Prisma generates `ALTER TABLE ADD COLUMN ... NOT NULL` which requires the UPDATE to run in the same migration. If the generated SQL adds the columns as nullable first, the UPDATE is correct; if not, you may need to split into: ADD NULLABLE → UPDATE → ALTER NOT NULL. Check the generated file and adjust if needed.

- [ ] **Step 4: Re-run migration to apply the data update**

```bash
cd backend && npx prisma migrate dev
```

- [ ] **Step 5: Regenerate Prisma client**

```bash
cd backend && npx prisma generate
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(billing): add SubscriptionStatus/PlanType enums + Company billing fields"
```

---

## Task 3: Backend Env Config

**Files:**
- Modify: `backend/src/config/env.ts`

- [ ] **Step 1: Add Stripe env vars to `env.ts`**

Add after the `SUPERADMIN_JWT_SECRET` line:

```typescript
  // Stripe Billing (required in production)
  get STRIPE_SECRET_KEY() { return process.env.STRIPE_SECRET_KEY || ""; },
  get STRIPE_WEBHOOK_SECRET() { return process.env.STRIPE_WEBHOOK_SECRET || ""; },
  get STRIPE_PRICE_PRO() { return process.env.STRIPE_PRICE_PRO || ""; },
  get STRIPE_PRICE_BUSINESS() { return process.env.STRIPE_PRICE_BUSINESS || ""; },
  // Frontend URL for Stripe redirect URLs (no trailing slash)
  get CLIENT_URL() { return process.env.CLIENT_URL || "http://localhost:8080"; },
```

- [ ] **Step 2: Add to backend `.env` (local dev — no real keys needed yet)**

Open `backend/.env` and add:

```
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
STRIPE_PRICE_PRO=price_placeholder_pro
STRIPE_PRICE_BUSINESS=price_placeholder_business
CLIENT_URL=http://localhost:8080
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/env.ts backend/.env
git commit -m "feat(billing): add Stripe env vars to env.ts"
```

---

## Task 4: Billing Schema (Zod)

**Files:**
- Create: `backend/src/schemas/billing.schema.ts`

- [ ] **Step 1: Create Zod schemas**

```typescript
// backend/src/schemas/billing.schema.ts
import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export const updateSubscriptionSchema = z.object({
  planType: z.enum(["TRIAL", "PRO", "BUSINESS"]),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED", "MANUAL"]),
  manualOverride: z.boolean(),
  currentPeriodEnd: z.string().datetime().optional().nullable(),
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/billing.schema.ts
git commit -m "feat(billing): add Zod schemas for billing endpoints"
```

---

## Task 5: subscriptionGuard Middleware (TDD)

**Files:**
- Create: `backend/src/middleware/subscriptionGuard.ts`
- Create: `backend/src/test/subscriptionGuard.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `backend/src/test/subscriptionGuard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock prisma
vi.mock("../lib/prisma.js", () => ({
  prisma: { company: { findUnique: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { subscriptionGuard } from "../middleware/subscriptionGuard.js";

function makeReq(companyId: number): Partial<Request> {
  return { companyId } as Partial<Request>;
}
function makeRes(): Partial<Response> {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as Partial<Response>;
}

const now = new Date();
const future = new Date(now.getTime() + 86400_000); // +1 day
const past = new Date(now.getTime() - 86400_000);   // -1 day

describe("subscriptionGuard", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("passes ACTIVE subscription", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "ACTIVE", planType: "PRO", trialEndsAt: null, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(); // called with no args = pass
    expect(res.status).not.toHaveBeenCalled();
  });

  it("passes MANUAL override", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "MANUAL", planType: "PRO", trialEndsAt: null, manualOverride: true,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("passes TRIAL with future trialEndsAt", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "TRIAL", planType: "TRIAL", trialEndsAt: future, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks TRIAL with past trialEndsAt → 402", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "TRIAL", planType: "TRIAL", trialEndsAt: past, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "SUBSCRIPTION_REQUIRED" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks PAST_DUE → 402", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "PAST_DUE", planType: "PRO", trialEndsAt: null, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks CANCELED → 402", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "CANCELED", planType: "PRO", trialEndsAt: null, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes when company not found (next with no args — fail open)", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);
    const req = makeReq(999);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    // fail open: let downstream handle 404
    expect(next).toHaveBeenCalledWith();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (file missing)**

```bash
cd backend && npm test -- --reporter=verbose src/test/subscriptionGuard.test.ts
```

Expected: FAIL — "Cannot find module '../middleware/subscriptionGuard.js'"

- [ ] **Step 3: Implement subscriptionGuard**

Create `backend/src/middleware/subscriptionGuard.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

export async function subscriptionGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const companyId = req.companyId;
  if (!companyId) {
    next();
    return;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionStatus: true,
      planType: true,
      trialEndsAt: true,
      manualOverride: true,
    },
  });

  if (!company) {
    next();
    return;
  }

  const { subscriptionStatus, trialEndsAt, manualOverride } = company;

  // Always pass manual overrides
  if (manualOverride || subscriptionStatus === "MANUAL") {
    next();
    return;
  }

  // Active subscription
  if (subscriptionStatus === "ACTIVE") {
    next();
    return;
  }

  // Trial — check expiry
  if (subscriptionStatus === "TRIAL") {
    if (trialEndsAt && trialEndsAt >= new Date()) {
      next();
      return;
    }
    res.status(402).json({ error: { message: "SUBSCRIPTION_REQUIRED" } });
    return;
  }

  // PAST_DUE or CANCELED
  res.status(402).json({ error: { message: "SUBSCRIPTION_REQUIRED" } });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --reporter=verbose src/test/subscriptionGuard.test.ts
```

Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/subscriptionGuard.ts backend/src/test/subscriptionGuard.test.ts
git commit -m "feat(billing): subscriptionGuard middleware with full test coverage"
```

---

## Task 6: Billing Service (TDD)

**Files:**
- Create: `backend/src/services/billing.service.ts`
- Create: `backend/src/test/billing.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/test/billing.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe
const mockCustomersCreate = vi.fn();
const mockCustomersUpdate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: mockCustomersCreate,
        update: mockCustomersUpdate,
      },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
    })),
  };
});

// Mock prisma
vi.mock("../lib/prisma.js", () => ({
  prisma: { company: { update: vi.fn() } },
}));

// Mock env
vi.mock("../config/env.js", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_PRICE_PRO: "price_pro_123",
    STRIPE_PRICE_BUSINESS: "price_biz_456",
    CLIENT_URL: "http://localhost:8080",
  },
}));

import { getOrCreateStripeCustomer, getPriceIdForPlan, mapPriceIdToPlanType } from "../services/billing.service.js";
import { prisma } from "../lib/prisma.js";

describe("billing.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateStripeCustomer", () => {
    it("returns existing customerId without calling Stripe", async () => {
      const company = { id: 1, name: "Test GmbH", stripeCustomerId: "cus_existing" } as any;
      const result = await getOrCreateStripeCustomer(company);
      expect(result).toBe("cus_existing");
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it("creates new customer and persists to DB when none exists", async () => {
      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_new123" });
      vi.mocked(prisma.company.update).mockResolvedValueOnce({} as any);

      const company = { id: 2, name: "Neue GmbH", stripeCustomerId: null } as any;
      const result = await getOrCreateStripeCustomer(company);

      expect(result).toBe("cus_new123");
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        name: "Neue GmbH",
        metadata: { companyId: "2" },
      });
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stripeCustomerId: "cus_new123" },
      });
    });
  });

  describe("getPriceIdForPlan", () => {
    it("returns PRO price ID for PRO plan", () => {
      expect(getPriceIdForPlan("PRO")).toBe("price_pro_123");
    });

    it("returns BUSINESS price ID for BUSINESS plan", () => {
      expect(getPriceIdForPlan("BUSINESS")).toBe("price_biz_456");
    });
  });

  describe("mapPriceIdToPlanType", () => {
    it("maps PRO price ID to PRO", () => {
      expect(mapPriceIdToPlanType("price_pro_123")).toBe("PRO");
    });

    it("maps BUSINESS price ID to BUSINESS", () => {
      expect(mapPriceIdToPlanType("price_biz_456")).toBe("BUSINESS");
    });

    it("returns null for unknown price ID", () => {
      expect(mapPriceIdToPlanType("price_unknown")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npm test -- --reporter=verbose src/test/billing.service.test.ts
```

Expected: FAIL — "Cannot find module '../services/billing.service.js'"

- [ ] **Step 3: Implement billing service**

Create `backend/src/services/billing.service.ts`:

```typescript
import Stripe from "stripe";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import type { PlanType } from "@prisma/client";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export function getPriceIdForPlan(plan: "PRO" | "BUSINESS"): string {
  return plan === "PRO" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BUSINESS;
}

export function mapPriceIdToPlanType(priceId: string): PlanType | null {
  if (priceId === env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  return null;
}

interface CompanyForBilling {
  id: number;
  name: string;
  stripeCustomerId: string | null;
}

export async function getOrCreateStripeCustomer(company: CompanyForBilling): Promise<string> {
  if (company.stripeCustomerId) return company.stripeCustomerId;

  const customer = await getStripe().customers.create({
    name: company.name,
    metadata: { companyId: String(company.id) },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(
  company: CompanyForBilling,
  plan: "PRO" | "BUSINESS",
): Promise<string> {
  try {
    const customerId = await getOrCreateStripeCustomer(company);
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: getPriceIdForPlan(plan), quantity: 1 }],
      success_url: `${env.CLIENT_URL}/settings?tab=abo&success=1`,
      cancel_url: `${env.CLIENT_URL}/settings?tab=abo`,
    });
    if (!session.url) throw new AppError(500, "Stripe session URL fehlt");
    return session.url;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, "Stripe checkout session error");
    throw new AppError(502, "Stripe Checkout nicht verfügbar");
  }
}

export async function createPortalSession(company: CompanyForBilling): Promise<string> {
  try {
    const customerId = await getOrCreateStripeCustomer(company);
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.CLIENT_URL}/settings?tab=abo`,
    });
    return session.url;
  } catch (err) {
    logger.error({ err }, "Stripe portal session error");
    throw new AppError(502, "Stripe Portal nicht verfügbar");
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --reporter=verbose src/test/billing.service.test.ts
```

Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/billing.service.ts backend/src/test/billing.service.test.ts
git commit -m "feat(billing): billing service with Stripe SDK wrapper + tests"
```

---

## Task 7: Billing Controller + Routes

**Files:**
- Create: `backend/src/controllers/billing.controller.ts`
- Create: `backend/src/routes/billing.routes.ts`

- [ ] **Step 1: Create billing controller**

Create `backend/src/controllers/billing.controller.ts`:

```typescript
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { checkoutSchema } from "../schemas/billing.schema.js";
import { createCheckoutSession, createPortalSession } from "../services/billing.service.js";

export async function getBillingStatus(req: Request, res: Response): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    select: {
      subscriptionStatus: true,
      planType: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      manualOverride: true,
    },
  });
  if (!company) throw new AppError(404, "Firma nicht gefunden");
  res.json({ data: company });
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  const { plan } = checkoutSchema.parse(req.body);

  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  const url = await createCheckoutSession(company, plan);
  res.json({ data: { url } });
}

export async function createPortal(req: Request, res: Response): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  const url = await createPortalSession(company);
  res.json({ data: { url } });
}
```

- [ ] **Step 2: Create billing routes**

Create `backend/src/routes/billing.routes.ts`:

```typescript
import { Router } from "express";
import * as ctrl from "../controllers/billing.controller.js";

const router = Router();

router.get("/status", ctrl.getBillingStatus);
router.post("/checkout", ctrl.createCheckout);
router.post("/portal", ctrl.createPortal);

export { router as billingRouter };
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/billing.controller.ts backend/src/routes/billing.routes.ts
git commit -m "feat(billing): billing controller and routes (status/checkout/portal)"
```

---

## Task 8: Stripe Webhook Handler (TDD)

**Files:**
- Create: `backend/src/routes/stripe-webhook.routes.ts`
- Create: `backend/src/test/stripe-webhook.test.ts`

- [ ] **Step 1: Write failing test for manualOverride guard**

Create `backend/src/test/stripe-webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mock Stripe
const mockConstructEvent = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}));

// Mock prisma
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    company: { findFirst: mockFindFirst, update: mockUpdate },
  },
}));

// Mock env
vi.mock("../config/env.js", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_WEBHOOK_SECRET: "whsec_mock",
    STRIPE_PRICE_PRO: "price_pro_123",
    STRIPE_PRICE_BUSINESS: "price_biz_456",
    CLIENT_URL: "http://localhost:8080",
  },
}));

import { stripeWebhookHandler } from "../routes/stripe-webhook.routes.js";

function makeReq(body: Buffer, sig: string): Partial<Request> {
  return {
    body,
    headers: { "stripe-signature": sig },
  } as Partial<Request>;
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; sendStatus: ReturnType<typeof vi.fn> } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
  return res;
}

describe("stripeWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips DB update when manualOverride = true on subscription.updated", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_end: 1700000000,
          items: { data: [{ price: { id: "price_pro_123" } }] },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    mockFindFirst.mockResolvedValueOnce({ id: 1, manualOverride: true });

    const req = makeReq(Buffer.from("{}"), "sig_test");
    const res = makeRes();
    await stripeWebhookHandler(req as Request, res as Response);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("updates DB on subscription.updated when manualOverride = false", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_456",
          customer: "cus_456",
          status: "active",
          current_period_end: 1700000000,
          items: { data: [{ price: { id: "price_pro_123" } }] },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    mockFindFirst.mockResolvedValueOnce({ id: 2, manualOverride: false });
    mockUpdate.mockResolvedValueOnce({});

    const req = makeReq(Buffer.from("{}"), "sig_test");
    const res = makeRes();
    await stripeWebhookHandler(req as Request, res as Response);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({
          subscriptionStatus: "ACTIVE",
          planType: "PRO",
          stripeSubscriptionId: "sub_456",
        }),
      }),
    );
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("returns 400 on invalid webhook signature", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found");
    });

    const req = makeReq(Buffer.from("{}"), "bad_sig");
    const res = makeRes();
    await stripeWebhookHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid signature" });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npm test -- --reporter=verbose src/test/stripe-webhook.test.ts
```

- [ ] **Step 3: Implement webhook handler**

Create `backend/src/routes/stripe-webhook.routes.ts`:

```typescript
import type { Request, Response } from "express";
import Stripe from "stripe";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { mapPriceIdToPlanType } from "../services/billing.service.js";
import type { SubscriptionStatus, PlanType } from "@prisma/client";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  return _stripe;
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    default:
      return "CANCELED";
  }
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature mismatch");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, manualOverride: true, planType: true },
    });

    if (!company) {
      logger.warn({ customerId }, "Stripe webhook: company not found for customer");
      res.sendStatus(200);
      return;
    }

    if (company.manualOverride) {
      res.sendStatus(200);
      return;
    }

    const newStatus = mapStripeStatus(sub.status);
    const priceId = sub.items.data[0]?.price?.id;
    const mappedPlan = priceId ? mapPriceIdToPlanType(priceId) : null;

    if (priceId && !mappedPlan) {
      logger.warn({ priceId }, "Stripe webhook: unknown price ID — keeping existing planType");
    }

    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: newStatus,
        planType: (mappedPlan ?? company.planType) as PlanType,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, manualOverride: true },
    });

    if (!company || company.manualOverride) {
      res.sendStatus(200);
      return;
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { subscriptionStatus: "CANCELED" },
    });
  }

  res.sendStatus(200);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --reporter=verbose src/test/stripe-webhook.test.ts
```

Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/stripe-webhook.routes.ts backend/src/test/stripe-webhook.test.ts
git commit -m "feat(billing): Stripe webhook handler with manualOverride guard + tests"
```

---

## Task 9: Register Webhook in app.ts + Register Routes in index.ts

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Register webhook BEFORE express.json() in app.ts**

In `backend/src/app.ts`, add after the imports section and BEFORE the `app.use(cors(...))` / `app.use(express.json(...))` lines:

```typescript
// Stripe webhook — MUST be before express.json() (needs raw Buffer body)
import { stripeWebhookHandler } from "./routes/stripe-webhook.routes.js";
```

Then add this line right before `app.use(cors(corsOptions))`:

```typescript
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);
```

The `app.ts` middleware section should look like:

```typescript
// Stripe webhook — raw body BEFORE json middleware
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
```

- [ ] **Step 2: Register billingRouter and apply subscriptionGuard in routes/index.ts**

In `backend/src/routes/index.ts`, add imports at the top:

```typescript
import { billingRouter } from "./billing.routes.js";
import { subscriptionGuard } from "../middleware/subscriptionGuard.js";
```

Add billing route (no subscriptionGuard) after the `superadmin` route:

```typescript
// Billing routes — no subscriptionGuard (users must be able to access billing even when locked)
router.use("/billing", requireAuth, tenantGuard, billingRouter);
```

Apply subscriptionGuard to ALL existing tenant routes. Replace all lines of the form:
```typescript
router.use("/path", requireAuth, tenantGuard, someRouter);
```
with:
```typescript
router.use("/path", requireAuth, tenantGuard, subscriptionGuard, someRouter);
```

This affects: properties, units, tenants, contracts, maintenance, documents, finance (both), dashboard, company, bank-accounts, users, calendar, email-accounts, email-messages, meters, recurring-transactions, dunning, handover-protocols, maintenance-schedules, document-templates, banking, finance/datev, reports, import, administration, insurance, maintenance-budgets, audit-logs.

> Exception: the Nordigen callback (`router.get("/banking/callback", ...)`) is already public — leave it as is.

- [ ] **Step 3: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/routes/index.ts
git commit -m "feat(billing): register webhook + billingRouter + apply subscriptionGuard to all tenant routes"
```

---

## Task 10: Update Superadmin Controller

**Files:**
- Modify: `backend/src/controllers/superadmin.controller.ts`
- Modify: `backend/src/routes/superadmin.routes.ts`

- [ ] **Step 1: Update createCompany to set trial fields**

In `superadmin.controller.ts`, update the `$transaction` in `createCompany`. Replace:

```typescript
    const c = await tx.company.create({
      data: { name: companyName, slug, address: "", taxNumber: "" },
    });
```

with:

```typescript
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const c = await tx.company.create({
      data: {
        name: companyName,
        slug,
        address: "",
        taxNumber: "",
        subscriptionStatus: "TRIAL",
        planType: "TRIAL",
        trialEndsAt,
      },
    });
```

- [ ] **Step 2: Update deleteCompany to cancel Stripe resources**

In `deleteCompany`, add Stripe cleanup BEFORE the `prisma.$transaction(...)`. Add at the top of the function, after the `findUnique` check:

```typescript
  // Cancel Stripe subscription and customer before deleting DB record
  if (env.STRIPE_SECRET_KEY) {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
    if ((company as any).stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel((company as any).stripeSubscriptionId as string);
      } catch (err: any) {
        if (err?.statusCode !== 404) logger.warn({ err }, "Stripe subscription cancel warning");
      }
    }
    if ((company as any).stripeCustomerId) {
      try {
        await stripe.customers.del((company as any).stripeCustomerId as string);
      } catch (err: any) {
        if (err?.statusCode !== 404) logger.warn({ err }, "Stripe customer delete warning");
      }
    }
  }
```

Also update the `findUnique` call to select billing fields:

```typescript
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  });
```

Add the `logger` import at the top of the file:

```typescript
import { logger } from "../lib/logger.js";
```

- [ ] **Step 3: Add updateSubscription handler**

Add this new function at the end of `superadmin.controller.ts`:

```typescript
export async function updateSubscription(req: Request, res: Response): Promise<void> {
  const companyId = Number(req.params.id);
  const { planType, subscriptionStatus, manualOverride, currentPeriodEnd } = req.body as {
    planType: string;
    subscriptionStatus: string;
    manualOverride: boolean;
    currentPeriodEnd?: string | null;
  };

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  await prisma.company.update({
    where: { id: companyId },
    data: {
      planType: planType as any,
      subscriptionStatus: subscriptionStatus as any,
      manualOverride,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
    },
  });

  res.json({ data: { updated: true } });
}
```

- [ ] **Step 4: Register new route in superadmin.routes.ts**

Add after `deleteCompany` line:

```typescript
router.patch("/companies/:id/subscription", requireSuperAdmin, ctrl.updateSubscription);
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 6: Run all tests**

```bash
cd backend && npm test
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/superadmin.controller.ts backend/src/routes/superadmin.routes.ts
git commit -m "feat(billing): createCompany sets trial, deleteCompany cancels Stripe, updateSubscription endpoint"
```

---

## Task 11: Frontend — useBilling Hooks

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useBilling.ts`

- [ ] **Step 1: Create billing hooks**

Create `cozy-estate-central/src/hooks/api/useBilling.ts`:

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "MANUAL";
export type PlanType = "TRIAL" | "PRO" | "BUSINESS";

export interface BillingStatus {
  subscriptionStatus: SubscriptionStatus;
  planType: PlanType;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  manualOverride: boolean;
}

export function useBillingStatus(options?: { refetchInterval?: number | false }) {
  return useQuery<{ data: BillingStatus }>({
    queryKey: ["billing", "status"],
    queryFn: () => api("/billing/status"),
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (plan: "PRO" | "BUSINESS") =>
      api<{ data: { url: string } }>("/billing/checkout", {
        method: "POST",
        body: { plan },
      }),
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () =>
      api<{ data: { url: string } }>("/billing/portal", { method: "POST" }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useBilling.ts
git commit -m "feat(billing): useBilling React Query hooks"
```

---

## Task 12: Frontend — api.ts 402 Intercept

**Files:**
- Modify: `cozy-estate-central/src/lib/api.ts`

- [ ] **Step 1: Add 402 intercept after the 401 handling block**

In `api.ts`, in the `api<T>` function, find the block after the token refresh logic. After the line `isRefreshing = false; refreshPromise = null;` closing block (around the `if (res.status === 204)` check), add a 402 intercept BEFORE the `if (res.status === 204)` check:

```typescript
  // 402 — subscription required (redirect to lock screen, skip for billing/auth paths)
  if (res.status === 402) {
    const isBillingPath = path.startsWith("/billing") || path.startsWith("/auth");
    if (!isBillingPath) {
      window.location.replace("/billing-locked");
    }
    const json402 = await res.json();
    throw new ApiError(402, json402.error?.message || "Abonnement erforderlich");
  }
```

- [ ] **Step 2: Commit**

```bash
git add cozy-estate-central/src/lib/api.ts
git commit -m "feat(billing): 402 intercept in api.ts → redirect to /billing-locked"
```

---

## Task 13: Frontend — AuthContext Billing State

**Files:**
- Modify: `cozy-estate-central/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Extend AuthContext with billing state**

Replace the entire `AuthContext.tsx` with the updated version that fetches billing status in parallel:

```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, setToken, clearToken, ApiError } from "@/lib/api";
import type { CustomRole } from "@/lib/permissions";
import type { BillingStatus } from "@/hooks/api/useBilling";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number;
  customRole?: CustomRole | null;
}

interface AuthContextType {
  user: User | null;
  billing: BillingStatus | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchBilling: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBilling = useCallback(async (): Promise<BillingStatus | null> => {
    try {
      const res = await api<{ data: BillingStatus }>("/billing/status");
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // Fetch user + billing in parallel on mount
  useEffect(() => {
    Promise.all([
      api<{ data: User }>("/auth/me").catch(() => null),
      fetchBilling(),
    ]).then(([userRes, billingRes]) => {
      if (userRes) {
        setUser(userRes.data);
        setBilling(billingRes);
      } else {
        clearToken();
        setUser(null);
        setBilling(null);
      }
    }).finally(() => setIsLoading(false));
  }, [fetchBilling]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ data: { user: User; accessToken: string } }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.data.accessToken);
    setUser(res.data.user);
    const billingRes = await fetchBilling();
    setBilling(billingRes);
  }, [fetchBilling]);

  const register = useCallback(async (name: string, email: string, password: string, companyName: string) => {
    const res = await api<{ data: { user: User; accessToken: string } }>("/auth/register", {
      method: "POST",
      body: { name, email, password, companyName },
    });
    setToken(res.data.accessToken);
    setUser(res.data.user);
    const billingRes = await fetchBilling();
    setBilling(billingRes);
  }, [fetchBilling]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearToken();
    setUser(null);
    setBilling(null);
  }, []);

  const refetchBilling = useCallback(async () => {
    const billingRes = await fetchBilling();
    setBilling(billingRes);
  }, [fetchBilling]);

  return (
    <AuthContext.Provider value={{
      user,
      billing,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refetchBilling,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add cozy-estate-central/src/contexts/AuthContext.tsx
git commit -m "feat(billing): extend AuthContext with billing state (parallel fetch)"
```

---

## Task 14: Frontend — BillingLocked Page

**Files:**
- Create: `cozy-estate-central/src/pages/BillingLocked.tsx`

- [ ] **Step 1: Create the lock screen page**

Create `cozy-estate-central/src/pages/BillingLocked.tsx`:

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, clearToken } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Building2, CheckCircle2 } from "lucide-react";

const PLANS = [
  {
    key: "PRO" as const,
    name: "Pro",
    price: "49 €",
    features: [
      "Bis zu 50 Einheiten",
      "Alle Grundfunktionen",
      "E-Mail Support",
      "Mieter-Portal",
    ],
  },
  {
    key: "BUSINESS" as const,
    name: "Business",
    price: "99 €",
    features: [
      "Unbegrenzte Einheiten",
      "Alle Pro-Funktionen",
      "Priorität-Support",
      "DATEV Export",
      "API-Zugang",
    ],
  },
];

function getReason(): string {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");
  if (reason === "past_due") return "Zahlung fehlgeschlagen";
  if (reason === "canceled") return "Abo gekündigt";
  return "Trial abgelaufen";
}

export default function BillingLocked() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const reason = getReason();

  async function handleUpgrade(plan: "PRO" | "BUSINESS") {
    setLoading(plan);
    try {
      const res = await api<{ data: { url: string } }>("/billing/checkout", {
        method: "POST",
        body: { plan },
      });
      window.location.href = res.data.url;
    } catch {
      setLoading(null);
    }
  }

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-100 p-4">
              <AlertCircle className="h-10 w-10 text-amber-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Zugang gesperrt</h1>
          <p className="text-gray-500 text-lg">{reason} — Bitte wählen Sie einen Plan, um fortzufahren.</p>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">ImmoVerwalt</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {PLANS.map((plan) => (
            <Card key={plan.key} className={plan.key === "BUSINESS" ? "border-blue-500 border-2" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.key === "BUSINESS" && (
                    <Badge className="bg-blue-600 text-white">Empfohlen</Badge>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {plan.price}<span className="text-base font-normal text-gray-500">/Monat</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.key === "BUSINESS" ? "default" : "outline"}
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={!!loading}
                >
                  {loading === plan.key ? "Wird geladen..." : `${plan.name} abonnieren`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Logout */}
        <div className="text-center">
          <Button variant="ghost" className="text-gray-400" onClick={handleLogout}>
            Abmelden
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add cozy-estate-central/src/pages/BillingLocked.tsx
git commit -m "feat(billing): BillingLocked page with plan upgrade cards"
```

---

## Task 15: Frontend — App.tsx Routing

**Files:**
- Modify: `cozy-estate-central/src/App.tsx`

- [ ] **Step 1: Add BillingLocked import and route**

In `App.tsx`, add import:

```typescript
import BillingLocked from "./pages/BillingLocked";
```

In the `App` component's `<Routes>`, add `/billing-locked` as a public route BEFORE the `ProtectedRoute` catch-all:

```tsx
<Route path="/billing-locked" element={<BillingLocked />} />
```

- [ ] **Step 2: Commit**

```bash
git add cozy-estate-central/src/App.tsx
git commit -m "feat(billing): add /billing-locked as public route in App.tsx"
```

---

## Task 16: Frontend — Settings Abonnement Tab

**Files:**
- Modify: `cozy-estate-central/src/pages/Settings.tsx`

- [ ] **Step 1: Read the current Settings.tsx to understand existing tab structure**

Check which tabs exist and how they are implemented (look for `TabsList`, `TabsTrigger`, `TabsContent`).

- [ ] **Step 2: Add Abonnement tab**

Add the "Abonnement" tab to the `TabsList`:

```tsx
<TabsTrigger value="abo">Abonnement</TabsTrigger>
```

Add a `TabsContent` for `value="abo"`. The full content block:

```tsx
<TabsContent value="abo">
  <AbonnementTab />
</TabsContent>
```

Add the `AbonnementTab` component above the main `Settings` export (or in the same file):

```tsx
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useBillingStatus, useCreateCheckout, useCreatePortalSession } from "@/hooks/api/useBilling";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";

function AbonnementTab() {
  const location = useLocation();
  const hasSuccessParam = new URLSearchParams(location.search).get("success") === "1";
  const [isPolling, setIsPolling] = useState(hasSuccessParam);

  // Stop polling after 10 seconds
  useEffect(() => {
    if (!isPolling) return;
    const timer = setTimeout(() => setIsPolling(false), 10_000);
    return () => clearTimeout(timer);
  }, [isPolling]);

  const { data, isLoading } = useBillingStatus({ refetchInterval: isPolling ? 2000 : false });
  const checkout = useCreateCheckout();
  const portal = useCreatePortalSession();

  // Stop polling when ACTIVE received
  useEffect(() => {
    if (data?.data.subscriptionStatus === "ACTIVE") setIsPolling(false);
  }, [data]);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Wird geladen…</div>;

  const billing = data?.data;
  if (!billing) return null;

  const { subscriptionStatus, planType, trialEndsAt, currentPeriodEnd, manualOverride } = billing;

  function statusBadge() {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      TRIAL:    { label: "Trial",      variant: "secondary" },
      ACTIVE:   { label: "Aktiv",      variant: "default" },
      PAST_DUE: { label: "Überfällig", variant: "destructive" },
      CANCELED: { label: "Gekündigt",  variant: "destructive" },
      MANUAL:   { label: "Testzugang", variant: "outline" },
    };
    const s = map[subscriptionStatus] ?? { label: subscriptionStatus, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  async function handleCheckout(plan: "PRO" | "BUSINESS") {
    const res = await checkout.mutateAsync(plan);
    window.location.href = res.data.url;
  }

  async function handlePortal() {
    const res = await portal.mutateAsync();
    window.location.href = res.data.url;
  }

  const planLabel = planType === "PRO" ? "Pro (49 €/Monat)" : planType === "BUSINESS" ? "Business (99 €/Monat)" : "Trial";

  return (
    <div className="space-y-6 max-w-xl">
      {hasSuccessParam && isPolling && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Zahlung bestätigt — Abo wird aktiviert…</AlertDescription>
        </Alert>
      )}

      {/* Current status */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Aktueller Plan</h3>
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium">{planLabel}</span>
          {statusBadge()}
        </div>
      </div>

      {/* Status-specific content */}
      {subscriptionStatus === "TRIAL" && trialEndsAt && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {differenceInDays(parseISO(trialEndsAt), new Date())} Tage verbleibend
            (bis {format(parseISO(trialEndsAt), "dd.MM.yyyy", { locale: de })})
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleCheckout("PRO")} disabled={checkout.isPending}>Pro abonnieren — 49 €/Monat</Button>
            <Button variant="outline" onClick={() => handleCheckout("BUSINESS")} disabled={checkout.isPending}>Business — 99 €/Monat</Button>
          </div>
        </div>
      )}

      {subscriptionStatus === "ACTIVE" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nächste Zahlung: {currentPeriodEnd ? format(parseISO(currentPeriodEnd), "dd.MM.yyyy", { locale: de }) : "—"}
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={handlePortal} disabled={portal.isPending}>Abo verwalten</Button>
            <Button variant="ghost" onClick={() => handleCheckout("BUSINESS")} disabled={checkout.isPending}>Plan wechseln</Button>
          </div>
        </div>
      )}

      {subscriptionStatus === "PAST_DUE" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Ihre letzte Zahlung ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsdaten.</AlertDescription>
          </Alert>
          <Button onClick={handlePortal} disabled={portal.isPending}>Jetzt bezahlen</Button>
        </div>
      )}

      {subscriptionStatus === "CANCELED" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Ihr Abonnement wurde gekündigt.</p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleCheckout("PRO")} disabled={checkout.isPending}>Pro abonnieren — 49 €/Monat</Button>
            <Button variant="outline" onClick={() => handleCheckout("BUSINESS")} disabled={checkout.isPending}>Business — 99 €/Monat</Button>
          </div>
        </div>
      )}

      {subscriptionStatus === "MANUAL" && (
        <p className="text-sm text-muted-foreground">
          Testzugang (durch Administrator vergeben).
          {currentPeriodEnd ? ` Gültig bis: ${format(parseISO(currentPeriodEnd), "dd.MM.yyyy", { locale: de })}` : ""}
        </p>
      )}
    </div>
  );
}
```

> Note: Check if `date-fns` is already a dependency in `cozy-estate-central/package.json`. If not, install it: `cd cozy-estate-central && npm install date-fns`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd cozy-estate-central && npm run build 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/pages/Settings.tsx
git commit -m "feat(billing): Settings Abonnement tab with polling, upgrade/portal buttons"
```

---

## Task 17: Frontend — SuperAdmin Subscription Management

**Files:**
- Modify: `cozy-estate-central/src/hooks/api/useSuperAdmin.ts`
- Modify: `cozy-estate-central/src/pages/SuperAdmin.tsx`

- [ ] **Step 1: Add billing fields to SuperAdminCompany type + useUpdateSubscription mutation**

In `useSuperAdmin.ts`, extend `SuperAdminCompany`:

```typescript
export interface SuperAdminCompany {
  id: number;
  name: string;
  createdAt: string;
  subscriptionStatus: string;
  planType: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  manualOverride: boolean;
  _count: { users: number; properties: number; tenants: number; contracts: number };
}
```

Add at the end of the file:

```typescript
export function useUpdateSubscription(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      planType,
      subscriptionStatus,
      manualOverride,
      currentPeriodEnd,
    }: {
      companyId: number;
      planType: string;
      subscriptionStatus: string;
      manualOverride: boolean;
      currentPeriodEnd?: string | null;
    }) =>
      superadminFetch(`/companies/${companyId}/subscription`, token, {
        method: "PATCH",
        body: JSON.stringify({ planType, subscriptionStatus, manualOverride, currentPeriodEnd }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "companies"] }),
  });
}
```

- [ ] **Step 2: Read SuperAdmin.tsx to understand current company table structure**

Look at how the company rows are rendered and how existing dialogs (reset-password, delete) work.

- [ ] **Step 3: Add "Abo" badge column to company table**

In the table header, add:
```tsx
<TableHead>Abo</TableHead>
```

In the table row body, add after the existing columns:
```tsx
<TableCell>
  <AboBadge status={company.subscriptionStatus} />
</TableCell>
```

Add the `AboBadge` helper component near the top of the file:

```tsx
function AboBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    TRIAL:    { label: "Trial",      className: "bg-gray-100 text-gray-700" },
    ACTIVE:   { label: "Aktiv",      className: "bg-green-100 text-green-700" },
    PAST_DUE: { label: "Überfällig", className: "bg-yellow-100 text-yellow-700" },
    CANCELED: { label: "Gekündigt",  className: "bg-red-100 text-red-700" },
    MANUAL:   { label: "Manuell",    className: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
```

- [ ] **Step 4: Add "Abo setzen" dialog**

Add state for the dialog (alongside existing dialog states):

```tsx
const [aboDialog, setAboDialog] = useState<SuperAdminCompany | null>(null);
const [aboPlanType, setAboPlanType] = useState("TRIAL");
const [aboStatus, setAboStatus] = useState("TRIAL");
const [aboManualOverride, setAboManualOverride] = useState(false);
const [aboUntil, setAboUntil] = useState("");

const updateSubscription = useUpdateSubscription(token);
```

Import `useUpdateSubscription` at the top.

When opening the dialog, populate state from the company:
```tsx
function openAboDialog(company: SuperAdminCompany) {
  setAboDialog(company);
  setAboPlanType(company.planType ?? "TRIAL");
  setAboStatus(company.subscriptionStatus ?? "TRIAL");
  setAboManualOverride(company.manualOverride ?? false);
  setAboUntil(company.currentPeriodEnd ? company.currentPeriodEnd.slice(0, 10) : "");
}
```

Add "Abo setzen" button in each company row's actions (next to existing action buttons):
```tsx
<Button size="sm" variant="outline" onClick={() => openAboDialog(company)}>Abo</Button>
```

Add the dialog (next to existing dialogs):
```tsx
<Dialog open={!!aboDialog} onOpenChange={(o) => !o && setAboDialog(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Abo setzen — {aboDialog?.name}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <label className="text-sm font-medium">Plan</label>
        <select className="w-full border rounded px-3 py-2 text-sm" value={aboPlanType} onChange={e => setAboPlanType(e.target.value)}>
          <option value="TRIAL">Trial</option>
          <option value="PRO">Pro</option>
          <option value="BUSINESS">Business</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Status</label>
        <select className="w-full border rounded px-3 py-2 text-sm" value={aboStatus} onChange={e => setAboStatus(e.target.value)}>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELED">Canceled</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="manualOverride" checked={aboManualOverride} onChange={e => setAboManualOverride(e.target.checked)} />
        <label htmlFor="manualOverride" className="text-sm">Manueller Override (Stripe-Webhooks ignorieren)</label>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Abo bis (optional)</label>
        <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={aboUntil} onChange={e => setAboUntil(e.target.value)} />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setAboDialog(null)}>Abbrechen</Button>
      <Button
        disabled={updateSubscription.isPending}
        onClick={async () => {
          if (!aboDialog) return;
          await updateSubscription.mutateAsync({
            companyId: aboDialog.id,
            planType: aboPlanType,
            subscriptionStatus: aboStatus,
            manualOverride: aboManualOverride,
            currentPeriodEnd: aboUntil ? new Date(aboUntil).toISOString() : null,
          });
          setAboDialog(null);
        }}
      >
        Speichern
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd cozy-estate-central && npm run build 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useSuperAdmin.ts cozy-estate-central/src/pages/SuperAdmin.tsx
git commit -m "feat(billing): SuperAdmin Abo badge column + Abo setzen dialog"
```

---

## Task 18: Integration Smoke Test

- [ ] **Step 1: Start backend and verify TypeScript is clean**

```bash
cd backend && npx tsc --noEmit && npm test
```

Expected: no TypeScript errors, all tests passing

- [ ] **Step 2: Start dev stack**

```bash
cd backend && npm run dev
# In second terminal:
cd cozy-estate-central && npm run dev
```

- [ ] **Step 3: Manual smoke tests**

1. Login as `admin@immoverwalt.de` / `Admin123!`
2. Navigate to Settings → Abonnement tab — verify current status shown
3. Navigate to Superadmin → verify "Abo" badge column visible
4. In Superadmin, click "Abo" on a company → set Status=TRIAL, trialEndsAt=yesterday → Save
5. Log back in as that company's admin — you should be redirected to `/billing-locked`
6. Reset the company back to MANUAL/manualOverride=true via Superadmin → confirm access is restored
7. In Superadmin, create a new company → confirm it appears with TRIAL status badge

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(billing): Stripe Billing Integration complete"
```

---

## Environment Setup (Production)

After all code is deployed, configure real Stripe keys on the server:

1. Create Stripe products ("ImmoVerwalt Pro", "ImmoVerwalt Business") with monthly prices
2. Add to `/root/immoverwaltung/.env` **and** `docker-compose.yml` under `environment:`:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
CLIENT_URL=https://hasverl.xyz
```

3. Register webhook in Stripe Dashboard: `https://hasverl.xyz/api/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Deploy: `git stash && git pull origin master && docker compose up -d --build`
