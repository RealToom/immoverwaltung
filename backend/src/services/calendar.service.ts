import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

// Auto-generated events from existing data
async function getAutoEvents(companyId: number, from?: Date, to?: Date) {
  const dateFilter = from && to ? { gte: from, lte: to } : undefined;

  // Contract events: nextReminder + expiring contracts
  const contracts = await prisma.contract.findMany({
    where: { companyId, ...(dateFilter ? { OR: [
      { nextReminder: dateFilter },
      { endDate: dateFilter },
    ]} : {}) },
    select: { id: true, nextReminder: true, reminderType: true, endDate: true,
              tenant: { select: { name: true } }, property: { select: { name: true } } },
  });

  // Maintenance events: dueDate
  const tickets = await prisma.maintenanceTicket.findMany({
    where: { companyId, dueDate: { not: null }, ...(dateFilter ? { dueDate: dateFilter } : {}), status: { not: "ERLEDIGT" } },
    select: { id: true, title: true, dueDate: true, priority: true },
  });

  // Rent payment events: pending due dates
  const rentPayments = await prisma.rentPayment.findMany({
    where: { companyId, status: "AUSSTEHEND", ...(dateFilter ? { dueDate: dateFilter } : {}) },
    select: { id: true, dueDate: true, amountDue: true,
              contract: { select: { tenant: { select: { name: true } } } } },
  });

  const autoEvents: object[] = [];

  for (const c of contracts) {
    if (c.nextReminder) {
      autoEvents.push({
        id: `contract-reminder-${c.id}`, title: `Erinnerung: ${c.tenant.name} – ${c.property.name}`,
        start: c.nextReminder, allDay: true, type: "AUTO_VERTRAG", sourceId: c.id, color: "#f97316",
      });
    }
    if (c.endDate) {
      autoEvents.push({
        id: `contract-end-${c.id}`, title: `Vertragsende: ${c.tenant.name}`,
        start: c.endDate, allDay: true, type: "AUTO_VERTRAG", sourceId: c.id, color: "#f97316",
      });
    }
  }

  for (const t of tickets) {
    if (t.dueDate) {
      autoEvents.push({
        id: `ticket-${t.id}`, title: `Wartung: ${t.title}`,
        start: t.dueDate, allDay: true, type: "AUTO_WARTUNG", sourceId: t.id, color: "#ef4444",
      });
    }
  }

  for (const r of rentPayments) {
    autoEvents.push({
      id: `rent-${r.id}`, title: `Mieteingang fällig: ${r.contract.tenant.name}`,
      start: r.dueDate, allDay: true, type: "AUTO_MIETE", sourceId: r.id, color: "#22c55e",
    });
  }

  return autoEvents;
}

export async function listEvents(companyId: number, from?: Date, to?: Date) {
  const dateFilter = from && to ? { start: { gte: from, lte: to } } : {};

  const manual = await prisma.calendarEvent.findMany({
    where: { companyId, ...dateFilter },
    orderBy: { start: "asc" },
  });

  const auto = await getAutoEvents(companyId, from, to);
  return [...manual, ...auto];
}

export async function createEvent(companyId: number, userId: number, data: {
  title: string; description?: string; start: Date; end?: Date; allDay?: boolean; color?: string;
}) {
  return prisma.calendarEvent.create({
    data: { ...data, companyId, createdByUserId: userId, type: "MANUELL" },
  });
}

export async function updateEvent(companyId: number, id: number, data: Partial<{
  title: string; description: string; start: Date; end: Date; allDay: boolean; color: string;
}>) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError(404, "Termin nicht gefunden");
  if (event.type !== "MANUELL" && event.type !== "AUTO_EMAIL") {
    throw new AppError(403, "Nur manuelle Termine können bearbeitet werden");
  }
  return prisma.calendarEvent.update({ where: { id }, data });
}

export async function deleteEvent(companyId: number, id: number) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError(404, "Termin nicht gefunden");
  if (event.type !== "MANUELL") throw new AppError(403, "Nur manuelle Termine können gelöscht werden");
  await prisma.calendarEvent.delete({ where: { id } });
}
