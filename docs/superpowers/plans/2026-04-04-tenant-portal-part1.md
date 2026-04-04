# Tenant Portal — Implementierungsplan Teil 1: Backend Datenbank & Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend-Infrastruktur für das Mieter-Portal: DB-Schema, TenantUser-Auth, JWT, Einladungsflow, Branding-Endpoint.

**Architecture:** Neue Prisma-Modelle (`TenantUser`, `TenantMessage`, `TenantDocument`, Erweiterungen auf `Company` und `Document`) + eigener JWT-Flow für Mieter unter `/api/tenant/*`. Komplett getrennt von User/Verwalter-Auth.

**Tech Stack:** Prisma 6, Express 5, bcrypt, jsonwebtoken, nodemailer, zod, vitest

**Teile:**
- Teil 1 (diese Datei): DB-Schema + TenantUser Auth + Invite
- Teil 2: Tenant API-Endpunkte (Dokumente, Tickets, Finanzen, Nachrichten, Upload, Signatur)
- Teil 3: Frontend tenant-portal/ Setup + PWA + Auth + Branding + Core-Pages
- Teil 4: Frontend restliche Pages + Admin-UI-Erweiterungen

---

## Dateiübersicht Teil 1

| Aktion | Datei |
|--------|-------|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/prisma/migrations/20260404_tenant_portal/migration.sql` (auto) |
| Create | `backend/src/lib/tenantJwt.ts` |
| Create | `backend/src/middleware/tenantAuth.ts` |
| Create | `backend/src/schemas/tenantAuth.schema.ts` |
| Create | `backend/src/services/tenantAuth.service.ts` |
| Create | `backend/src/controllers/tenantAuth.controller.ts` |
| Create | `backend/src/routes/tenantAuth.routes.ts` |
| Create | `backend/src/routes/tenantBranding.routes.ts` |
| Create | `backend/src/controllers/tenantBranding.controller.ts` |
| Modify | `backend/src/routes/index.ts` |
| Modify | `backend/src/config/env.ts` |
| Create | `backend/src/test/tenantAuth.test.ts` |

---

## Task 1: Prisma Schema erweitern

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Company-Modell um Branding-Felder erweitern**

Suche den `model Company` Block und füge nach dem bestehenden `slug`-Feld folgendes hinzu (slug existiert bereits laut Codebase-Analyse):

```prisma
model Company {
  // ... bestehende Felder ...
  logoUrl      String?  @map("logo_url")
  primaryColor String   @default("#2563eb") @map("primary_color")

  // ... bestehende Relations ...
  tenantUsers    TenantUser[]
  tenantMessages TenantMessage[]
  tenantUploads  TenantUpload[]
}
```

- [ ] **Step 2: Document-Modell um Signatur-Felder erweitern**

Füge im `model Document` Block neue Felder hinzu (nach `isEncrypted`):

```prisma
model Document {
  // ... bestehende Felder ...
  requiresSignature      Boolean          @default(false) @map("requires_signature")
  signatureType          SignatureType?   @map("signature_type")
  signedAt               DateTime?        @map("signed_at")
  signedByTenantUserId   Int?             @map("signed_by_tenant_user_id")
  signatureData          String?          @map("signature_data")

  // ... bestehende Relations ...
  signedByTenantUser     TenantUser?      @relation("DocumentSignedBy", fields: [signedByTenantUserId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 3: Neue Enums hinzufügen**

Nach den bestehenden Enums (z.B. nach `UnitType`) einfügen:

```prisma
enum SignatureType {
  SIMPLE
  SIGNATURE_PAD
}

enum TenantMessageDirection {
  TENANT_TO_ADMIN
  ADMIN_TO_TENANT
}
```

- [ ] **Step 4: Neues Modell TenantUser hinzufügen**

Am Ende der schema.prisma, vor der letzten Zeile:

```prisma
model TenantUser {
  id              Int       @id @default(autoincrement())
  email           String
  passwordHash    String    @map("password_hash")
  tenantId        Int       @map("tenant_id")
  companyId       Int       @map("company_id")
  inviteToken     String?   @map("invite_token")
  inviteExpiresAt DateTime? @map("invite_expires_at")
  refreshToken    String?   @map("refresh_token")
  lastLoginAt     DateTime? @map("last_login_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  signedDocuments Document[] @relation("DocumentSignedBy")
  messages        TenantMessage[]
  uploads         TenantUpload[]

  @@unique([email, companyId])
  @@map("tenant_users")
}

model TenantMessage {
  id             Int                    @id @default(autoincrement())
  companyId      Int                    @map("company_id")
  tenantUserId   Int                    @map("tenant_user_id")
  direction      TenantMessageDirection
  body           String
  readAt         DateTime?              @map("read_at")
  createdAt      DateTime               @default(now()) @map("created_at")

  company        Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  tenantUser     TenantUser             @relation(fields: [tenantUserId], references: [id], onDelete: Cascade)

  @@map("tenant_messages")
}

model TenantUpload {
  id           Int       @id @default(autoincrement())
  companyId    Int       @map("company_id")
  tenantUserId Int       @map("tenant_user_id")
  filename     String
  mimeType     String    @map("mime_type")
  sizeBytes    Int       @map("size_bytes")
  category     String    @default("sonstiges")
  description  String?
  storagePath  String    @map("storage_path")
  createdAt    DateTime  @default(now()) @map("created_at")

  company      Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  tenantUser   TenantUser @relation(fields: [tenantUserId], references: [id], onDelete: Cascade)

  @@map("tenant_uploads")
}
```

- [ ] **Step 5: Tenant-Relation auf bestehendem Tenant-Modell ergänzen**

Im `model Tenant` Block die `tenantUsers` Relation hinzufügen:

```prisma
model Tenant {
  // ... bestehende Felder und Relations ...
  tenantUsers TenantUser[]
}
```

- [ ] **Step 6: Migration ausführen**

```bash
cd backend
npx prisma migrate dev --name tenant_portal
```

Erwartete Ausgabe:
```
Your database is now in sync with your schema.
✓ Generated Prisma Client
```

- [ ] **Step 7: TypeScript prüfen**

```bash
cd backend
npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add TenantUser, TenantMessage, TenantUpload models + Document signature fields"
```

---

## Task 2: JWT-Utilities für Tenant

**Files:**
- Create: `backend/src/lib/tenantJwt.ts`

- [ ] **Step 1: Failing test schreiben**

Erstelle `backend/src/test/tenantJwt.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("tenant_access_token"),
    verify: vi.fn().mockReturnValue({
      tenantUserId: 1,
      tenantId: 2,
      companyId: 3,
      role: "TENANT",
    }),
  },
}));

import {
  signTenantAccessToken,
  signTenantRefreshToken,
  verifyTenantAccessToken,
  verifyTenantRefreshToken,
} from "../lib/tenantJwt.js";

describe("tenantJwt", () => {
  beforeEach(() => {
    process.env.JWT_TENANT_ACCESS_SECRET = "test-tenant-access-secret";
    process.env.JWT_TENANT_REFRESH_SECRET = "test-tenant-refresh-secret";
  });

  it("signTenantAccessToken returns a token string", () => {
    const token = signTenantAccessToken({ tenantUserId: 1, tenantId: 2, companyId: 3 });
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifyTenantAccessToken returns payload with role TENANT", () => {
    const payload = verifyTenantAccessToken("tenant_access_token");
    expect(payload.role).toBe("TENANT");
    expect(payload.tenantUserId).toBe(1);
    expect(payload.companyId).toBe(3);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

```bash
cd backend
npx vitest run src/test/tenantJwt.test.ts
```

Erwartete Ausgabe: FAIL — `Cannot find module '../lib/tenantJwt.js'`

- [ ] **Step 3: tenantJwt.ts implementieren**

Erstelle `backend/src/lib/tenantJwt.ts`:

```typescript
import jwt from "jsonwebtoken";

export interface TenantTokenPayload {
  tenantUserId: number;
  tenantId: number;
  companyId: number;
  role: "TENANT";
}

function getTenantAccessSecret(): string {
  const s = process.env.JWT_TENANT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_TENANT_ACCESS_SECRET ist nicht gesetzt");
  return s;
}

function getTenantRefreshSecret(): string {
  const s = process.env.JWT_TENANT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_TENANT_REFRESH_SECRET ist nicht gesetzt");
  return s;
}

export function signTenantAccessToken(
  payload: Omit<TenantTokenPayload, "role">
): string {
  return jwt.sign({ ...payload, role: "TENANT" }, getTenantAccessSecret(), {
    expiresIn: "15m",
  });
}

export function signTenantRefreshToken(
  payload: Omit<TenantTokenPayload, "role">
): string {
  return jwt.sign({ ...payload, role: "TENANT" }, getTenantRefreshSecret(), {
    expiresIn: "7d",
  });
}

export function verifyTenantAccessToken(token: string): TenantTokenPayload {
  return jwt.verify(token, getTenantAccessSecret()) as TenantTokenPayload;
}

export function verifyTenantRefreshToken(token: string): TenantTokenPayload {
  return jwt.verify(token, getTenantRefreshSecret()) as TenantTokenPayload;
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

```bash
cd backend
npx vitest run src/test/tenantJwt.test.ts
```

Erwartete Ausgabe:
```
✓ src/test/tenantJwt.test.ts (2 tests)
Test Files  1 passed (1)
```

- [ ] **Step 5: Env-Variablen in env.ts ergänzen**

In `backend/src/config/env.ts` folgende Getter hinzufügen (nach `JWT_REFRESH_SECRET`):

```typescript
get JWT_TENANT_ACCESS_SECRET() {
  const s = process.env.JWT_TENANT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_TENANT_ACCESS_SECRET ist nicht gesetzt");
  return s;
},
get JWT_TENANT_REFRESH_SECRET() {
  const s = process.env.JWT_TENANT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_TENANT_REFRESH_SECRET ist nicht gesetzt");
  return s;
},
```

- [ ] **Step 6: Env-Variablen in .env.example dokumentieren**

Falls `backend/.env.example` existiert, folgendes anhängen (sonst `.env` direkt):

```bash
# Tenant Portal JWT (separate secrets — no cross-role token reuse)
JWT_TENANT_ACCESS_SECRET=change-me-tenant-access-32chars
JWT_TENANT_REFRESH_SECRET=change-me-tenant-refresh-32chars
```

Tatsächlich in `backend/.env` (nicht committen):
```
JWT_TENANT_ACCESS_SECRET=tenant-access-secret-dev-min32chars
JWT_TENANT_REFRESH_SECRET=tenant-refresh-secret-dev-min32chars
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/tenantJwt.ts backend/src/test/tenantJwt.test.ts backend/src/config/env.ts
git commit -m "feat(tenant): tenant JWT utilities with separate secrets"
```

---

## Task 3: Tenant Auth Middleware

**Files:**
- Create: `backend/src/middleware/tenantAuth.ts`

- [ ] **Step 1: Failing test schreiben**

Erstelle `backend/src/test/tenantAuth.middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../lib/tenantJwt.js", () => ({
  verifyTenantAccessToken: vi.fn().mockReturnValue({
    tenantUserId: 1,
    tenantId: 2,
    companyId: 3,
    role: "TENANT",
  }),
}));

import { requireTenantAuth } from "../middleware/tenantAuth.js";

function mockReq(auth?: string): Partial<Request> {
  return {
    headers: { authorization: auth },
  } as Partial<Request>;
}

function mockRes(): Partial<Response> {
  return {};
}

describe("requireTenantAuth", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next() with tenantUser set when token is valid", () => {
    const req = mockReq("Bearer valid_token") as Request;
    requireTenantAuth(req, mockRes() as Response, next);
    expect((req as any).tenantUser).toEqual({
      id: 1,
      tenantId: 2,
      companyId: 3,
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(UnauthorizedError) when no Authorization header", () => {
    const req = mockReq() as Request;
    requireTenantAuth(req, mockRes() as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next(UnauthorizedError) when token is invalid", () => {
    const { verifyTenantAccessToken } = require("../lib/tenantJwt.js");
    verifyTenantAccessToken.mockImplementationOnce(() => {
      throw new Error("invalid");
    });
    const req = mockReq("Bearer bad_token") as Request;
    requireTenantAuth(req, mockRes() as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

```bash
cd backend
npx vitest run src/test/tenantAuth.middleware.test.ts
```

Erwartete Ausgabe: FAIL — `Cannot find module '../middleware/tenantAuth.js'`

- [ ] **Step 3: tenantAuth.ts implementieren**

Erstelle `backend/src/middleware/tenantAuth.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { verifyTenantAccessToken } from "../lib/tenantJwt.js";
import { UnauthorizedError } from "../lib/errors.js";

export interface TenantUser {
  id: number;
  tenantId: number;
  companyId: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      tenantUser?: TenantUser;
    }
  }
}

export function requireTenantAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Kein Token angegeben"));
    return;
  }

  try {
    const payload = verifyTenantAccessToken(header.slice(7));
    req.tenantUser = {
      id: payload.tenantUserId,
      tenantId: payload.tenantId,
      companyId: payload.companyId,
    };
    next();
  } catch {
    next(new UnauthorizedError("Token abgelaufen oder ungueltig"));
  }
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

```bash
cd backend
npx vitest run src/test/tenantAuth.middleware.test.ts
```

Erwartete Ausgabe:
```
✓ src/test/tenantAuth.middleware.test.ts (3 tests)
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/tenantAuth.ts backend/src/test/tenantAuth.middleware.test.ts
git commit -m "feat(tenant): requireTenantAuth middleware"
```

---

## Task 4: Tenant Auth Service (Login, Invite, Refresh)

**Files:**
- Create: `backend/src/schemas/tenantAuth.schema.ts`
- Create: `backend/src/services/tenantAuth.service.ts`

- [ ] **Step 1: Zod Schemas erstellen**

Erstelle `backend/src/schemas/tenantAuth.schema.ts`:

```typescript
import { z } from "zod";

export const tenantLoginSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort erforderlich"),
});

export const tenantAcceptInviteSchema = z.object({
  token: z.string().min(1, "Einladungstoken erforderlich"),
  password: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss einen Großbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss eine Zahl enthalten"),
});

export const tenantSlugParamSchema = z.object({
  slug: z.string().min(1),
});
```

- [ ] **Step 2: Failing test schreiben**

Erstelle `backend/src/test/tenantAuth.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenantUser: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../lib/tenantJwt.js", () => ({
  signTenantAccessToken: vi.fn().mockReturnValue("access_token"),
  signTenantRefreshToken: vi.fn().mockReturnValue("refresh_token"),
  verifyTenantRefreshToken: vi.fn(),
}));

import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { loginTenant, acceptInvite } from "../services/tenantAuth.service.js";

const mockTenantUser = {
  id: 1,
  email: "max@example.de",
  passwordHash: "hashed_password",
  tenantId: 10,
  companyId: 3,
  inviteToken: null,
  inviteExpiresAt: null,
  refreshToken: null,
};

describe("tenantAuth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loginTenant", () => {
    it("returns tokens on valid credentials", async () => {
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce(
        mockTenantUser as any
      );
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      vi.mocked(prisma.tenantUser.update).mockResolvedValueOnce({} as any);

      const result = await loginTenant("max@example.de", "Password1!", 3);

      expect(result.accessToken).toBe("access_token");
      expect(result.refreshToken).toBe("refresh_token");
    });

    it("throws UnauthorizedError on wrong password", async () => {
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce(
        mockTenantUser as any
      );
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      await expect(loginTenant("max@example.de", "wrong", 3)).rejects.toThrow(
        "Ungueltige Anmeldedaten"
      );
    });

    it("throws UnauthorizedError when user not found", async () => {
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce(null);

      await expect(
        loginTenant("nobody@example.de", "Password1!", 3)
      ).rejects.toThrow("Ungueltige Anmeldedaten");
    });
  });

  describe("acceptInvite", () => {
    it("activates account and returns tokens", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
        ...mockTenantUser,
        inviteToken: "valid-token",
        inviteExpiresAt: futureDate,
      } as any);
      vi.mocked(prisma.tenantUser.update).mockResolvedValueOnce({} as any);

      const result = await acceptInvite("valid-token", "NewPassword1!");

      expect(bcrypt.hash).toHaveBeenCalledWith("NewPassword1!", expect.any(Number));
      expect(result.accessToken).toBe("access_token");
    });

    it("throws BadRequestError on expired token", async () => {
      const pastDate = new Date(Date.now() - 1000);
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
        ...mockTenantUser,
        inviteToken: "expired-token",
        inviteExpiresAt: pastDate,
      } as any);

      await expect(acceptInvite("expired-token", "NewPassword1!")).rejects.toThrow(
        "Einladungslink abgelaufen"
      );
    });
  });
});
```

- [ ] **Step 3: Test ausführen (muss fehlschlagen)**

```bash
cd backend
npx vitest run src/test/tenantAuth.service.test.ts
```

Erwartete Ausgabe: FAIL — `Cannot find module '../services/tenantAuth.service.js'`

- [ ] **Step 4: tenantAuth.service.ts implementieren**

Erstelle `backend/src/services/tenantAuth.service.ts`:

```typescript
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import {
  signTenantAccessToken,
  signTenantRefreshToken,
  verifyTenantRefreshToken,
} from "../lib/tenantJwt.js";
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from "../lib/errors.js";
import { env } from "../config/env.js";

export async function loginTenant(
  email: string,
  password: string,
  companyId: number
): Promise<{ accessToken: string; refreshToken: string }> {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { email, companyId },
  });

  if (!tenantUser) {
    throw new UnauthorizedError("Ungueltige Anmeldedaten");
  }

  const valid = await bcrypt.compare(password, tenantUser.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Ungueltige Anmeldedaten");
  }

  const payload = {
    tenantUserId: tenantUser.id,
    tenantId: tenantUser.tenantId,
    companyId: tenantUser.companyId,
  };

  const accessToken = signTenantAccessToken(payload);
  const refreshToken = signTenantRefreshToken(payload);

  await prisma.tenantUser.update({
    where: { id: tenantUser.id },
    data: {
      refreshToken,
      lastLoginAt: new Date(),
    },
  });

  return { accessToken, refreshToken };
}

export async function refreshTenantToken(
  token: string
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: ReturnType<typeof verifyTenantRefreshToken>;
  try {
    payload = verifyTenantRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Ungültiger Refresh-Token");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { id: payload.tenantUserId, refreshToken: token },
  });

  if (!tenantUser) {
    throw new UnauthorizedError("Refresh-Token ungültig oder bereits verwendet");
  }

  const newPayload = {
    tenantUserId: tenantUser.id,
    tenantId: tenantUser.tenantId,
    companyId: tenantUser.companyId,
  };

  const accessToken = signTenantAccessToken(newPayload);
  const refreshToken = signTenantRefreshToken(newPayload);

  await prisma.tenantUser.update({
    where: { id: tenantUser.id },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
}

export async function logoutTenant(tenantUserId: number): Promise<void> {
  await prisma.tenantUser.update({
    where: { id: tenantUserId },
    data: { refreshToken: null },
  });
}

export async function acceptInvite(
  token: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { inviteToken: token },
  });

  if (!tenantUser || !tenantUser.inviteToken) {
    throw new BadRequestError("Einladungslink ungültig");
  }

  if (!tenantUser.inviteExpiresAt || tenantUser.inviteExpiresAt < new Date()) {
    throw new BadRequestError("Einladungslink abgelaufen");
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);
  const payload = {
    tenantUserId: tenantUser.id,
    tenantId: tenantUser.tenantId,
    companyId: tenantUser.companyId,
  };
  const accessToken = signTenantAccessToken(payload);
  const refreshToken = signTenantRefreshToken(payload);

  await prisma.tenantUser.update({
    where: { id: tenantUser.id },
    data: {
      passwordHash,
      inviteToken: null,
      inviteExpiresAt: null,
      refreshToken,
      lastLoginAt: new Date(),
    },
  });

  return { accessToken, refreshToken };
}

export async function sendTenantInvite(
  tenantId: number,
  companyId: number,
  email: string
): Promise<void> {
  const [tenant, company] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.company.findUnique({ where: { id: companyId } }),
  ]);

  if (!tenant || tenant.companyId !== companyId) {
    throw new NotFoundError("Mieter nicht gefunden");
  }
  if (!company) {
    throw new NotFoundError("Firma nicht gefunden");
  }

  const inviteToken = crypto.randomUUID();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d

  // Upsert: create or update TenantUser for this email+company
  await prisma.tenantUser.upsert({
    where: { email_companyId: { email, companyId } },
    create: {
      email,
      passwordHash: "", // set on invite acceptance
      tenantId,
      companyId,
      inviteToken,
      inviteExpiresAt,
    },
    update: {
      inviteToken,
      inviteExpiresAt,
    },
  });

  // Send invite email
  const { sendMailForCompany, isEmailEnabled } = await import(
    "../config/email.js"
  );
  if (!isEmailEnabled) return;

  const portalUrl = `${process.env.TENANT_PORTAL_URL ?? "http://localhost:5173"}/${company.slug}/invite/${inviteToken}`;

  await sendMailForCompany(
    companyId,
    email,
    `Einladung zum Mieter-Portal — ${company.name}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Willkommen im Mieter-Portal</h2>
      <p>Guten Tag,</p>
      <p><strong>${company.name}</strong> hat Sie eingeladen, das Mieter-Portal zu nutzen.</p>
      <p>Klicken Sie auf den Link unten, um Ihr Konto einzurichten:</p>
      <p style="margin: 24px 0;">
        <a href="${portalUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Konto aktivieren
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Dieser Link ist 7 Tage gültig. Falls Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.</p>
    </div>
    `
  );
}
```

- [ ] **Step 5: Test ausführen (muss bestehen)**

```bash
cd backend
npx vitest run src/test/tenantAuth.service.test.ts
```

Erwartete Ausgabe:
```
✓ src/test/tenantAuth.service.test.ts (5 tests)
Test Files  1 passed (1)
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/schemas/tenantAuth.schema.ts backend/src/services/tenantAuth.service.ts backend/src/test/tenantAuth.service.test.ts
git commit -m "feat(tenant): TenantAuth service — login, refresh, logout, invite"
```

---

## Task 5: Tenant Auth Controller & Routes

**Files:**
- Create: `backend/src/controllers/tenantAuth.controller.ts`
- Create: `backend/src/routes/tenantAuth.routes.ts`

- [ ] **Step 1: Controller erstellen**

Erstelle `backend/src/controllers/tenantAuth.controller.ts`:

```typescript
import type { Request, Response } from "express";
import * as tenantAuthService from "../services/tenantAuth.service.js";

const REFRESH_COOKIE = "tenantRefreshToken";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  path: "/api/tenant/auth",
};

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  // companyId wird aus dem slug aufgelöst (via tenantBranding middleware — wird in routes gesetzt)
  const companyId = (req as any).companyId as number;

  const { accessToken, refreshToken } = await tenantAuthService.loginTenant(
    email,
    password,
    companyId
  );

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
  res.json({ data: { accessToken } });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: { message: "Kein Refresh-Token" } });
    return;
  }

  const { accessToken, refreshToken } = await tenantAuthService.refreshTenantToken(token);

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
  res.json({ data: { accessToken } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const tenantUserId = req.tenantUser!.id;
  await tenantAuthService.logoutTenant(tenantUserId);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/tenant/auth" });
  res.json({ data: { ok: true } });
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };

  const { accessToken, refreshToken } = await tenantAuthService.acceptInvite(
    token,
    password
  );

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
  res.json({ data: { accessToken } });
}
```

- [ ] **Step 2: Routes erstellen**

Erstelle `backend/src/routes/tenantAuth.routes.ts`:

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireTenantAuth } from "../middleware/tenantAuth.js";
import {
  tenantLoginSchema,
  tenantAcceptInviteSchema,
  tenantSlugParamSchema,
} from "../schemas/tenantAuth.schema.js";
import * as ctrl from "../controllers/tenantAuth.controller.js";
import { resolveTenantCompany } from "../middleware/resolveTenantCompany.js";

export const tenantAuthRouter = Router({ mergeParams: true });

// Alle Auth-Routes brauchen zuerst den Company-Slug aufzulösen
tenantAuthRouter.use(validate({ params: tenantSlugParamSchema }));
tenantAuthRouter.use(resolveTenantCompany);

tenantAuthRouter.post(
  "/login",
  validate({ body: tenantLoginSchema }),
  ctrl.login
);

tenantAuthRouter.post(
  "/refresh",
  ctrl.refresh
);

tenantAuthRouter.post(
  "/logout",
  requireTenantAuth,
  ctrl.logout
);

tenantAuthRouter.post(
  "/accept-invite",
  validate({ body: tenantAcceptInviteSchema }),
  ctrl.acceptInvite
);
```

- [ ] **Step 3: resolveTenantCompany Middleware erstellen**

Erstelle `backend/src/middleware/resolveTenantCompany.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

// Resolves :slug param → companyId, sets req.companyId
export async function resolveTenantCompany(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.params.slug;
  if (!slug) {
    next(new NotFoundError("Company slug nicht angegeben"));
    return;
  }

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!company) {
    next(new NotFoundError("Firma nicht gefunden"));
    return;
  }

  req.companyId = company.id;
  next();
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/tenantAuth.controller.ts backend/src/routes/tenantAuth.routes.ts backend/src/middleware/resolveTenantCompany.ts
git commit -m "feat(tenant): TenantAuth controller + routes"
```

---

## Task 6: Branding-Endpoint + Invite-Endpoint (Admin)

**Files:**
- Create: `backend/src/controllers/tenantBranding.controller.ts`
- Create: `backend/src/routes/tenantBranding.routes.ts`
- Modify: `backend/src/routes/tenant.routes.ts` (invite endpoint)
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Branding Controller erstellen**

Erstelle `backend/src/controllers/tenantBranding.controller.ts`:

```typescript
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

export async function getBranding(req: Request, res: Response): Promise<void> {
  const { slug } = req.params as { slug: string };

  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
    },
  });

  if (!company) {
    throw new NotFoundError("Firma nicht gefunden");
  }

  res.json({
    data: {
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl ?? null,
      primaryColor: company.primaryColor,
    },
  });
}
```

- [ ] **Step 2: Branding Routes erstellen**

Erstelle `backend/src/routes/tenantBranding.routes.ts`:

```typescript
import { Router } from "express";
import { getBranding } from "../controllers/tenantBranding.controller.js";

export const tenantBrandingRouter = Router();

// GET /api/tenant/company/:slug — public, no auth
tenantBrandingRouter.get("/:slug", getBranding);
```

- [ ] **Step 3: Invite-Endpoint in tenant.routes.ts ergänzen**

Öffne `backend/src/routes/tenant.routes.ts` und füge am Ende (nach den bestehenden Routes) hinzu:

```typescript
// POST /api/tenants/:id/invite — sends invite email to tenant
import { z } from "zod";
import { sendTenantInvite } from "../services/tenantAuth.service.js";

const inviteBodySchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse"),
});

router.post(
  "/:id/invite",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema, body: inviteBodySchema }),
  async (req, res) => {
    const tenantId = Number(req.params.id);
    const { email } = req.body as { email: string };
    await sendTenantInvite(tenantId, req.companyId!, email);
    res.json({ data: { ok: true } });
  }
);
```

- [ ] **Step 4: Neue Routes in index.ts registrieren**

In `backend/src/routes/index.ts`:

1. Imports hinzufügen (nach den bestehenden Imports):

```typescript
import { tenantAuthRouter } from "./tenantAuth.routes.js";
import { tenantBrandingRouter } from "./tenantBranding.routes.js";
```

2. Routes registrieren (nach den Public routes, vor den Protected routes):

```typescript
// Tenant Portal — public branding (no auth)
router.use("/tenant/company", tenantBrandingRouter);

// Tenant Portal — auth (slug-scoped)
router.use("/tenant/:slug/auth", tenantAuthRouter);
```

- [ ] **Step 5: TypeScript prüfen**

```bash
cd backend
npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 6: Alle Tests ausführen**

```bash
cd backend
npm test
```

Erwartete Ausgabe: alle bisherigen Tests bestehen, neue Tests bestehen

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/tenantBranding.controller.ts backend/src/routes/tenantBranding.routes.ts backend/src/routes/tenant.routes.ts backend/src/routes/index.ts
git commit -m "feat(tenant): branding endpoint + tenant invite route registered in router"
```

---

## Task 7: Env-Variablen ergänzen + Integrations-Smoke-Test

**Files:**
- Modify: `backend/.env` (nicht committen)

- [ ] **Step 1: .env um Tenant-Variablen ergänzen**

Füge in `backend/.env` hinzu:

```bash
# Tenant Portal
JWT_TENANT_ACCESS_SECRET=tenant-access-secret-dev-min32chars
JWT_TENANT_REFRESH_SECRET=tenant-refresh-secret-dev-min32chars
TENANT_PORTAL_URL=http://localhost:5173
```

- [ ] **Step 2: Backend starten und Branding-Endpoint testen**

```bash
cd backend
npm run dev
```

In einem zweiten Terminal:

```bash
curl -s http://localhost:3001/api/tenant/company/mustermann-hv | jq .
```

Erwartete Ausgabe (Company muss Slug `mustermann-hv` haben, sonst 404):
```json
{
  "data": {
    "name": "Mustermann Hausverwaltung GmbH",
    "slug": "mustermann-hv",
    "logoUrl": null,
    "primaryColor": "#2563eb"
  }
}
```

Falls die Seed-Company noch keinen passenden Slug hat:
```bash
cd backend
npx prisma studio
```
→ Company-Tabelle öffnen → slug auf `mustermann-hv` setzen.

- [ ] **Step 3: Login-Endpoint testen (nachdem TenantUser via Prisma Studio angelegt)**

Da noch kein TenantUser existiert, über Prisma Studio einen anlegen:
- `email: test@mieter.de`
- `passwordHash`: `$2b$12$...` (via `node -e "require('bcrypt').hash('Test123!', 12).then(console.log)"`)
- `tenantId`: 1, `companyId`: 1

```bash
curl -s -X POST http://localhost:3001/api/tenant/mustermann-hv/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mieter.de","password":"Test123!"}' | jq .
```

Erwartete Ausgabe:
```json
{
  "data": {
    "accessToken": "eyJ..."
  }
}
```

- [ ] **Step 4: Abschließender Commit**

```bash
git add backend/.env.example 2>/dev/null || true
git commit -m "feat(tenant): Teil 1 complete — DB, JWT, auth middleware, login/invite/refresh/logout, branding endpoint"
```

---

## Teil 1 abgeschlossen

**Was gebaut wurde:**
- Prisma-Modelle: `TenantUser`, `TenantMessage`, `TenantUpload` + Erweiterungen auf `Company` und `Document`
- Separate JWT-Utilities (`tenantJwt.ts`) mit eigenen Secrets
- `requireTenantAuth` Middleware
- `resolveTenantCompany` Middleware (Slug → companyId)
- TenantAuth Service: login, refresh, logout, acceptInvite, sendTenantInvite
- Endpoints: `POST /api/tenant/:slug/auth/login`, `/refresh`, `/logout`, `/accept-invite`
- Endpoint: `GET /api/tenant/company/:slug` (Branding, public)
- Endpoint: `POST /api/tenants/:id/invite` (Admin)
- Tests: 10 Unit-Tests

**Weiter mit:** `2026-04-04-tenant-portal-part2.md` — Tenant API-Endpunkte (Dokumente, Tickets, Finanzen, Nachrichten, Upload, Signatur)
