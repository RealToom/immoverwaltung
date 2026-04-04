# Tenant Portal — Implementierungsplan Teil 2: Backend API-Endpunkte

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Tenant-API-Endpunkte: Stammdaten, Dokumente + Signatur, Upload, Tickets, Finanzen, Nachrichten.

**Voraussetzung:** Teil 1 muss abgeschlossen sein (DB-Migrationen, TenantUser-Auth laufen).

**Architecture:** Ein zentraler Router `/api/tenant/:slug/*` mit `requireTenantAuth` auf allen geschützten Routen. Services nutzen `tenantUser.id`, `tenantUser.tenantId`, `tenantUser.companyId` aus dem JWT für strikte Datenisolation.

**Tech Stack:** Express 5, Prisma 6, Zod, multer (bereits vorhanden), vitest

---

## Dateiübersicht Teil 2

| Aktion | Datei |
|--------|-------|
| Create | `backend/src/schemas/tenant.schema.ts` |
| Create | `backend/src/services/tenant.service.ts` |
| Create | `backend/src/controllers/tenant.controller.ts` |
| Create | `backend/src/routes/tenantPortal.routes.ts` |
| Create | `backend/src/middleware/tenantUpload.ts` |
| Modify | `backend/src/routes/index.ts` |
| Create | `backend/src/test/tenant.service.test.ts` |

---

## Task 8: Zod Schemas für Tenant-API

**Files:**
- Create: `backend/src/schemas/tenant.schema.ts`

- [ ] **Step 1: Schemas erstellen**

Erstelle `backend/src/schemas/tenant.schema.ts`:

```typescript
import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateMeSchema = z.object({
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
});

export const createTicketSchema = z.object({
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
  description: z.string().min(10, "Beschreibung muss mindestens 10 Zeichen lang sein").max(2000),
  category: z.enum([
    "SANITAER",
    "ELEKTRO",
    "HEIZUNG",
    "FENSTER_TUEREN",
    "SONSTIGES",
  ]),
});

export const createMessageSchema = z.object({
  body: z.string().min(1, "Nachricht darf nicht leer sein").max(5000),
});

export const signDocumentSchema = z.object({
  type: z.enum(["SIMPLE", "SIGNATURE_PAD"]),
  signatureData: z.string().optional(),
});

export const uploadCategorySchema = z.object({
  category: z
    .enum([
      "einkommensnachweis",
      "sepa_mandat",
      "personalausweis",
      "sonstiges",
    ])
    .default("sonstiges"),
  description: z.string().max(500).optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/schemas/tenant.schema.ts
git commit -m "feat(tenant): Zod schemas for tenant API"
```

---

## Task 9: Tenant Service

**Files:**
- Create: `backend/src/services/tenant.service.ts`
- Create: `backend/src/test/tenant.service.test.ts`

- [ ] **Step 1: Failing tests schreiben**

Erstelle `backend/src/test/tenant.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenantUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    maintenanceTicket: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    rentPayment: {
      findMany: vi.fn(),
    },
    tenantMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    tenantUpload: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";
import {
  getMe,
  getDocuments,
  signDocument,
  getTickets,
  createTicket,
  getFinances,
  getMessages,
  createMessage,
} from "../services/tenant.service.js";

const mockTenantUser = { id: 1, tenantId: 10, companyId: 3 };

describe("tenant.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMe", () => {
    it("returns tenant user with tenant data", async () => {
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
        id: 1,
        email: "max@example.de",
        lastLoginAt: null,
        tenant: {
          id: 10,
          name: "Max Mustermann",
          phone: "+49 171 123",
          units: [{ id: 1, number: "3 OG", floor: 3, area: 65, rent: 720, property: { street: "Hauptstr. 12", zip: "80333", city: "München" } }],
          contracts: [{ id: 1, monthlyRent: 850, status: "AKTIV", startDate: new Date("2024-01-15") }],
        },
      } as any);

      const result = await getMe(mockTenantUser);

      expect(result.email).toBe("max@example.de");
      expect(result.tenant.name).toBe("Max Mustermann");
      expect(result.tenant.units).toHaveLength(1);
    });

    it("throws NotFoundError when tenantUser not found", async () => {
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce(null);
      await expect(getMe(mockTenantUser)).rejects.toThrow("Benutzer nicht gefunden");
    });
  });

  describe("getDocuments", () => {
    it("returns documents filtered by tenantId and companyId", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValueOnce([
        { id: 1, name: "Mietvertrag.pdf", fileType: "application/pdf", fileSize: "2.4 MB", requiresSignature: false, signedAt: null, signatureType: null, createdAt: new Date() },
      ] as any);

      const docs = await getDocuments(mockTenantUser);
      expect(docs).toHaveLength(1);
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 10, companyId: 3 },
        })
      );
    });
  });

  describe("signDocument", () => {
    it("marks document as signed with SIMPLE type", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
        id: 5,
        tenantId: 10,
        companyId: 3,
        requiresSignature: true,
        signedAt: null,
        signatureType: "SIMPLE",
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValueOnce({} as any);

      await signDocument(mockTenantUser, 5, "SIMPLE");

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            signedAt: expect.any(Date),
            signedByTenantUserId: 1,
          }),
        })
      );
    });

    it("throws NotFoundError when document not found for this tenant", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(null);
      await expect(signDocument(mockTenantUser, 99, "SIMPLE")).rejects.toThrow(
        "Dokument nicht gefunden"
      );
    });

    it("throws BadRequestError when document already signed", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
        id: 5,
        tenantId: 10,
        companyId: 3,
        requiresSignature: true,
        signedAt: new Date(),
      } as any);
      await expect(signDocument(mockTenantUser, 5, "SIMPLE")).rejects.toThrow(
        "Dokument bereits unterzeichnet"
      );
    });
  });

  describe("getTickets", () => {
    it("returns maintenance tickets for tenant's units", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        units: [{ id: 1 }, { id: 2 }],
      } as any);
      vi.mocked(prisma.maintenanceTicket.findMany).mockResolvedValueOnce([
        { id: 1, title: "Heizung defekt", status: "OFFEN", category: "HEIZUNG", createdAt: new Date() },
      ] as any);

      const tickets = await getTickets(mockTenantUser);
      expect(tickets).toHaveLength(1);
    });
  });

  describe("createTicket", () => {
    it("creates a maintenance ticket for the tenant's first active unit", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        units: [{ id: 1, propertyId: 5 }],
      } as any);
      vi.mocked(prisma.maintenanceTicket.create).mockResolvedValueOnce({
        id: 99,
        title: "Wasserhahn tropft",
      } as any);

      const ticket = await createTicket(mockTenantUser, {
        title: "Wasserhahn tropft",
        description: "Der Wasserhahn im Bad tropft seit 3 Tagen",
        category: "SANITAER",
      });

      expect(ticket.title).toBe("Wasserhahn tropft");
      expect(prisma.maintenanceTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 3,
            unitId: 1,
            propertyId: 5,
          }),
        })
      );
    });
  });

  describe("getFinances", () => {
    it("returns rent payments for tenant's contracts", async () => {
      vi.mocked(prisma.rentPayment.findMany).mockResolvedValueOnce([
        { id: 1, month: new Date("2026-04-01"), amountDue: 850, amountPaid: 850, status: "PUENKTLICH", dueDate: new Date("2026-04-01"), paidDate: new Date("2026-04-01") },
      ] as any);

      const result = await getFinances(mockTenantUser);
      expect(result.payments).toHaveLength(1);
      expect(result.payments[0].status).toBe("PUENKTLICH");
    });
  });

  describe("getMessages", () => {
    it("returns messages for this tenantUser", async () => {
      vi.mocked(prisma.tenantMessage.findMany).mockResolvedValueOnce([
        { id: 1, body: "Hallo!", direction: "ADMIN_TO_TENANT", createdAt: new Date(), readAt: null },
      ] as any);

      const messages = await getMessages(mockTenantUser);
      expect(messages).toHaveLength(1);
    });
  });

  describe("createMessage", () => {
    it("creates a message from tenant to admin", async () => {
      vi.mocked(prisma.tenantMessage.create).mockResolvedValueOnce({
        id: 10,
        body: "Ich habe eine Frage",
        direction: "TENANT_TO_ADMIN",
        createdAt: new Date(),
        readAt: null,
      } as any);

      const msg = await createMessage(mockTenantUser, "Ich habe eine Frage");
      expect(msg.direction).toBe("TENANT_TO_ADMIN");
    });
  });
});
```

- [ ] **Step 2: Tests ausführen (müssen fehlschlagen)**

```bash
cd backend
npx vitest run src/test/tenant.service.test.ts
```

Erwartete Ausgabe: FAIL — `Cannot find module '../services/tenant.service.js'`

- [ ] **Step 3: tenant.service.ts implementieren**

Erstelle `backend/src/services/tenant.service.ts`:

```typescript
import { prisma } from "../lib/prisma.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../lib/errors.js";
import type { TenantUser } from "../middleware/tenantAuth.js";

// ─── Me ───────────────────────────────────────────────────────────────────────

export async function getMe(tenantUser: TenantUser) {
  const user = await prisma.tenantUser.findUnique({
    where: { id: tenantUser.id },
    select: {
      id: true,
      email: true,
      lastLoginAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          phone: true,
          moveIn: true,
          units: {
            select: {
              id: true,
              number: true,
              floor: true,
              area: true,
              rent: true,
              type: true,
              property: {
                select: { street: true, zip: true, city: true, name: true },
              },
            },
          },
          contracts: {
            where: { status: "AKTIV" },
            select: {
              id: true,
              monthlyRent: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      },
    },
  });

  if (!user) throw new NotFoundError("Benutzer nicht gefunden");
  return user;
}

export async function updateMe(
  tenantUser: TenantUser,
  data: { phone?: string; email?: string }
) {
  // Only update the underlying Tenant record (not TenantUser.email for now)
  await prisma.tenant.update({
    where: { id: tenantUser.tenantId },
    data: {
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    },
  });

  if (data.email) {
    // Check uniqueness within company before updating
    const existing = await prisma.tenantUser.findFirst({
      where: { email: data.email, companyId: tenantUser.companyId, id: { not: tenantUser.id } },
    });
    if (existing) throw new BadRequestError("E-Mail-Adresse bereits vergeben");

    await prisma.tenantUser.update({
      where: { id: tenantUser.id },
      data: { email: data.email },
    });
  }

  return getMe(tenantUser);
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(tenantUser: TenantUser) {
  return prisma.document.findMany({
    where: { tenantId: tenantUser.tenantId, companyId: tenantUser.companyId },
    select: {
      id: true,
      name: true,
      fileType: true,
      fileSize: true,
      filePath: true,
      requiresSignature: true,
      signatureType: true,
      signedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function signDocument(
  tenantUser: TenantUser,
  documentId: number,
  type: "SIMPLE" | "SIGNATURE_PAD",
  signatureData?: string
) {
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      tenantId: tenantUser.tenantId,
      companyId: tenantUser.companyId,
    },
  });

  if (!doc) throw new NotFoundError("Dokument nicht gefunden");
  if (!doc.requiresSignature) throw new BadRequestError("Dokument erfordert keine Unterschrift");
  if (doc.signedAt) throw new BadRequestError("Dokument bereits unterzeichnet");
  if (type === "SIGNATURE_PAD" && !signatureData) {
    throw new BadRequestError("Signaturdaten fehlen");
  }

  return prisma.document.update({
    where: { id: documentId },
    data: {
      signedAt: new Date(),
      signedByTenantUserId: tenantUser.id,
      signatureData: signatureData ?? null,
    },
    select: { id: true, name: true, signedAt: true },
  });
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export async function getUploads(tenantUser: TenantUser) {
  return prisma.tenantUpload.findMany({
    where: { tenantUserId: tenantUser.id, companyId: tenantUser.companyId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      category: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUpload(
  tenantUser: TenantUser,
  file: Express.Multer.File,
  category: string,
  description?: string
) {
  return prisma.tenantUpload.create({
    data: {
      companyId: tenantUser.companyId,
      tenantUserId: tenantUser.id,
      filename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: file.path,
      category,
      description: description ?? null,
    },
    select: {
      id: true,
      filename: true,
      category: true,
      createdAt: true,
    },
  });
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export async function getTickets(tenantUser: TenantUser) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantUser.tenantId },
    select: { units: { select: { id: true } } },
  });

  const unitIds = tenant?.units.map((u) => u.id) ?? [];

  return prisma.maintenanceTicket.findMany({
    where: {
      companyId: tenantUser.companyId,
      unitId: { in: unitIds },
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      unit: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTicket(
  tenantUser: TenantUser,
  data: { title: string; description: string; category: string },
  photoPath?: string
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantUser.tenantId },
    select: { units: { select: { id: true, propertyId: true } } },
  });

  const unit = tenant?.units[0];
  if (!unit) throw new BadRequestError("Keine aktive Einheit gefunden");

  return prisma.maintenanceTicket.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category as any,
      priority: "MITTEL",
      status: "OFFEN",
      companyId: tenantUser.companyId,
      propertyId: unit.propertyId,
      unitId: unit.id,
    },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      createdAt: true,
    },
  });
}

// ─── Finances ─────────────────────────────────────────────────────────────────

export async function getFinances(tenantUser: TenantUser) {
  const payments = await prisma.rentPayment.findMany({
    where: {
      companyId: tenantUser.companyId,
      contract: { tenantId: tenantUser.tenantId },
    },
    select: {
      id: true,
      month: true,
      amountDue: true,
      amountPaid: true,
      status: true,
      dueDate: true,
      paidDate: true,
      contract: {
        select: { monthlyRent: true, unit: { select: { number: true } } },
      },
    },
    orderBy: { month: "desc" },
    take: 24,
  });

  // Next upcoming payment (AUSSTEHEND with future dueDate)
  const nextPayment = payments.find(
    (p) => p.status === "AUSSTEHEND" && p.dueDate >= new Date()
  ) ?? null;

  return { payments, nextPayment };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(tenantUser: TenantUser) {
  // Mark unread ADMIN_TO_TENANT messages as read
  await prisma.tenantMessage.updateMany({
    where: {
      tenantUserId: tenantUser.id,
      direction: "ADMIN_TO_TENANT",
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return prisma.tenantMessage.findMany({
    where: { tenantUserId: tenantUser.id, companyId: tenantUser.companyId },
    select: {
      id: true,
      direction: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMessage(tenantUser: TenantUser, body: string) {
  return prisma.tenantMessage.create({
    data: {
      companyId: tenantUser.companyId,
      tenantUserId: tenantUser.id,
      direction: "TENANT_TO_ADMIN",
      body,
    },
    select: {
      id: true,
      direction: true,
      body: true,
      createdAt: true,
      readAt: true,
    },
  });
}
```

- [ ] **Step 4: Tests ausführen (müssen bestehen)**

```bash
cd backend
npx vitest run src/test/tenant.service.test.ts
```

Erwartete Ausgabe:
```
✓ src/test/tenant.service.test.ts (10 tests)
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/tenant.service.ts backend/src/test/tenant.service.test.ts
git commit -m "feat(tenant): tenant service — me, documents, sign, uploads, tickets, finances, messages"
```

---

## Task 10: Tenant Upload Middleware

**Files:**
- Create: `backend/src/middleware/tenantUpload.ts`

- [ ] **Step 1: tenantUpload.ts erstellen**

Erstelle `backend/src/middleware/tenantUpload.ts`:

```typescript
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const companyId = req.companyId ?? "unknown";
    const tenantUserId = req.tenantUser?.id ?? "unknown";
    const dir = path.join(
      env.UPLOAD_DIR,
      String(companyId),
      "tenant-uploads",
      String(tenantUserId)
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = MIME_TO_EXT[file.mimetype] ?? ".bin";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (MIME_TO_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Nicht unterstuetzter Dateityp. Erlaubt: PDF, JPG, PNG"));
  }
}

export const tenantUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/tenantUpload.ts
git commit -m "feat(tenant): tenant file upload middleware"
```

---

## Task 11: Tenant Controller

**Files:**
- Create: `backend/src/controllers/tenant.controller.ts`

- [ ] **Step 1: Controller erstellen**

Erstelle `backend/src/controllers/tenant.controller.ts`:

```typescript
import type { Request, Response } from "express";
import * as tenantService from "../services/tenant.service.js";
import { BadRequestError } from "../lib/errors.js";

// ─── Me ───────────────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  const data = await tenantService.getMe(req.tenantUser!);
  res.json({ data });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const data = await tenantService.updateMe(
    req.tenantUser!,
    req.body as { phone?: string; email?: string }
  );
  res.json({ data });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(req: Request, res: Response): Promise<void> {
  const data = await tenantService.getDocuments(req.tenantUser!);
  res.json({ data });
}

export async function signDocument(req: Request, res: Response): Promise<void> {
  const documentId = Number(req.params.id);
  const { type, signatureData } = req.body as {
    type: "SIMPLE" | "SIGNATURE_PAD";
    signatureData?: string;
  };
  const data = await tenantService.signDocument(
    req.tenantUser!,
    documentId,
    type,
    signatureData
  );
  res.json({ data });
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export async function getUploads(req: Request, res: Response): Promise<void> {
  const data = await tenantService.getUploads(req.tenantUser!);
  res.json({ data });
}

export async function createUpload(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new BadRequestError("Keine Datei hochgeladen");
  }
  const { category, description } = req.body as {
    category: string;
    description?: string;
  };
  const data = await tenantService.createUpload(
    req.tenantUser!,
    req.file,
    category ?? "sonstiges",
    description
  );
  res.status(201).json({ data });
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export async function getTickets(req: Request, res: Response): Promise<void> {
  const data = await tenantService.getTickets(req.tenantUser!);
  res.json({ data });
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  const data = await tenantService.createTicket(
    req.tenantUser!,
    req.body as { title: string; description: string; category: string },
    req.file?.path
  );
  res.status(201).json({ data });
}

// ─── Finances ─────────────────────────────────────────────────────────────────

export async function getFinances(req: Request, res: Response): Promise<void> {
  const data = await tenantService.getFinances(req.tenantUser!);
  res.json({ data });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(req: Request, res: Response): Promise<void> {
  const data = await tenantService.getMessages(req.tenantUser!);
  res.json({ data });
}

export async function createMessage(req: Request, res: Response): Promise<void> {
  const { body } = req.body as { body: string };
  const data = await tenantService.createMessage(req.tenantUser!, body);
  res.status(201).json({ data });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/tenant.controller.ts
git commit -m "feat(tenant): tenant controller"
```

---

## Task 12: Tenant Portal Router

**Files:**
- Create: `backend/src/routes/tenantPortal.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: tenantPortal.routes.ts erstellen**

Erstelle `backend/src/routes/tenantPortal.routes.ts`:

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireTenantAuth } from "../middleware/tenantAuth.js";
import { resolveTenantCompany } from "../middleware/resolveTenantCompany.js";
import { tenantUploadMiddleware } from "../middleware/tenantUpload.ts";
import {
  tenantSlugParamSchema,
  idParamSchema,
  updateMeSchema,
  createTicketSchema,
  createMessageSchema,
  signDocumentSchema,
  uploadCategorySchema,
} from "../schemas/tenant.schema.js";
import * as ctrl from "../controllers/tenant.controller.js";

export const tenantPortalRouter = Router({ mergeParams: true });

// All routes require company resolution + tenant JWT
tenantPortalRouter.use(validate({ params: tenantSlugParamSchema }));
tenantPortalRouter.use(resolveTenantCompany);
tenantPortalRouter.use(requireTenantAuth);

// Me
tenantPortalRouter.get("/me", ctrl.getMe);
tenantPortalRouter.patch("/me", validate({ body: updateMeSchema }), ctrl.updateMe);

// Documents
tenantPortalRouter.get("/documents", ctrl.getDocuments);
tenantPortalRouter.post(
  "/documents/:id/sign",
  validate({ params: idParamSchema, body: signDocumentSchema }),
  ctrl.signDocument
);

// Uploads (tenant → admin)
tenantPortalRouter.get("/uploads", ctrl.getUploads);
tenantPortalRouter.post(
  "/uploads",
  tenantUploadMiddleware,
  validate({ body: uploadCategorySchema }),
  ctrl.createUpload
);

// Tickets
tenantPortalRouter.get("/tickets", ctrl.getTickets);
tenantPortalRouter.post(
  "/tickets",
  tenantUploadMiddleware, // optional photo
  validate({ body: createTicketSchema }),
  ctrl.createTicket
);

// Finances
tenantPortalRouter.get("/finances", ctrl.getFinances);

// Messages
tenantPortalRouter.get("/messages", ctrl.getMessages);
tenantPortalRouter.post(
  "/messages",
  validate({ body: createMessageSchema }),
  ctrl.createMessage
);
```

- [ ] **Step 2: Router in index.ts registrieren**

In `backend/src/routes/index.ts`, die bestehenden Tenant-Portal-Imports erweitern:

```typescript
import { tenantPortalRouter } from "./tenantPortal.routes.js";
```

Und nach den bereits in Teil 1 registrierten Tenant-Routes hinzufügen:

```typescript
// Tenant Portal — protected API (slug-scoped, TENANT JWT)
router.use("/tenant/:slug", tenantPortalRouter);
```

- [ ] **Step 3: TypeScript prüfen**

```bash
cd backend
npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/tenantPortal.routes.ts backend/src/routes/index.ts
git commit -m "feat(tenant): tenant portal router registered — me, documents, uploads, tickets, finances, messages"
```

---

## Task 13: Admin — Nachrichten-Antwort an Mieter

**Files:**
- Modify: `backend/src/services/tenant.service.ts`
- Create: `backend/src/routes/tenantAdmin.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Service-Funktion für Admin-Antwort ergänzen**

Füge am Ende von `backend/src/services/tenant.service.ts` hinzu:

```typescript
// Admin antwortet auf eine Mieter-Nachricht
export async function adminReplyToTenant(
  companyId: number,
  tenantUserId: number,
  body: string
) {
  // Verify tenantUser belongs to company
  const tu = await prisma.tenantUser.findFirst({
    where: { id: tenantUserId, companyId },
  });
  if (!tu) throw new NotFoundError("Mieter-Benutzer nicht gefunden");

  return prisma.tenantMessage.create({
    data: {
      companyId,
      tenantUserId,
      direction: "ADMIN_TO_TENANT",
      body,
    },
    select: {
      id: true,
      direction: true,
      body: true,
      createdAt: true,
    },
  });
}

// Admin liest alle Nachrichten eines Mieters
export async function adminGetTenantMessages(
  companyId: number,
  tenantUserId: number
) {
  const tu = await prisma.tenantUser.findFirst({
    where: { id: tenantUserId, companyId },
  });
  if (!tu) throw new NotFoundError("Mieter-Benutzer nicht gefunden");

  return prisma.tenantMessage.findMany({
    where: { tenantUserId, companyId },
    select: {
      id: true,
      direction: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 2: Admin-Routes erstellen**

Erstelle `backend/src/routes/tenantAdmin.routes.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  adminReplyToTenant,
  adminGetTenantMessages,
} from "../services/tenant.service.js";

export const tenantAdminRouter = Router();

const tenantUserIdParam = z.object({ tenantUserId: z.coerce.number().int().positive() });
const replyBody = z.object({ body: z.string().min(1).max(5000) });

// GET /api/tenant-admin/messages/:tenantUserId
tenantAdminRouter.get(
  "/messages/:tenantUserId",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: tenantUserIdParam }),
  async (req, res) => {
    const messages = await adminGetTenantMessages(
      req.companyId!,
      Number(req.params.tenantUserId)
    );
    res.json({ data: messages });
  }
);

// POST /api/tenant-admin/messages/:tenantUserId
tenantAdminRouter.post(
  "/messages/:tenantUserId",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: tenantUserIdParam, body: replyBody }),
  async (req, res) => {
    const msg = await adminReplyToTenant(
      req.companyId!,
      Number(req.params.tenantUserId),
      (req.body as { body: string }).body
    );
    res.status(201).json({ data: msg });
  }
);
```

- [ ] **Step 3: Admin-Routes in index.ts registrieren**

In `backend/src/routes/index.ts`:

```typescript
import { tenantAdminRouter } from "./tenantAdmin.routes.js";
```

```typescript
// Tenant Admin — Verwalter schreibt an Mieter
router.use("/tenant-admin", requireAuth, tenantGuard, subscriptionGuard, tenantAdminRouter);
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/tenant.service.ts backend/src/routes/tenantAdmin.routes.ts backend/src/routes/index.ts
git commit -m "feat(tenant): admin reply + list messages for tenant users"
```

---

## Task 14: Alle Tests + Smoke-Test

- [ ] **Step 1: Alle Backend-Tests ausführen**

```bash
cd backend
npm test
```

Erwartete Ausgabe: alle Tests (bestehende + neue) bestehen, keine Fehler

- [ ] **Step 2: TypeScript final prüfen**

```bash
cd backend
npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 3: Backend starten und Endpoints testen**

```bash
cd backend
npm run dev
```

Login (aus Teil 1 angelegter TenantUser):

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/tenant/mustermann-hv/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mieter.de","password":"Test123!"}' | jq -r '.data.accessToken')

echo "Token: $TOKEN"
```

Me-Endpoint testen:

```bash
curl -s http://localhost:3001/api/tenant/mustermann-hv/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Erwartete Ausgabe:
```json
{
  "data": {
    "id": 1,
    "email": "test@mieter.de",
    "tenant": {
      "name": "...",
      "units": [...],
      "contracts": [...]
    }
  }
}
```

Dokumente testen:

```bash
curl -s http://localhost:3001/api/tenant/mustermann-hv/documents \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Finanzen testen:

```bash
curl -s http://localhost:3001/api/tenant/mustermann-hv/finances \
  -H "Authorization: Bearer $TOKEN" | jq .
```

- [ ] **Step 4: Abschließender Commit**

```bash
git commit -m "feat(tenant): Teil 2 complete — alle Tenant API-Endpunkte implementiert"
```

---

## Teil 2 abgeschlossen

**Was gebaut wurde:**
- Zod-Schemas für alle Tenant-API-Inputs
- `tenant.service.ts` — getMe, updateMe, getDocuments, signDocument, getUploads, createUpload, getTickets, createTicket, getFinances, getMessages, createMessage, adminReplyToTenant
- `tenantUpload.ts` Middleware — sichere Dateiablage unter `uploads/{companyId}/tenant-uploads/{tenantUserId}/`
- `tenant.controller.ts` — alle Handler
- `tenantPortal.routes.ts` — `/api/tenant/:slug/*` mit requireTenantAuth
- `tenantAdmin.routes.ts` — `/api/tenant-admin/messages/:tenantUserId` für Verwalter
- 10 Unit-Tests im Service

**API-Endpunkte:**

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/tenant/:slug/me` | TENANT JWT |
| PATCH | `/api/tenant/:slug/me` | TENANT JWT |
| GET | `/api/tenant/:slug/documents` | TENANT JWT |
| POST | `/api/tenant/:slug/documents/:id/sign` | TENANT JWT |
| GET | `/api/tenant/:slug/uploads` | TENANT JWT |
| POST | `/api/tenant/:slug/uploads` | TENANT JWT |
| GET | `/api/tenant/:slug/tickets` | TENANT JWT |
| POST | `/api/tenant/:slug/tickets` | TENANT JWT |
| GET | `/api/tenant/:slug/finances` | TENANT JWT |
| GET | `/api/tenant/:slug/messages` | TENANT JWT |
| POST | `/api/tenant/:slug/messages` | TENANT JWT |
| GET | `/api/tenant-admin/messages/:id` | VERWALTER JWT |
| POST | `/api/tenant-admin/messages/:id` | VERWALTER JWT |

**Weiter mit:** `2026-04-04-tenant-portal-part3.md` — Frontend `tenant-portal/` Setup, PWA, Auth, Branding, Core-Pages (Login, Invite, Dashboard, Profil)
