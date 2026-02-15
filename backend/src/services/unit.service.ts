import { prisma } from "../lib/prisma.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import type { UnitStatus } from "@prisma/client";

async function verifyPropertyOwnership(companyId: number, propertyId: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new NotFoundError("Immobilie", propertyId);
  return property;
}

export async function listUnits(companyId: number, propertyId: number) {
  await verifyPropertyOwnership(companyId, propertyId);

  return prisma.unit.findMany({
    where: { propertyId },
    include: {
      tenant: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });
}

export async function getUnit(companyId: number, id: number) {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true, email: true, phone: true } },
      property: { select: { id: true, name: true, companyId: true } },
    },
  });

  if (!unit) throw new NotFoundError("Einheit", id);
  if (unit.property.companyId !== companyId) throw new ForbiddenError();
  return unit;
}

export async function createUnit(
  companyId: number,
  propertyId: number,
  data: { number: string; floor: number; area: number; rent: number; status?: UnitStatus; tenantId?: number | null }
) {
  await verifyPropertyOwnership(companyId, propertyId);

  return prisma.unit.create({
    data: {
      ...data,
      propertyId,
      status: data.status ?? "FREI",
      tenantId: data.tenantId ?? null,
    },
    include: {
      tenant: { select: { id: true, name: true } },
    },
  });
}

export async function updateUnit(
  companyId: number,
  id: number,
  data: Partial<{ number: string; floor: number; area: number; rent: number; status: UnitStatus; tenantId: number | null }>
) {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { property: { select: { companyId: true } } },
  });
  if (!unit) throw new NotFoundError("Einheit", id);
  if (unit.property.companyId !== companyId) throw new ForbiddenError();

  return prisma.unit.update({
    where: { id },
    data,
    include: { tenant: { select: { id: true, name: true } } },
  });
}

export async function deleteUnit(companyId: number, id: number) {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { property: { select: { companyId: true } } },
  });
  if (!unit) throw new NotFoundError("Einheit", id);
  if (unit.property.companyId !== companyId) throw new ForbiddenError();

  return prisma.unit.delete({ where: { id } });
}
