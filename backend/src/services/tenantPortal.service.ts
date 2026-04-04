import { prisma } from "../lib/prisma.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";

type TenantUser = { id: number; tenantId: number; companyId: number };

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

  if (!user) throw new NotFoundError("Benutzer", tenantUser.id);
  return user;
}

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

  if (data.email) {
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

  if (!doc) throw new NotFoundError("Dokument", documentId);
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
      mimeType: true,
      sizeBytes: true,
      category: true,
      description: true,
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
  _photoPath?: string
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
      reportedBy: "Mieter",
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

  const nextPayment =
    payments.find((p) => p.status === "AUSSTEHEND" && p.dueDate && p.dueDate >= new Date()) ?? null;

  return { payments, nextPayment };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(tenantUser: TenantUser) {
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

// ─── Admin functions ───────────────────────────────────────────────────────────

export async function adminReplyToTenant(
  companyId: number,
  tenantUserId: number,
  body: string
) {
  const tu = await prisma.tenantUser.findFirst({
    where: { id: tenantUserId, companyId },
  });
  if (!tu) throw new NotFoundError("Mieter-Benutzer", tenantUserId);

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

export async function adminGetTenantMessages(companyId: number, tenantUserId: number) {
  const tu = await prisma.tenantUser.findFirst({
    where: { id: tenantUserId, companyId },
  });
  if (!tu) throw new NotFoundError("Mieter-Benutzer", tenantUserId);

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
