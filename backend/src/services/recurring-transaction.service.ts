import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listRecurring(companyId: number) {
  return prisma.recurringTransaction.findMany({
    where: { companyId },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRecurring(companyId: number, data: {
  description: string; type: string; amount: number; category: string;
  allocatable: boolean; interval: string; dayOfMonth: number;
  startDate: string; endDate?: string; propertyId?: number;
}) {
  return prisma.recurringTransaction.create({
    data: {
      ...data,
      type: data.type as never,
      interval: data.interval as never,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      companyId,
    },
  });
}

export async function updateRecurring(companyId: number, id: number, data: object) {
  const rec = await prisma.recurringTransaction.findFirst({ where: { id, companyId } });
  if (!rec) throw new AppError(404, "Wiederkehrende Buchung nicht gefunden");
  return prisma.recurringTransaction.update({ where: { id }, data: data as never });
}

export async function deleteRecurring(companyId: number, id: number) {
  const rec = await prisma.recurringTransaction.findFirst({ where: { id, companyId } });
  if (!rec) throw new AppError(404, "Wiederkehrende Buchung nicht gefunden");
  await prisma.recurringTransaction.delete({ where: { id } });
}

function isRecurringDue(rec: {
  interval: string; dayOfMonth: number; lastRun: Date | null; startDate: Date;
}, now: Date): boolean {
  if (now.getDate() !== rec.dayOfMonth) return false;
  if (!rec.lastRun) return true;

  const monthsDiff =
    (now.getFullYear() - rec.lastRun.getFullYear()) * 12 +
    (now.getMonth() - rec.lastRun.getMonth());

  const minMonths: Record<string, number> = {
    MONATLICH: 1, VIERTELJAEHRLICH: 3, HALBJAEHRLICH: 6, JAEHRLICH: 12,
  };
  return monthsDiff >= (minMonths[rec.interval] ?? 1);
}

export async function processRecurringTransactions(): Promise<number> {
  const now = new Date();
  const active = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });

  let created = 0;
  for (const rec of active) {
    if (!isRecurringDue(rec, now)) continue;

    await prisma.transaction.create({
      data: {
        date: now,
        description: rec.description,
        type: rec.type,
        amount: rec.amount,
        category: rec.category,
        allocatable: rec.allocatable,
        propertyId: rec.propertyId,
        companyId: rec.companyId,
      },
    });
    await prisma.recurringTransaction.update({
      where: { id: rec.id },
      data: { lastRun: now },
    });
    created++;
  }

  if (created > 0) {
    logger.info({ count: created }, "[RECURRING] Wiederkehrende Buchungen erstellt");
  }
  return created;
}
