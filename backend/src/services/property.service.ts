import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";
import { paginationMeta } from "../schemas/common.schema.js";
import type { PropertyStatus } from "@prisma/client";

interface PropertyQuery {
  page: number;
  limit: number;
  search: string;
  status?: PropertyStatus;
}

export async function listProperties(companyId: number, params: PropertyQuery) {
  const { page, limit, search, status } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        units: { select: { rent: true, status: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.property.count({ where }),
  ]);

  const data = properties.map((p) => {
    const totalUnits = p.units.length;
    const occupiedUnits = p.units.filter((u) => u.status === "VERMIETET").length;
    const maintenanceUnits = p.units.filter((u) => u.status === "WARTUNG").length;
    const monthlyRevenue = p.units
      .filter((u) => u.status === "VERMIETET")
      .reduce((sum, u) => sum + u.rent, 0);

    return {
      id: p.id,
      name: p.name,
      address: p.address,
      status: p.status,
      totalUnits,
      occupiedUnits,
      maintenanceUnits,
      monthlyRevenue,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  return { data, meta: paginationMeta(total, page, limit) };
}

export async function getProperty(companyId: number, id: number) {
  const property = await prisma.property.findFirst({
    where: { id, companyId },
    include: {
      units: {
        include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: [{ floor: "asc" }, { number: "asc" }],
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!property) throw new NotFoundError("Immobilie", id);
  return property;
}

export async function createProperty(companyId: number, data: { name: string; address: string; status?: PropertyStatus }) {
  return prisma.property.create({
    data: { ...data, companyId, status: data.status ?? "AKTIV" },
  });
}

export async function updateProperty(companyId: number, id: number, data: Partial<{ name: string; address: string; status: PropertyStatus }>) {
  const existing = await prisma.property.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Immobilie", id);

  return prisma.property.update({ where: { id }, data });
}

export async function deleteProperty(companyId: number, id: number) {
  const existing = await prisma.property.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Immobilie", id);

  return prisma.property.delete({ where: { id } });
}
