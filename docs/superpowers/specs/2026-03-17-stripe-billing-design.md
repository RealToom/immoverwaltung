# Stripe Billing Integration — Design Spec

## Goal

Integrate Stripe Billing into the Superadmin-managed SaaS platform so that Hausverwaltungsfirmen can self-service subscribe to a paid plan via Stripe Checkout, while the Superadmin retains the ability to manually override subscription status for demo/test access.

## Plans

| Plan | Price | Notes |
|------|-------|-------|
| Trial | Free, 14 days | Automatically assigned to all new companies |
| Pro | €49/month | Small property management firms |
| Business | €99/month | Larger firms |

## Architecture

### Database — Company Model Extensions

New fields added to `Company` in Prisma schema:

| Field | Type | Notes |
|-------|------|-------|
| `stripeCustomerId` | `String?` | Stripe Customer ID; null until first checkout |
| `stripeSubscriptionId` | `String?` | Active Stripe Subscription ID |
| `subscriptionStatus` | `SubscriptionStatus` | Enum (no DB default — set explicitly in application code) |
| `planType` | `PlanType` | Enum (no DB default — set explicitly in application code) |
| `trialEndsAt` | `DateTime?` | Set to `now() + 14 days` in `createCompany` code; no `@default()` |
| `currentPeriodEnd` | `DateTime?` | End of current billing period; null for manual accounts |
| `manualOverride` | `Boolean` | Uses `@default(false)` — a Prisma schema default is appropriate here since it is always false at creation and the field is non-nullable |

New Prisma enums:
```prisma
enum SubscriptionStatus { TRIAL ACTIVE PAST_DUE CANCELED MANUAL }
enum PlanType           { TRIAL PRO BUSINESS }
```

DB column maps (via `@map`): `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan_type`, `trial_ends_at`, `current_period_end`, `manual_override`.

**Migration note for existing data:** The migration must set existing companies to `subscriptionStatus = MANUAL`, `planType = PRO`, `manualOverride = true` so they retain full access without interruption. Do not set `trialEndsAt` for existing companies.

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `src/schemas/billing.schema.ts` | Zod schemas for billing endpoints |
| `src/services/billing.service.ts` | Stripe SDK: get-or-create customer, checkout session, portal session, price→plan mapping |
| `src/controllers/billing.controller.ts` | Route handlers for status, checkout, portal |
| `src/routes/billing.routes.ts` | Protected billing routes (requireAuth + tenantGuard, **no** subscriptionGuard) |
| `src/routes/stripe-webhook.routes.ts` | Webhook handler function (raw body — see registration below) |
| `src/middleware/subscriptionGuard.ts` | 402 guard middleware |

### Backend — Modified Files

| File | Change |
|------|--------|
| `src/app.ts` | Register Stripe webhook route **before** `express.json()` (see Webhook Raw Body section) |
| `src/routes/index.ts` | Register billing routes (no subscriptionGuard); apply subscriptionGuard to all tenantGuard routes |
| `src/config/env.ts` | Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`; reuse `CLIENT_URL` if already present |
| `src/controllers/superadmin.controller.ts` | `createCompany` sets `trialEndsAt`, `subscriptionStatus`, `planType`; new `updateSubscription` handler; `deleteCompany` cancels Stripe subscription/customer |
| `src/routes/superadmin.routes.ts` | Add `PATCH /companies/:id/subscription` |

### subscriptionGuard Middleware

Applied as a named middleware in `routes/index.ts` on all tenant routes, **after** `tenantGuard`. Billing routes and webhook route are registered without it.

The guard does one lightweight Prisma lookup selecting only required fields:

```typescript
prisma.company.findUnique({
  where: { id: req.companyId },
  select: { subscriptionStatus: true, planType: true, trialEndsAt: true, manualOverride: true },
})
```

Logic:

```
TRIAL  + trialEndsAt < now()  → 402 { error: "SUBSCRIPTION_REQUIRED" }
PAST_DUE                       → 402 { error: "SUBSCRIPTION_REQUIRED" }
CANCELED                       → 402 { error: "SUBSCRIPTION_REQUIRED" }
ACTIVE                         → pass
MANUAL                         → pass
TRIAL  + trialEndsAt >= now()  → pass
```

### Webhook Raw Body Handling

The webhook route **must be registered in `src/app.ts` directly, before `express.json()` is applied**. It cannot be registered inside `routes/index.ts` (which is mounted after the JSON middleware).

```typescript
// In app.ts — BEFORE app.use(express.json(...))
import { stripeWebhookHandler } from "./routes/stripe-webhook.routes.js";
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);
```

This ensures `req.body` is a `Buffer` for `stripe.webhooks.constructEvent()`.

### Webhook Events Handled

- `customer.subscription.created` / `updated`:
  - If `manualOverride = true`: skip all updates
  - Map Stripe `subscription.status` string → `SubscriptionStatus` enum:
    - `"active"` / `"trialing"` → `ACTIVE`
    - `"past_due"` → `PAST_DUE`
    - `"canceled"` / `"unpaid"` → `CANCELED`
  - Map `subscription.items.data[0].price.id` → `PlanType`:
    - `=== STRIPE_PRICE_PRO` → `PRO`
    - `=== STRIPE_PRICE_BUSINESS` → `BUSINESS`
    - Unrecognized: log warning, keep existing `planType`, still update `subscriptionStatus`
  - Update `subscriptionStatus`, `planType`, `currentPeriodEnd`, `stripeSubscriptionId`

- `customer.subscription.deleted`:
  - If `manualOverride = true`: skip
  - Set `subscriptionStatus = CANCELED`

Do **not** handle `invoice.payment_failed` — `customer.subscription.updated` with `status: "past_due"` is the authoritative source and avoids double-processing.

### Stripe Customer — Get-or-Create Pattern

`billing.service.ts` exposes `getOrCreateStripeCustomer(company)`:
1. If `company.stripeCustomerId` is set: return it
2. Else: `stripe.customers.create({ name: company.name, metadata: { companyId: String(company.id) } })`
3. Persist `stripeCustomerId` to DB immediately
4. Return the customer ID

All checkout/portal calls go through this function first.

### Stripe Cleanup on Company Deletion

`deleteCompany` in `superadmin.controller.ts` must call Stripe before deleting the DB record:
1. If `company.stripeSubscriptionId` is set: `stripe.subscriptions.cancel(company.stripeSubscriptionId)` (ignore 404)
2. If `company.stripeCustomerId` is set: `stripe.customers.del(company.stripeCustomerId)` (ignore 404)
3. Then proceed with the existing DB deletion transaction

### Backend — API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/billing/status` | requireAuth + tenantGuard | Returns `{ subscriptionStatus, planType, trialEndsAt, currentPeriodEnd }` |
| `POST` | `/api/billing/checkout` | requireAuth + tenantGuard | Body: `{ plan: "PRO" \| "BUSINESS" }` → `{ url }` |
| `POST` | `/api/billing/portal` | requireAuth + tenantGuard | Returns `{ url }` |
| `POST` | `/api/webhooks/stripe` | public (Stripe signature) | Registered in `app.ts` before JSON middleware |
| `PATCH` | `/api/superadmin/companies/:id/subscription` | requireSuperAdmin | Body: `{ planType, subscriptionStatus, manualOverride, currentPeriodEnd? }` |

### Stripe Configuration

- Two Products in Stripe Dashboard: "ImmoVerwalt Pro" and "ImmoVerwalt Business"
- Monthly recurring prices
- Price IDs in env: `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`
- Checkout success URL: `{CLIENT_URL}/settings?tab=abo&success=1`
- Checkout cancel URL: `{CLIENT_URL}/settings?tab=abo`
- Portal return URL: `{CLIENT_URL}/settings?tab=abo`

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `src/pages/BillingLocked.tsx` | Full-page lock screen (public route, outside ProtectedRoute entirely) |
| `src/hooks/api/useBilling.ts` | React Query hooks: `useBillingStatus`, `useCreateCheckout`, `useCreatePortalSession` |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Fetch `/auth/me` and `/billing/status` in parallel; keep `isLoading = true` until **both** resolve; store `subscriptionStatus`, `planType`, `trialEndsAt`, `currentPeriodEnd` in auth state |
| `src/App.tsx` | Add `/billing-locked` as public route outside `ProtectedRoute`; inside `AppLayout`, if subscription is locked redirect to `/billing-locked` |
| `src/lib/api.ts` | 402 intercept → `window.location.replace("/billing-locked")` — only for paths that are NOT `/billing/*` and NOT `/auth/*` to avoid loops |
| `src/pages/Settings.tsx` | New "Abonnement" tab |
| `src/pages/SuperAdmin.tsx` | New "Abo" badge column + "Abo setzen" dialog |
| `src/hooks/api/useSuperAdmin.ts` | Add `useUpdateSubscription` mutation |

### BillingLocked Page (`/billing-locked`)

- **Public route** — registered in `App.tsx` outside `ProtectedRoute` (no auth guard, no subscription guard)
- Displays reason: "Trial abgelaufen" / "Zahlung fehlgeschlagen" / "Abo gekündigt"
- Two plan cards: Pro (€49/month) and Business (€99/month) with feature lists
- Upgrade button → `POST /api/billing/checkout` → `window.location.href = url` (calls API directly; 402 intercept in `api.ts` is skipped for `/billing/*` paths)
- Logout button

### Settings — Abonnement Tab

- Shows current plan badge + status
- If `TRIAL`: "X Tage verbleibend", Pro + Business upgrade buttons
- If `ACTIVE`: "Nächste Zahlung: {currentPeriodEnd}", "Plan wechseln" → Checkout, "Abo verwalten" → Portal
- If `PAST_DUE`: warning banner, "Jetzt bezahlen" → Portal
- If `CANCELED`: upgrade buttons shown
- If `MANUAL`: "Testzugang (durch Administrator vergeben)" — no self-service buttons; `currentPeriodEnd` shown as "—" if null

**Post-Checkout polling:** When `Settings.tsx` mounts with `?success=1`, start polling `GET /api/billing/status` every 2 seconds. Stop polling when `subscriptionStatus === "ACTIVE"` or after 10 seconds (whichever comes first). Implementation:

```typescript
const [isPolling, setIsPolling] = useState(hasSuccessParam);
useEffect(() => {
  if (!isPolling) return;
  const timer = setTimeout(() => setIsPolling(false), 10_000);
  return () => clearTimeout(timer);
}, [isPolling]);

const { data } = useBillingStatus({
  refetchInterval: isPolling ? 2000 : false,
});
useEffect(() => {
  if (data?.subscriptionStatus === "ACTIVE") setIsPolling(false);
}, [data]);
```

### Superadmin — Subscription Management

New "Abo setzen" button per company row → dialog:
- Plan dropdown: Trial / Pro / Business
- Status dropdown: Trial / Active / Past Due / Canceled / Manual
- "Manueller Override" checkbox
- Optional "Abo bis" date field (`currentPeriodEnd`)
- Save → `PATCH /api/superadmin/companies/:id/subscription`

Companies table: new "Abo" column with colored badge (Trial=gray, Active=green, Past Due=yellow, Canceled=red, Manual=blue).

## Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
CLIENT_URL=https://hasverl.xyz   # reuse if already in env.ts, do not add duplicate
```

## Error Handling

- 402 from subscriptionGuard → `api.ts` 402 intercept fires only for non-`/billing/*` and non-`/auth/*` paths → `window.location.replace("/billing-locked")`
- Stripe webhook signature mismatch → 400, logged via pino
- Stripe API errors in `billing.service.ts` → wrapped in `AppError`
- Unknown Stripe price ID in webhook → log warning, keep existing `planType`, still update `subscriptionStatus`
- Stripe API errors in `deleteCompany` → log warning, continue with DB deletion (orphaned Stripe resources are recoverable manually)

## Testing

- Unit tests for `subscriptionGuard`: all status + date combinations (TRIAL expired, TRIAL active, ACTIVE, PAST_DUE, CANCELED, MANUAL)
- Unit tests for `billing.service.ts` with mocked Stripe SDK: get-or-create customer, price ID mapping, unknown price ID warning
- Unit test for webhook handler: verify `manualOverride = true` skips updates
- Manual E2E: create company → trial active → fast-forward date → verify 402 → checkout → simulate webhook → verify ACTIVE
- Manual: Superadmin sets MANUAL override → simulate webhook → verify status unchanged
- Manual: delete company with Stripe subscription → verify Stripe resources cancelled
