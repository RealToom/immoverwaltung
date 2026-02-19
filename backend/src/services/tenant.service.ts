import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";
import { paginationMeta } from "../schemas/common.schema.js";

interface TenantQuery {
  page: number;
  limit: number;
  search: string;
  propertyId?: number;
}

export async function listTenants(companyId: number, params: TenantQuery) {
  const { page, limit, search, propertyId } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (propertyId) {
    where.units = { some: { propertyId } };
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        units: {
          include: {
            property: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return { data: tenants, meta: paginationMeta(total, page, limit) };
}

export async function getTenant(companyId: number, id: number) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, companyId },
    include: {
      units: {
        include: { property: { select: { id: true, name: true } } },
      },
      contracts: {
        include: { property: { select: { id: true, name: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!tenant) throw new NotFoundError("Mieter", id);
  return tenant;
}

export async function createTenant(
  companyId: number,
  data: { name: string; email: string; phone?: string; moveIn: Date; unitId?: number }
) {
  const { unitId, ...tenantData } = data;

  const tenant = await prisma.tenant.create({
    data: { ...tenantData, phone: tenantData.phone ?? "", companyId },
  });

  if (unitId) {
    await prisma.unit.update({
      where: { id: unitId },
      data: { tenantId: tenant.id, status: "VERMIETET" },
    });
  }

  return prisma.tenant.findFirst({
    where: { id: tenant.id },
    include: {
      units: { include: { property: { select: { id: true, name: true } } } },
    },
  });
}

export async function updateTenant(
  companyId: number,
  id: number,
  data: Partial<{ name: string; email: string; phone: string; moveIn: Date; unitId: number }>
) {
  const existing = await prisma.tenant.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Mieter", id);

  const { unitId, ...tenantData } = data;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: tenantData,
  });

  if (unitId !== undefined) {
    // Unlink old unit
    await prisma.unit.updateMany({
      where: { tenantId: id },
      data: { tenantId: null, status: "FREI" },
    });
    // Link new unit
    if (unitId) {
      await prisma.unit.update({
        where: { id: unitId },
        data: { tenantId: id, status: "VERMIETET" },
      });
    }
  }

  return prisma.tenant.findFirst({
    where: { id: tenant.id },
    include: {
      units: { include: { property: { select: { id: true, name: true } } } },
    },
  });
}

export async function deleteTenant(companyId: number, id: number) {
  const existing = await prisma.tenant.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Mieter", id);

  // Unlink from unit
  await prisma.unit.updateMany({
    where: { tenantId: id },
    data: { tenantId: null, status: "FREI" },
  });

  return prisma.tenant.delete({ where: { id } });
}
