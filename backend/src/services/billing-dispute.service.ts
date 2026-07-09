import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

export const DISPUTE_STATUSES = ["OPEN", "IN_BEARBEITUNG", "GELOEST", "ABGELEHNT"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export async function createDispute(
  companyId: number,
  contractId: number,
  data: { reason: string; amount?: number }
) {
  return prisma.billingDispute.create({
    data: {
      contractId,
      companyId,
      reason: data.reason,
      amount: data.amount ?? null,
      status: "OPEN",
    },
  });
}

export async function listDisputesByCompany(companyId: number, status?: string) {
  return prisma.billingDispute.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: { contract: { include: { tenant: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listDisputesByContract(companyId: number, contractId: number) {
  return prisma.billingDispute.findMany({
    where: { companyId, contractId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDisputeStatus(companyId: number, id: number, status: DisputeStatus) {
  const existing = await prisma.billingDispute.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Widerspruch", id);
  return prisma.billingDispute.update({ where: { id }, data: { status } });
}
