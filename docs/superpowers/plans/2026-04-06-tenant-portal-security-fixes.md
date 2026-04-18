# Tenant Portal Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 6 highest-priority security vulnerabilities found in the Mieter-Portal security audit.

**Architecture:** Pure service/schema layer fixes — no new routes or DB migrations needed. Each fix is isolated to 1-2 files and can be deployed independently.

**Tech Stack:** Node.js, Express 5, TypeScript, Prisma 6, Zod, Vitest

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/services/tenantAuth.service.ts` | Already-used token check, reduce invite expiry 7d→48h |
| `backend/src/schemas/tenantAuth.schema.ts` | Stronger password: min 10 chars + Sonderzeichen |
| `backend/src/schemas/tenantPortal.schema.ts` | Remove email from updateMeSchema; add enum for ticket category |
| `backend/src/services/tenantPortal.service.ts` | Remove email update logic; fix `as any` cast |
| `backend/src/routes/tenantAuth.routes.ts` | Add `authLimiter` to accept-invite endpoint |
| `backend/src/test/tenantAuth.service.test.ts` | NEW: Tests for invite token security |
| `backend/src/test/tenantPortal.service.test.ts` | Extend: tests for category validation, no-email-change |

---

## Task 1: Block already-used invite tokens

**Problem:** `acceptInvite()` doesn't check if the account is already activated. If an attacker resubmits the invite link (race condition or network retry) the token is still accepted because the check only looks at `inviteExpiresAt`, not whether `passwordHash` is already set.

**Files:**
- Modify: `backend/src/services/tenantAuth.service.ts`
- Create: `backend/src/test/tenantAuth.service.test.ts`

- [ ] **Step 1: Create test file with failing tests**

Create `backend/src/test/tenantAuth.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenantUser: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

vi.mock("../lib/tenantJwt.js", () => ({
  signTenantAccessToken: vi.fn().mockReturnValue("access_token"),
  signTenantRefreshToken: vi.fn().mockReturnValue("refresh_token"),
  verifyTenantRefreshToken: vi.fn().mockReturnValue({ tenantUserId: 1, tenantId: 2, companyId: 3 }),
}));

vi.mock("../config/env.js", () => ({
  env: { BCRYPT_COST: 10 },
}));

import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { acceptInvite } from "../services/tenantAuth.service.js";

describe("acceptInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when invite token is not found", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce(null);
    await expect(acceptInvite("invalid-token", "Passwort1!")).rejects.toThrow(
      "Ungültiger Einladungslink"
    );
  });

  it("throws when invite token is expired", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      passwordHash: "",
      inviteToken: "tok",
      inviteExpiresAt: new Date(Date.now() - 1000), // expired
    } as any);
    await expect(acceptInvite("tok", "Passwort1!")).rejects.toThrow(
      "Einladungslink ist abgelaufen"
    );
  });

  it("throws when account is already activated (token already used)", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      passwordHash: "$2b$10$existingHash", // non-empty = already activated
      inviteToken: "tok",
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    } as any);
    await expect(acceptInvite("tok", "Passwort1!")).rejects.toThrow(
      "Einladung bereits verwendet"
    );
  });

  it("activates account and returns tokens on valid invite", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      passwordHash: "", // not yet activated
      inviteToken: "valid-tok",
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    } as any);
    vi.mocked(prisma.tenantUser.update).mockResolvedValueOnce({} as any);

    const result = await acceptInvite("valid-tok", "Passwort1!");
    expect(result.accessToken).toBe("access_token");
    expect(result.refreshToken).toBe("refresh_token");
    expect(prisma.tenantUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteToken: null,
          inviteExpiresAt: null,
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/test/tenantAuth.service.test.ts 2>&1 | tail -20
```

Expected: FAIL — "throws when account is already activated" fails because the check doesn't exist yet.

- [ ] **Step 3: Add the already-activated check to `acceptInvite`**

In `backend/src/services/tenantAuth.service.ts`, after the expiry check (after line 116), add:

```typescript
  if (tenantUser.passwordHash !== "") {
    throw new BadRequestError("Einladung bereits verwendet");
  }
```

The relevant section should look like this after the edit:

```typescript
  if (!tenantUser.inviteExpiresAt || tenantUser.inviteExpiresAt < new Date()) {
    throw new BadRequestError("Einladungslink ist abgelaufen");
  }

  if (tenantUser.passwordHash !== "") {
    throw new BadRequestError("Einladung bereits verwendet");
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/test/tenantAuth.service.test.ts 2>&1 | tail -10
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/tenantAuth.service.ts src/test/tenantAuth.service.test.ts
git commit -m "fix(tenant-portal): block reuse of already-accepted invite tokens"
```

---

## Task 2: Reduce invite token expiry from 7 days to 48 hours

**Problem:** 7-day window gives attackers too long to exploit a stolen invite link.

**Files:**
- Modify: `backend/src/services/tenantAuth.service.ts` (line 161)

- [ ] **Step 1: Change invite expiry constant**

In `backend/src/services/tenantAuth.service.ts`, change line 161:

Old:
```typescript
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
```

New:
```typescript
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
```

Also update the email text (line ~192):
Old:
```typescript
      <p>Dieser Link ist 7 Tage gültig.</p>
```
New:
```typescript
      <p>Dieser Link ist 48 Stunden gültig.</p>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/services/tenantAuth.service.ts
git commit -m "fix(tenant-portal): reduce invite token expiry from 7 days to 48 hours"
```

---

## Task 3: Add rate limiter to accept-invite endpoint

**Problem:** The `/accept-invite` endpoint has no rate limiting — an attacker can brute-force invite tokens.

**Files:**
- Modify: `backend/src/routes/tenantAuth.routes.ts`

- [ ] **Step 1: Add `authLimiter` to accept-invite route**

In `backend/src/routes/tenantAuth.routes.ts`, change line 25:

Old:
```typescript
router.post("/accept-invite", validate({ body: tenantAcceptInviteSchema }), acceptInviteHandler);
```

New:
```typescript
router.post("/accept-invite", authLimiter, validate({ body: tenantAcceptInviteSchema }), acceptInviteHandler);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/routes/tenantAuth.routes.ts
git commit -m "fix(tenant-portal): add rate limiting to accept-invite endpoint"
```

---

## Task 4: Strengthen password requirements

**Problem:** Minimum 8 characters, no Sonderzeichen required — too weak for a login credential.

**Files:**
- Modify: `backend/src/schemas/tenantAuth.schema.ts`

- [ ] **Step 1: Write failing test in existing test file**

In `backend/src/test/tenantAuth.service.test.ts`, add a new `describe` block at the end:

```typescript
import { tenantAcceptInviteSchema } from "../schemas/tenantAuth.schema.js";

describe("tenantAcceptInviteSchema password validation", () => {
  it("rejects password shorter than 10 chars", () => {
    const result = tenantAcceptInviteSchema.safeParse({ token: "tok", password: "Short1!" });
    expect(result.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = tenantAcceptInviteSchema.safeParse({ token: "tok", password: "LongPasswort1" });
    expect(result.success).toBe(false);
  });

  it("accepts strong password", () => {
    const result = tenantAcceptInviteSchema.safeParse({ token: "tok", password: "StarkesPW1!" });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/test/tenantAuth.service.test.ts 2>&1 | tail -15
```

Expected: "rejects password shorter than 10 chars" fails (8 chars still accepted) and "rejects password without special character" fails.

- [ ] **Step 3: Update password schema**

Replace the full content of `backend/src/schemas/tenantAuth.schema.ts`:

```typescript
import { z } from "zod";

export const tenantLoginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort darf nicht leer sein"),
});

export const tenantAcceptInviteSchema = z.object({
  token: z.string().min(1, "Token fehlt"),
  password: z
    .string()
    .min(10, "Passwort muss mindestens 10 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten")
    .regex(/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/, "Passwort muss mindestens ein Sonderzeichen enthalten"),
});

export type TenantLoginInput = z.infer<typeof tenantLoginSchema>;
export type TenantAcceptInviteInput = z.infer<typeof tenantAcceptInviteSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx vitest run src/test/tenantAuth.service.test.ts 2>&1 | tail -10
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/schemas/tenantAuth.schema.ts src/test/tenantAuth.service.test.ts
git commit -m "fix(tenant-portal): strengthen invite password requirements (min 10 + Sonderzeichen)"
```

---

## Task 5: Fix unsafe ticket category cast — replace `as any` with enum validation

**Problem:** `data.category as any` in `createTicket()` bypasses TypeScript and Prisma type safety. Invalid categories could be persisted.

**Files:**
- Modify: `backend/src/schemas/tenantPortal.schema.ts`
- Modify: `backend/src/services/tenantPortal.service.ts`
- Modify: `backend/src/test/tenantPortal.service.test.ts`

- [ ] **Step 1: Write failing test**

In `backend/src/test/tenantPortal.service.test.ts`, add to the `createTicket` describe block a second test:

```typescript
    it("rejects invalid category", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        units: [{ id: 1, propertyId: 5 }],
      } as any);

      await expect(
        createTicket(mockTenantUser, {
          title: "Irgendwas kaputt",
          description: "Eine längere Beschreibung des Problems hier",
          category: "UNGUELTIG",
        })
      ).rejects.toThrow();
    });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/test/tenantPortal.service.test.ts -t "rejects invalid category" 2>&1 | tail -10
```

Expected: FAIL — no error thrown currently because `as any` bypasses validation.

- [ ] **Step 3: Add enum to ticket schema**

In `backend/src/schemas/tenantPortal.schema.ts`, replace the `createTicketSchema`:

```typescript
export const MAINTENANCE_CATEGORIES = [
  "SANITAER",
  "ELEKTRIK",
  "HEIZUNG",
  "GEBAEUDE",
  "AUSSENANLAGE",
  "SONSTIGES",
] as const;

export type MaintenanceCategoryType = (typeof MAINTENANCE_CATEGORIES)[number];

export const createTicketSchema = z.object({
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
  description: z.string().min(10, "Beschreibung muss mindestens 10 Zeichen lang sein").max(2000),
  category: z.enum(MAINTENANCE_CATEGORIES, {
    errorMap: () => ({ message: "Ungültige Kategorie" }),
  }),
});
```

- [ ] **Step 4: Update `createTicket` service to use the typed enum**

In `backend/src/services/tenantPortal.service.ts`:

Change the import at the top to add the type:
```typescript
import { MaintenanceCategoryType } from "../schemas/tenantPortal.schema.js";
```

Change the function signature of `createTicket`:
```typescript
export async function createTicket(
  tenantUser: TenantUser,
  data: { title: string; description: string; category: MaintenanceCategoryType },
  _photoPath?: string
)
```

Change line 226, replacing `category: data.category as any,` with:
```typescript
      category: data.category,
```

- [ ] **Step 5: Run all tenantPortal tests**

```bash
cd backend && npx vitest run src/test/tenantPortal.service.test.ts 2>&1 | tail -15
```

Expected: All tests PASS including the new "rejects invalid category" test.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/schemas/tenantPortal.schema.ts src/services/tenantPortal.service.ts src/test/tenantPortal.service.test.ts
git commit -m "fix(tenant-portal): replace unsafe category cast with typed enum validation"
```

---

## Task 6: Remove email change from tenant self-service

**Problem:** Tenants can change their login email without any verification. This enables account takeover if an attacker gains temporary access. Email changes should go through the property manager.

**Files:**
- Modify: `backend/src/schemas/tenantPortal.schema.ts`
- Modify: `backend/src/services/tenantPortal.service.ts`
- Modify: `backend/src/test/tenantPortal.service.test.ts`

- [ ] **Step 1: Write failing test — email change should be ignored**

In `backend/src/test/tenantPortal.service.test.ts`, add to the `describe("tenantPortal.service")` block:

```typescript
  describe("updateMe", () => {
    it("updates phone but ignores email changes", async () => {
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
        id: 1,
        email: "original@example.de",
        lastLoginAt: null,
        company: { name: "Test GmbH" },
        tenant: {
          id: 10, name: "Max", phone: "+49 171 999", moveIn: null,
          units: [], contracts: [],
        },
      } as any);

      await updateMe(mockTenantUser, { phone: "+49 171 999", email: "hacker@evil.com" });

      // email update must NOT have been called
      expect(prisma.tenantUser.update).not.toHaveBeenCalled();
      // phone update was called
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { phone: "+49 171 999" } })
      );
    });
  });
```

Also add `updateMe` to the import at the top of the test file:
```typescript
import {
  getMe,
  updateMe,    // add this
  getDocuments,
  signDocument,
  getTickets,
  createTicket,
  getFinances,
  getMessages,
  createMessage,
} from "../services/tenantPortal.service.js";
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/test/tenantPortal.service.test.ts -t "ignores email changes" 2>&1 | tail -10
```

Expected: FAIL — `prisma.tenantUser.update` is currently called when email is provided.

- [ ] **Step 3: Remove email handling from `updateMe`**

In `backend/src/services/tenantPortal.service.ts`, replace the `updateMe` function:

```typescript
export async function updateMe(
  tenantUser: TenantUser,
  data: { phone?: string; email?: string }
) {
  if (data.phone !== undefined) {
    await prisma.tenant.update({
      where: { id: tenantUser.tenantId },
      data: { phone: data.phone },
    });
  }
  // email changes are not allowed via self-service — contact property manager
  return getMe(tenantUser);
}
```

- [ ] **Step 4: Remove email from `updateMeSchema`**

In `backend/src/schemas/tenantPortal.schema.ts`, replace `updateMeSchema`:

```typescript
export const updateMeSchema = z.object({
  phone: z.string().max(30).optional(),
});
```

- [ ] **Step 5: Run all tests**

```bash
cd backend && npx vitest run src/test/tenantPortal.service.test.ts 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/schemas/tenantPortal.schema.ts src/services/tenantPortal.service.ts src/test/tenantPortal.service.test.ts
git commit -m "fix(tenant-portal): remove unverified email self-service change"
```

---

## Task 7: Run full test suite and verify

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test 2>&1 | tail -30
```

Expected: All tests pass. No regressions.

- [ ] **Step 2: TypeScript full check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors.

- [ ] **Step 3: Final commit if any cleanup needed**

If there are any minor fixes, commit them:
```bash
cd backend && git add -p && git commit -m "fix(tenant-portal): final security hardening cleanup"
```
