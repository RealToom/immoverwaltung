import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listSchedules(companyId: number, propertyId?: number) {
  return prisma.maintenanceSchedule.findMany({
    where: { companyId, ...(propertyId ? { propertyId } : {}) },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { nextDue: "asc" },
  });
}

export async function createSchedule(
  companyId: number,
  data: {
    title: string;
    description: string;
    category: string;
    interval: string;
    nextDue: string;
    assignedTo?: string;
    propertyId: number;
  },
) {
  return prisma.maintenanceSchedule.create({
    data: {
      ...data,
      category: data.category as never,
      interval: data.interval as never,
      nextDue: new Date(data.nextDue),
      companyId,
    },
  });
}

export async function updateSchedule(companyId: number, id: number, data: Record<string, unknown>) {
  const s = await prisma.maintenanceSchedule.findFirst({ where: { id, companyId } });
  if (!s) throw new AppError(404, "Wartungsplan nicht gefunden");
  const updateData: Record<string, unknown> = { ...data };
  if (typeof updateData.nextDue === "string") updateData.nextDue = new Date(updateData.nextDue);
  if (typeof updateData.lastDone === "string") updateData.lastDone = new Date(updateData.lastDone);
  return prisma.maintenanceSchedule.update({ where: { id }, data: updateData as never });
}

export async function deleteSchedule(companyId: number, id: number) {
  const s = await prisma.maintenanceSchedule.findFirst({ where: { id, companyId } });
  if (!s) throw new AppError(404, "Wartungsplan nicht gefunden");
  await prisma.maintenanceSchedule.delete({ where: { id } });
}

// Cron: fällige Wartungspläne → automatisch Ticket erstellen
export async function processOverdueSchedules(): Promise<number> {
  const now = new Date();
  const due = await prisma.maintenanceSchedule.findMany({
    where: { isActive: true, nextDue: { lte: now } },
  });

  let created = 0;
  for (const s of due) {
    await prisma.maintenanceTicket.create({
      data: {
        title: s.title,
        description: s.description || `Automatisch aus Wartungsplan: ${s.title}`,
        category: s.category,
        priority: "MITTEL",
        status: "OFFEN",
        reportedBy: "System",
        assignedTo: s.assignedTo ?? undefined,
        dueDate: now,
        propertyId: s.propertyId,
        companyId: s.companyId,
      },
    });

    const months: Record<string, number> = {
      MONATLICH: 1,
      VIERTELJAEHRLICH: 3,
      HALBJAEHRLICH: 6,
      JAEHRLICH: 12,
    };
    const next = new Date(s.nextDue);
    next.setMonth(next.getMonth() + (months[s.interval] ?? 12));

    await prisma.maintenanceSchedule.update({
      where: { id: s.id },
      data: { lastDone: now, nextDue: next },
    });
    created++;
  }

  if (created > 0) {
    logger.info({ count: created }, "[WARTUNGSPLAN] Wartungstickets auto-erstellt");
  }
  return created;
}
