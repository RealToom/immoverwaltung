# Digital Signature (Yousign) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Verwalter to send a rental contract to a Mieter for digital signature via Yousign, receive webhook callbacks to update contract status, and download the signed PDF.

**Architecture:** Platform model — one Yousign account (API key in `.env`). Backend-only implementation: new `yousign.service.ts` wraps the Yousign REST API v3 with `fetch`, a signature controller handles the 3 endpoints, and a raw-body webhook handler (registered in `app.ts` before `express.json()`) processes status events. Frontend is intentionally NOT implemented (see Frontend TODO section at end of spec).

**Tech Stack:** Node.js/Express, TypeScript, Prisma 6, Yousign API v3 (REST), pdfkit (Buffer), crypto.createHmac (HMAC-SHA256), vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/prisma/schema.prisma` | Add `SignatureStatus` enum + 4 nullable fields to Contract |
| Modify | `backend/src/config/env.ts` | Add `YOUSIGN_API_KEY`, `YOUSIGN_BASE_URL`, `YOUSIGN_WEBHOOK_SECRET` |
| Create | `backend/src/schemas/signature.schema.ts` | Zod schema for `sendForSignature` request body |
| Create | `backend/src/services/yousign.service.ts` | Yousign REST client: uploadDocument, createSignatureRequest, activateRequest, getSignedDocument |
| Create | `backend/src/controllers/signature.controller.ts` | Handlers: sendForSignature, getSignatureStatus, downloadSignedDocument |
| Create | `backend/src/routes/signature.routes.ts` | Protected routes for 3 signature endpoints (requireAuth+tenantGuard+subscriptionGuard applied in index.ts) |
| Create | `backend/src/routes/yousign-webhook.routes.ts` | Webhook handler (exported function, NOT a router) |
| Modify | `backend/src/app.ts` | Register Yousign webhook route BEFORE express.json() |
| Modify | `backend/src/routes/index.ts` | Mount signatureRouter under `/contracts/:id/signature` |
| Create | `backend/src/test/yousign.service.test.ts` | Unit tests for all 4 service functions |
| Create | `backend/src/test/yousign-webhook.test.ts` | Unit tests for webhook HMAC + 3 event types |
| Create | `backend/src/test/signature.controller.test.ts` | Unit test for 409 idempotency guard on sendForSignature |

---

## Task 1: Prisma Schema — SignatureStatus enum + 4 fields

**Files:**
- Modify: `backend/prisma/schema.prisma` (after line ~294, ContractStatus enum area)

- [ ] **Step 1: Open schema and add SignatureStatus enum**

Add after the `ContractStatus` enum (around line 295):

```prisma
enum SignatureStatus {
  AUSSTEHEND
  ABGESCHLOSSEN
  ABGELEHNT
  ABGELAUFEN
}
```

- [ ] **Step 2: Add 4 fields to the Contract model**

Add inside `model Contract { ... }` after `updatedAt` (before the relation fields):

```prisma
  signatureRequestId  String?          @map("signature_request_id")
  signatureStatus     SignatureStatus?  @map("signature_status")
  signedDocumentId    String?          @map("signed_document_id")
  signedDocumentUrl   String?          @map("signed_document_url")
```

- [ ] **Step 3: Run migration**

```bash
cd backend
npm run db:migrate
```

When prompted for a migration name, enter: `signature_fields`

Expected: Prisma generates and applies migration adding the enum and 4 nullable columns to `contracts` table.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors. If errors appear on the new fields, ensure `.js` import extensions are used.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(schema): add SignatureStatus enum + signature fields to Contract"
```

---

## Task 2: Env Config — Yousign vars

**Files:**
- Modify: `backend/src/config/env.ts`

- [ ] **Step 1: Add 3 Yousign env vars to `env.ts`**

Add at the end of the `env` object (after the `CLIENT_URL` entry):

```typescript
  // Yousign (digital signatures — optional in dev, empty string disables)
  get YOUSIGN_API_KEY() { return process.env.YOUSIGN_API_KEY || ""; },
  get YOUSIGN_BASE_URL() { return process.env.YOUSIGN_BASE_URL || "https://api.yousign.app/v3"; },
  get YOUSIGN_WEBHOOK_SECRET() { return process.env.YOUSIGN_WEBHOOK_SECRET || ""; },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/env.ts
git commit -m "feat(config): add Yousign env vars"
```

---

## Task 3: Yousign Service (TDD)

**Files:**
- Create: `backend/src/services/yousign.service.ts`
- Create: `backend/src/test/yousign.service.test.ts`

### Background

`yousign.service.ts` wraps the Yousign REST API v3 using `fetch`. All functions throw `AppError(502, ...)` for network errors or non-2xx responses. Key note: `YOUSIGN_BASE_URL` defaults to `https://api.yousign.app/v3` (production). Use `https://api-sandbox.yousign.app/v3` in `.env` for development/testing.

- [ ] **Step 1: Write the failing tests in `backend/src/test/yousign.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mockFetch so vi.mock factories can reference it
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.stubGlobal("fetch", mockFetch);

vi.mock("../config/env.js", () => ({
  env: {
    YOUSIGN_API_KEY: "test-api-key",
    YOUSIGN_BASE_URL: "https://api-sandbox.yousign.app/v3",
  },
}));

import {
  uploadDocument,
  createSignatureRequest,
  activateRequest,
  getSignedDocument,
} from "../services/yousign.service.js";

describe("yousign.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("uploadDocument", () => {
    it("returns document id on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "doc_123" }),
      });
      const result = await uploadDocument(Buffer.from("pdf content"), "test.pdf");
      expect(result).toBe("doc_123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api-sandbox.yousign.app/v3/documents",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws AppError(502) when Yousign returns non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, text: async () => "Bad Request" });
      await expect(uploadDocument(Buffer.from("pdf"), "test.pdf")).rejects.toMatchObject({
        statusCode: 502,
      });
    });
  });

  describe("createSignatureRequest", () => {
    it("returns signature request id on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "req_456" }),
      });
      const signer = { email: "mieter@example.com", firstName: "Max", lastName: "Müller" };
      const result = await createSignatureRequest("doc_123", signer, 42);
      expect(result).toBe("req_456");
    });
  });

  describe("activateRequest", () => {
    it("resolves without error on success", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await expect(activateRequest("req_456")).resolves.toBeUndefined();
    });
  });

  describe("getSignedDocument", () => {
    it("returns PDF buffer on success", async () => {
      const fakeBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBytes.buffer,
      });
      const buf = await getSignedDocument("req_456", "doc_789");
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf[0]).toBe(0x25); // '%' — confirms it's the PDF magic bytes
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they all FAIL (service file doesn't exist yet)**

```bash
cd backend
npm test yousign.service
```

Expected: All 4 tests FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Create `backend/src/services/yousign.service.ts`**

```typescript
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

function yousignHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.YOUSIGN_API_KEY}`,
  };
}

export async function uploadDocument(pdfBuffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), filename);
  form.append("nature", "signable_document");

  let res: Response;
  try {
    res = await fetch(`${env.YOUSIGN_BASE_URL}/documents`, {
      method: "POST",
      headers: yousignHeaders(),
      body: form,
    });
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(502, `Yousign Fehler: ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

interface Signer {
  email: string;
  firstName: string;
  lastName: string;
}

export async function createSignatureRequest(
  documentId: string,
  signer: Signer,
  contractId: number,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests`, {
      method: "POST",
      headers: { ...yousignHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mietvertrag",
        documents: [{ document_id: documentId }],
        signers: [
          {
            info: {
              email: signer.email,
              first_name: signer.firstName,
              last_name: signer.lastName,
            },
            signature_level: "electronic_signature",
            fields: [
              {
                type: "signature",
                document_id: documentId,
                page: 1,
                x: 150,
                y: 700,
                width: 200,
                height: 50,
              },
            ],
          },
        ],
        external_id: String(contractId),
      }),
    });
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(502, `Yousign Fehler: ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function activateRequest(signatureRequestId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/activate`,
      {
        method: "POST",
        headers: { ...yousignHeaders(), "Content-Type": "application/json" },
      },
    );
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(502, `Yousign Fehler: ${body}`);
  }
}

export async function getSignedDocument(
  signatureRequestId: string,
  documentId: string,
): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(
      `${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/documents/${documentId}/download`,
      { headers: yousignHeaders() },
    );
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    throw new AppError(502, "Signiertes Dokument nicht verfügbar");
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

- [ ] **Step 4: Run tests to verify they all PASS**

```bash
cd backend
npm test yousign.service
```

Expected: 4/4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/yousign.service.ts backend/src/test/yousign.service.test.ts
git commit -m "feat(yousign): add Yousign service with uploadDocument, createSignatureRequest, activateRequest, getSignedDocument"
```

---

## Task 4: Yousign Webhook Handler (TDD)

**Files:**
- Create: `backend/src/routes/yousign-webhook.routes.ts`
- Create: `backend/src/test/yousign-webhook.test.ts`

### Background

The webhook handler:
1. Validates HMAC-SHA256 signature from the `X-Yousign-Signature-256` header against `YOUSIGN_WEBHOOK_SECRET`. **Note during implementation:** If the Yousign sandbox sends a different header name (e.g. `X-Yousign-Signature`), update the header lookup here. Use `crypto.timingSafeEqual` for the comparison.
2. Parses the raw Buffer body as JSON.
3. Handles 3 event types, identifying the contract by `event.data.object.external_id` (set to `contractId` when creating the signature request).
4. Uses `prisma.contract.updateMany` (not `update`) to avoid throwing if the contractId doesn't exist (defensive — webhook must always return 200).

- [ ] **Step 1: Write failing tests in `backend/src/test/yousign-webhook.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import crypto from "crypto";

const { mockUpdateMany } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { contract: { updateMany: mockUpdateMany } },
}));

vi.mock("../config/env.js", () => ({
  env: { YOUSIGN_WEBHOOK_SECRET: "test-webhook-secret" },
}));

import { yousignWebhookHandler } from "../routes/yousign-webhook.routes.js";

function makeHmacHeader(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
}

function makeReq(body: object, sig?: string): Partial<Request> {
  const bodyStr = JSON.stringify(body);
  const signature = sig ?? makeHmacHeader(bodyStr, "test-webhook-secret");
  return {
    body: Buffer.from(bodyStr),
    headers: { "x-yousign-signature-256": signature },
  } as Partial<Request>;
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
}

describe("yousignWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 on invalid HMAC signature", async () => {
    const req = makeReq(
      { type: "signature_request.done", data: { object: {} } },
      "bad-signature",
    );
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("sets signatureStatus=ABGESCHLOSSEN, status=AKTIV, saves document ids on signature_request.done", async () => {
    mockUpdateMany.mockResolvedValueOnce({});
    const event = {
      type: "signature_request.done",
      data: {
        object: {
          id: "req_123",
          external_id: "42",
          documents: [{ id: "doc_456", signed_file_url: "https://example.com/signed.pdf" }],
        },
      },
    };
    const req = makeReq(event);
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({
        signatureStatus: "ABGESCHLOSSEN",
        status: "AKTIV",
        signedDocumentId: "doc_456",
        signedDocumentUrl: "https://example.com/signed.pdf",
      }),
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("sets signatureStatus=ABGELEHNT on signature_request.declined", async () => {
    mockUpdateMany.mockResolvedValueOnce({});
    const event = {
      type: "signature_request.declined",
      data: { object: { external_id: "10" } },
    };
    const req = makeReq(event);
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { signatureStatus: "ABGELEHNT" },
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("sets signatureStatus=ABGELAUFEN on signature_request.expired", async () => {
    mockUpdateMany.mockResolvedValueOnce({});
    const event = {
      type: "signature_request.expired",
      data: { object: { external_id: "7" } },
    };
    const req = makeReq(event);
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { signatureStatus: "ABGELAUFEN" },
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
cd backend
npm test yousign-webhook
```

Expected: All 4 tests FAIL with "Cannot find module".

- [ ] **Step 3: Create `backend/src/routes/yousign-webhook.routes.ts`**

```typescript
import type { Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

function validateHmac(body: Buffer, header: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.YOUSIGN_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  try {
    // timingSafeEqual throws RangeError when buffer lengths differ (e.g. truncated/malformed
    // signatures). The catch intentionally returns false in that case.
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

export async function yousignWebhookHandler(req: Request, res: Response): Promise<void> {
  // Note: Verify exact header name against Yousign sandbox during first integration test.
  // Yousign may send "X-Yousign-Signature" or "X-Yousign-Signature-256".
  const sig = req.headers["x-yousign-signature-256"] as string | undefined;

  if (!sig || !validateHmac(req.body as Buffer, sig)) {
    logger.warn("Yousign webhook: invalid signature");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const event = JSON.parse((req.body as Buffer).toString()) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  if (event.type === "signature_request.done") {
    const obj = event.data.object as {
      external_id?: string;
      documents?: Array<{ id: string; signed_file_url?: string }>;
    };
    const contractId = obj.external_id ? parseInt(obj.external_id, 10) : null;
    if (contractId) {
      const doc = obj.documents?.[0];
      await prisma.contract.updateMany({
        where: { id: contractId },
        data: {
          signatureStatus: "ABGESCHLOSSEN",
          status: "AKTIV",
          signedDocumentId: doc?.id ?? null,
          signedDocumentUrl: doc?.signed_file_url ?? null,
        },
      });
    }
  } else if (event.type === "signature_request.declined") {
    const obj = event.data.object as { external_id?: string };
    const contractId = obj.external_id ? parseInt(obj.external_id, 10) : null;
    if (contractId) {
      await prisma.contract.updateMany({
        where: { id: contractId },
        data: { signatureStatus: "ABGELEHNT" },
      });
    }
  } else if (event.type === "signature_request.expired") {
    const obj = event.data.object as { external_id?: string };
    const contractId = obj.external_id ? parseInt(obj.external_id, 10) : null;
    if (contractId) {
      await prisma.contract.updateMany({
        where: { id: contractId },
        data: { signatureStatus: "ABGELAUFEN" },
      });
    }
  }

  res.sendStatus(200);
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
cd backend
npm test yousign-webhook
```

Expected: 4/4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/yousign-webhook.routes.ts backend/src/test/yousign-webhook.test.ts
git commit -m "feat(yousign): webhook handler with HMAC validation and event processing"
```

---

## Task 5: Signature Schema, Controller, and Routes

**Files:**
- Create: `backend/src/schemas/signature.schema.ts`
- Create: `backend/src/controllers/signature.controller.ts`
- Create: `backend/src/routes/signature.routes.ts`

### Background

**PDF Buffer creation:** `createPdfResponse` in `src/lib/pdf.ts` streams directly to an Express `Response` and cannot be reused here. Instead, `sendForSignature` uses a local helper `renderToPdfBuffer(text)` that creates a pdfkit `PDFDocument`, collects chunk events into a `Buffer[]`, and resolves after the `end` event. pdfkit is already a dependency.

**Signer info fallback:** If `signerEmail`/`signerName` are not in the request body, they fall back to `contract.tenant.email` and `contract.tenant.firstName + lastName`. If the tenant has no email, throw `AppError(400, ...)`.

**Name splitting:** The `signerName` is split on the first space: `firstName = parts[0]`, `lastName = parts.slice(1).join(" ") || parts[0]` (handles single-word names by duplicating as lastName).

- [ ] **Step 1: Create `backend/src/schemas/signature.schema.ts`**

```typescript
import { z } from "zod";

export const sendForSignatureSchema = z.object({
  templateId: z.number().int().positive(),
  signerEmail: z.string().email().optional(),
  signerName: z.string().min(1).optional(),
});
```

- [ ] **Step 2: Create `backend/src/controllers/signature.controller.ts`**

```typescript
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { renderTemplate } from "../services/document-template.service.js";
import {
  uploadDocument,
  createSignatureRequest,
  activateRequest,
  getSignedDocument,
} from "../services/yousign.service.js";
import { sendForSignatureSchema } from "../schemas/signature.schema.js";

async function renderToPdfBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(11).text(text, { lineGap: 4 });
    doc.end();
  });
}

export async function sendForSignature(req: Request, res: Response): Promise<void> {
  const contractId = parseInt(req.params.id, 10);
  const { templateId, signerEmail, signerName } = sendForSignatureSchema.parse(req.body);

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId: req.companyId },
    include: { tenant: true },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");

  if (contract.signatureStatus === "AUSSTEHEND") {
    throw new AppError(409, "Unterschrift bereits angefordert");
  }

  const rendered = await renderTemplate(req.companyId, templateId, {
    contract,
    tenant: contract.tenant,
  });

  const pdfBuffer = await renderToPdfBuffer(rendered);

  const email = signerEmail ?? contract.tenant.email;
  const name = signerName ?? `${contract.tenant.firstName} ${contract.tenant.lastName}`;
  if (!email) throw new AppError(400, "Keine E-Mail-Adresse für Mieter vorhanden");

  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || parts[0];

  const documentId = await uploadDocument(pdfBuffer, `Mietvertrag-${contractId}.pdf`);
  const signatureRequestId = await createSignatureRequest(
    documentId,
    { email, firstName, lastName },
    contractId,
  );
  await activateRequest(signatureRequestId);

  await prisma.contract.update({
    where: { id: contractId },
    data: { signatureStatus: "AUSSTEHEND", signatureRequestId },
  });

  res.json({ data: { signatureRequestId, status: "AUSSTEHEND" } });
}

export async function getSignatureStatus(req: Request, res: Response): Promise<void> {
  const contractId = parseInt(req.params.id, 10);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId: req.companyId },
    select: { signatureStatus: true, signatureRequestId: true },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");
  res.json({ data: { signatureStatus: contract.signatureStatus } });
}

export async function downloadSignedDocument(req: Request, res: Response): Promise<void> {
  const contractId = parseInt(req.params.id, 10);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId: req.companyId },
    select: {
      signedDocumentId: true,
      signatureRequestId: true,
      signatureStatus: true,
    },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");

  if (!contract.signedDocumentId || !contract.signatureRequestId) {
    throw new AppError(409, "Dokument noch nicht verfügbar");
  }

  const pdfBuffer = await getSignedDocument(
    contract.signatureRequestId,
    contract.signedDocumentId,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Mietvertrag-${contractId}-signed.pdf"`,
  );
  res.send(pdfBuffer);
}
```

- [ ] **Step 3: Create `backend/src/routes/signature.routes.ts`**

```typescript
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/signature.controller.js";

// mergeParams: true so ":id" from the parent contract route is accessible
const router = Router({ mergeParams: true });

router.post(
  "/",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }),
  ctrl.sendForSignature,
);
router.get("/", validate({ params: idParamSchema }), ctrl.getSignatureStatus);
router.get("/document", validate({ params: idParamSchema }), ctrl.downloadSignedDocument);

export { router as signatureRouter };
```

- [ ] **Step 4: Write controller test for 409 idempotency guard**

Create `backend/src/test/signature.controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { contract: { findFirst: mockFindFirst, update: mockUpdate } },
}));

// Mock Yousign service — should NOT be called when guard fires
vi.mock("../services/yousign.service.js", () => ({
  uploadDocument: vi.fn(),
  createSignatureRequest: vi.fn(),
  activateRequest: vi.fn(),
  getSignedDocument: vi.fn(),
}));

// Mock document-template service
vi.mock("../services/document-template.service.js", () => ({
  renderTemplate: vi.fn(),
}));

import { sendForSignature } from "../controllers/signature.controller.js";
import { uploadDocument } from "../services/yousign.service.js";

function makeReq(body: object, params = { id: "1" }): Partial<Request> {
  return { body, params, companyId: 1 } as unknown as Partial<Request>;
}

function makeRes() {
  return {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
}

describe("sendForSignature controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 409 when contract.signatureStatus is AUSSTEHEND", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      companyId: 1,
      signatureStatus: "AUSSTEHEND",
      tenant: { email: "mieter@test.de", firstName: "Max", lastName: "Müller" },
    });

    const req = makeReq({ templateId: 1 });
    const res = makeRes();

    await expect(
      sendForSignature(req as Request, res as unknown as Response),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(uploadDocument).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run the controller test to verify it FAILS (no implementation yet)**

```bash
cd backend
npm test signature.controller
```

Expected: FAIL because controller file doesn't exist yet (or test passes immediately if controller is already created — that is fine, skip this step in that case).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors. If pdfkit types are missing, install: `npm install --save-dev @types/pdfkit` (check if already present with `ls node_modules/@types/pdfkit`).

- [ ] **Step 7: Run all new tests**

```bash
cd backend
npm test -- signature.controller yousign.service yousign-webhook
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/signature.schema.ts \
        backend/src/controllers/signature.controller.ts \
        backend/src/routes/signature.routes.ts \
        backend/src/test/signature.controller.test.ts
git commit -m "feat(signature): controller, routes, and controller unit tests"
```

---

## Task 6: Wire Up — app.ts + routes/index.ts

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/index.ts`

### Background

**Critical ordering:** The Yousign webhook route must be registered in `app.ts` BEFORE `app.use(express.json())`, using `express.raw({ type: "application/json" })` so the body arrives as a `Buffer`. This is the same pattern already used for the Stripe webhook.

In `routes/index.ts`, the signature router is mounted at `/contracts/:id/signature`. The `:id` param is accessible in the router because `mergeParams: true` is set on `signatureRouter`.

- [ ] **Step 1: Add Yousign webhook import and registration in `backend/src/app.ts`**

Add the import after the Stripe webhook import (top of file):

```typescript
import { yousignWebhookHandler } from "./routes/yousign-webhook.routes.js";
```

Add the route registration immediately after the Stripe webhook line (before `app.use(cors(corsOptions))`):

```typescript
// Yousign webhook — raw body MUST be registered BEFORE express.json()
app.post("/api/webhooks/yousign", express.raw({ type: "application/json" }), yousignWebhookHandler);
```

- [ ] **Step 2: Add signatureRouter to `backend/src/routes/index.ts`**

Add import at the end of the import block:

```typescript
import { signatureRouter } from "./signature.routes.js";
```

Add route registration after the contracts router line. **Important:** only the POST (send for signature) requires `subscriptionGuard`. The two GET routes must remain accessible even when subscription is locked, so the guard is applied inside the router itself via `requireRole`, not at the mount level.

```typescript
router.use("/contracts/:id/signature", requireAuth, tenantGuard, signatureRouter);
```

(Place it directly after `router.use("/contracts", requireAuth, tenantGuard, subscriptionGuard, contractRouter);`)

Then update `backend/src/routes/signature.routes.ts` to apply `subscriptionGuard` only on the POST route:

```typescript
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { subscriptionGuard } from "../middleware/subscriptionGuard.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/signature.controller.js";

const router = Router({ mergeParams: true });

router.post(
  "/",
  subscriptionGuard,
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }),
  ctrl.sendForSignature,
);
router.get("/", validate({ params: idParamSchema }), ctrl.getSignatureStatus);
router.get("/document", validate({ params: idParamSchema }), ctrl.downloadSignedDocument);

export { router as signatureRouter };
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run all tests**

```bash
cd backend
npm test
```

Expected: All existing tests still pass. The 8 new tests (4 yousign.service + 4 yousign-webhook) also pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/routes/index.ts
git commit -m "feat(signature): wire up Yousign webhook + signature routes in app.ts and index.ts"
```

---

## Task 7: Manual Smoke Test

### Background

This task verifies the end-to-end flow locally. You need a Yousign sandbox account and API key. The sandbox URL is `https://api-sandbox.yousign.app/v3`.

- [ ] **Step 1: Add sandbox credentials to `backend/.env`**

```
YOUSIGN_API_KEY=your_sandbox_api_key_here
YOUSIGN_BASE_URL=https://api-sandbox.yousign.app/v3
YOUSIGN_WEBHOOK_SECRET=any_test_secret_for_now
```

- [ ] **Step 2: Start the backend**

```bash
cd backend
docker-compose up -d   # ensure PostgreSQL is running
npm run dev
```

- [ ] **Step 3: Create a DocumentTemplate via API (or Prisma Studio)**

Using Prisma Studio (`npm run db:studio`) or curl, create a template with content like:
```
Mietvertrag für {{tenant.firstName}} {{tenant.lastName}}
Adresse: {{contract.notes}}
```

Note the template `id`.

- [ ] **Step 4: Send contract for signature via POST**

```bash
curl -X POST http://localhost:3001/api/contracts/1/signature \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"templateId": 1}'
```

Expected: `{ "data": { "signatureRequestId": "req_...", "status": "AUSSTEHEND" } }`

Check DB: contract has `signature_status = AUSSTEHEND`, `signature_request_id` populated.

- [ ] **Step 5: Verify GET signature status**

```bash
curl http://localhost:3001/api/contracts/1/signature \
  -H "Authorization: Bearer <your_jwt_token>"
```

Expected: `{ "data": { "signatureStatus": "AUSSTEHEND" } }`

- [ ] **Step 6: Verify 409 on duplicate send**

```bash
curl -X POST http://localhost:3001/api/contracts/1/signature \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"templateId": 1}'
```

Expected: HTTP 409 `{ "error": "Unterschrift bereits angefordert" }`

- [ ] **Step 7: Commit final state**

No code changes expected. If any minor fixes were needed during smoke testing, commit them:

```bash
git add -p   # add only relevant fixes
git commit -m "fix(signature): smoke test fixes"
```

---

## Frontend — ⚠️ NOT IMPLEMENTED

The frontend for digital signatures is intentionally not part of this implementation. The following items remain as open TODOs for a future frontend task:

- [ ] Button "Zur Unterschrift senden" on the Contracts page / Contract detail page
- [ ] Template selection dialog (which DocumentTemplate to render)
- [ ] `SignatureStatus` badge on the Contract card (AUSSTEHEND / ABGESCHLOSSEN / ABGELEHNT / ABGELAUFEN)
- [ ] Download button for the signed PDF (calls `GET /api/contracts/:id/signature/document`)
- [ ] Error toast for 409 (already pending)
- [ ] Error toast for 400 (no email on tenant)

---

## PROJEKTDOKUMENTATION.md Update

After all tasks are complete, update `PROJEKTDOKUMENTATION.md` to document:
- New endpoints: `POST/GET /api/contracts/:id/signature`, `GET /api/contracts/:id/signature/document`, `POST /api/webhooks/yousign`
- New env vars: `YOUSIGN_API_KEY`, `YOUSIGN_BASE_URL`, `YOUSIGN_WEBHOOK_SECRET`
- New Prisma fields: `SignatureStatus` enum, 4 fields on Contract
- Frontend status: not yet implemented (open TODO)
