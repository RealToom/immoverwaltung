import { prisma } from "../lib/prisma.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";
import { MaintenanceCategoryType, MAINTENANCE_CATEGORIES } from "../schemas/tenantPortal.schema.js";
import { UtilityBillingService } from "./utility-billing.service.js";
import * as disputeSvc from "./billing-dispute.service.js";
import { buildTenantCategoryLines } from "../lib/betrkv.js";

type TenantUser = { id: number; tenantId: number; companyId: number };

async function getActiveContract(tenantUser: TenantUser) {
  const contract = await prisma.contract.findFirst({
    where: { tenantId: tenantUser.tenantId, companyId: tenantUser.companyId, status: "AKTIV" },
    orderBy: { startDate: "desc" },
  });
  if (!contract) throw new NotFoundError("Aktiver Vertrag", tenantUser.tenantId);
  return contract;
}

/**
 * Finds the tenant's contract for a billing year — deliberately NOT limited
 * to AKTIV: ex-tenants receive their final utility statement after move-out
 * and keep the 12-month objection window of § 556 Abs. 3 BGB. Without a year,
 * falls back to the most recent contract.
 */
async function getContractForYear(tenantUser: TenantUser, year?: number) {
  const contract = await prisma.contract.findFirst({
    where: {
      tenantId: tenantUser.tenantId,
      companyId: tenantUser.companyId,
      ...(year != null
        ? {
            startDate: { lte: new Date(year, 11, 31) },
            OR: [{ endDate: null }, { endDate: { gte: new Date(year, 0, 1) } }],
          }
        : {}),
    },
    orderBy: { startDate: "desc" },
  });
  if (!contract) throw new NotFoundError("Vertrag", tenantUser.tenantId);
  return contract;
}

// ─── Me ───────────────────────────────────────────────────────────────────────

export async function getMe(tenantUser: TenantUser) {
  const user = await prisma.tenantUser.findUnique({
    where: { id: tenantUser.id },
    select: {
      id: true,
      email: true,
      lastLoginAt: true,
      company: { select: { name: true } },
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
  const { company, ...rest } = user;
  return { ...rest, companyName: company.name };
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
  // email changes are not allowed via self-service — contact property manager
  return getMe(tenantUser);
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(tenantUser: TenantUser) {
  // Note: no filePath here — internal storage paths must not leak to tenants.
  return prisma.document.findMany({
    where: { tenantId: tenantUser.tenantId, companyId: tenantUser.companyId },
    select: {
      id: true,
      name: true,
      fileType: true,
      fileSize: true,
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

export async function downloadDocument(tenantUser: TenantUser, documentId: number) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, tenantId: tenantUser.tenantId, companyId: tenantUser.companyId },
  });
  if (!doc) throw new NotFoundError("Dokument", documentId);
  return doc;
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
  if (!(MAINTENANCE_CATEGORIES as readonly string[]).includes(data.category)) {
    throw new BadRequestError("Ungültige Kategorie");
  }

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
      category: data.category as MaintenanceCategoryType,
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
        select: { monthlyRent: true },
      },
    },
    orderBy: { month: "desc" },
    take: 24,
  });

  const monthlyRent = payments[0]?.contract.monthlyRent ?? 0;

  const entries = payments.map((p) => ({
    id: p.id,
    date: (p.paidDate ?? p.dueDate ?? new Date(p.month)).toISOString(),
    description: `Miete ${new Date(p.month).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`,
    amount: Number(p.amountDue),
    type: p.status !== "AUSSTEHEND" ? "INCOME" : "EXPENSE",
    category: "Miete",
  }));

  return { monthlyRent: Number(monthlyRent), entries };
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

// ─── Utility Billing ────────────────────────────────────────────────────────────

export async function getUtilitySummary(tenantUser: TenantUser, year?: number) {
  const targetYear = year ?? new Date().getFullYear() - 1;
  const contract = await getContractForYear(tenantUser, targetYear);
  const svc = new UtilityBillingService(tenantUser.companyId);
  const statement = await svc.generateStatement(contract.propertyId, targetYear);
  const item = statement.items.find((i) => i.contractId === contract.id);
  const categories = item
    ? buildTenantCategoryLines(statement.transactions, item.amount, item.heatingAmount).map((line) => ({
        category: line.category,
        label: line.label,
        amount: line.tenantShare,
      }))
    : [];
  return {
    year: targetYear,
    totalCosts: item?.amount ?? 0,
    totalPrepaid: item?.totalPrepaid ?? 0,
    balance: item?.balance ?? 0,
    isRefund: item?.isRefund ?? false,
    categories,
  };
}

export async function getOwnMeters(tenantUser: TenantUser) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantUser.tenantId },
    select: { units: { select: { id: true } } },
  });
  const unitIds = tenant?.units.map((u) => u.id) ?? [];
  return prisma.meter.findMany({
    where: { companyId: tenantUser.companyId, unitId: { in: unitIds } },
    include: { readings: { orderBy: { readAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addOwnMeterReading(
  tenantUser: TenantUser,
  meterId: number,
  data: { value: number; readAt: string; note?: string }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantUser.tenantId },
    select: { units: { select: { id: true } } },
  });
  const unitIds = tenant?.units.map((u) => u.id) ?? [];
  const meter = await prisma.meter.findFirst({
    where: { id: meterId, companyId: tenantUser.companyId, unitId: { in: unitIds } },
  });
  if (!meter) throw new NotFoundError("Zähler", meterId);
  return prisma.meterReading.create({
    data: { value: data.value, readAt: new Date(data.readAt), note: data.note, meterId, companyId: tenantUser.companyId },
  });
}

// ─── Billing Disputes ─────────────────────────────────────────────────────────

export async function createDispute(
  tenantUser: TenantUser,
  data: { reason: string; amount?: number; year?: number }
) {
  const contract = await getContractForYear(tenantUser, data.year);
  return disputeSvc.createDispute(tenantUser.companyId, contract.id, data);
}

export async function getDisputes(tenantUser: TenantUser) {
  // All disputes across the tenant's contracts (incl. ended ones).
  const contracts = await prisma.contract.findMany({
    where: { tenantId: tenantUser.tenantId, companyId: tenantUser.companyId },
    select: { id: true },
  });
  return disputeSvc.listDisputesByContracts(
    tenantUser.companyId,
    contracts.map((c) => c.id)
  );
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
