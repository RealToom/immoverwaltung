import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { paginationMeta } from "../schemas/common.schema.js";

const PROPERTY_SELECT = { id: true, name: true, street: true, city: true } as const;

export async function listInsurancePolicies(
  companyId: number,
  params: { page?: number; limit?: number; propertyId?: number; type?: string; status?: string },
) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 25;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(params.propertyId ? { propertyId: params.propertyId } : {}),
    ...(params.type ? { type: params.type as never } : {}),
    ...(params.status ? { status: params.status as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.insurancePolicy.findMany({
      where,
      include: { property: { select: PROPERTY_SELECT } },
      orderBy: { startDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.insurancePolicy.count({ where }),
  ]);

  return { data, meta: paginationMeta(total, page, limit) };
}

export async function getInsurancePolicy(companyId: number, id: number) {
  const policy = await prisma.insurancePolicy.findFirst({
    where: { id, companyId },
    include: { property: { select: PROPERTY_SELECT } },
  });
  if (!policy) throw new AppError(404, "Versicherung nicht gefunden");
  return policy;
}

export async function createInsurancePolicy(
  companyId: number,
  data: {
    name: string; insurer: string; policyNumber?: string | null; type: string;
    status?: string; premium: number; startDate: string; endDate?: string | null;
    notes?: string | null; propertyId?: number | null;
  },
) {
  return prisma.insurancePolicy.create({
    data: {
      name: data.name,
      insurer: data.insurer,
      policyNumber: data.policyNumber ?? null,
      type: data.type as never,
      status: (data.status ?? "AKTIV") as never,
      premium: data.premium,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      notes: data.notes ?? null,
      propertyId: data.propertyId ?? null,
      companyId,
    },
    include: { property: { select: PROPERTY_SELECT } },
  });
}

export async function updateInsurancePolicy(
  companyId: number,
  id: number,
  data: Partial<{
    name: string; insurer: string; policyNumber: string | null; type: string;
    status: string; premium: number; startDate: string; endDate: string | null;
    notes: string | null; propertyId: number | null;
  }>,
) {
  const existing = await prisma.insurancePolicy.findFirst({ where: { id, companyId } });
  if (!existing) throw new AppError(404, "Versicherung nicht gefunden");

  return prisma.insurancePolicy.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.insurer !== undefined && { insurer: data.insurer }),
      ...(data.policyNumber !== undefined && { policyNumber: data.policyNumber }),
      ...(data.type !== undefined && { type: data.type as never }),
      ...(data.status !== undefined && { status: data.status as never }),
      ...(data.premium !== undefined && { premium: data.premium }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.propertyId !== undefined && { propertyId: data.propertyId }),
    },
    include: { property: { select: PROPERTY_SELECT } },
  });
}

export async function deleteInsurancePolicy(companyId: number, id: number) {
  const existing = await prisma.insurancePolicy.findFirst({ where: { id, companyId } });
  if (!existing) throw new AppError(404, "Versicherung nicht gefunden");
  await prisma.insurancePolicy.delete({ where: { id } });
}
