import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";
import { paginationMeta } from "../schemas/common.schema.js";
import type { ContractStatus, ContractType, ReminderType, Prisma } from "@prisma/client";

interface ContractQuery {
  page: number;
  limit: number;
  search: string;
  status?: ContractStatus;
  type?: ContractType;
  propertyId?: number;
}

interface CreateContractData {
  type: ContractType;
  startDate: Date;
  endDate?: Date | null;
  noticePeriod: number;
  monthlyRent: number;
  deposit: number;
  status: ContractStatus;
  nextReminder?: Date | null;
  reminderType?: ReminderType | null;
  notes?: string | null;
  tenantId: number;
  propertyId: number;
  unitId: number;
}

type UpdateContractData = Partial<CreateContractData>;

const contractInclude = {
  tenant: { select: { id: true, name: true, email: true } },
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, number: true } },
} as const;

export async function listContracts(companyId: number, params: ContractQuery) {
  const { page, limit, search, status, type, propertyId } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ContractWhereInput = { companyId };
  if (status) where.status = status;
  if (type) where.type = type;
  if (propertyId) where.propertyId = propertyId;
  if (search) {
    where.OR = [
      { tenant: { name: { contains: search, mode: "insensitive" } } },
      { property: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: contractInclude,
      orderBy: { startDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.contract.count({ where }),
  ]);

  return { data: contracts, meta: paginationMeta(total, page, limit) };
}

export async function getContract(companyId: number, id: number) {
  const contract = await prisma.contract.findFirst({
    where: { id, companyId },
    include: {
      tenant: { select: { id: true, name: true, email: true, phone: true } },
      property: { select: { id: true, name: true, address: true } },
      unit: { select: { id: true, number: true, area: true } },
    },
  });
  if (!contract) throw new NotFoundError("Vertrag", id);
  return contract;
}

export async function createContract(companyId: number, data: CreateContractData) {
  return prisma.contract.create({
    data: { ...data, companyId },
    include: contractInclude,
  });
}

export async function updateContract(companyId: number, id: number, data: UpdateContractData) {
  const existing = await prisma.contract.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Vertrag", id);

  return prisma.contract.update({
    where: { id },
    data,
    include: contractInclude,
  });
}

export async function deleteContract(companyId: number, id: number) {
  const existing = await prisma.contract.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Vertrag", id);

  return prisma.contract.delete({ where: { id } });
}
