import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { expandRecurrence } from "../lib/recurrence.js";

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

const ENTITY_INCLUDE = {
  property: { select: { id: true, name: true } },
  tenant: { select: { id: true, name: true } },
} as const;

export async function listEvents(companyId: number, from?: Date, to?: Date) {
  const dateFilter = from && to ? { start: { gte: from, lte: to } } : {};

  const [single, recurring] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { companyId, recurrenceFreq: null, ...dateFilter },
      include: ENTITY_INCLUDE,
      orderBy: { start: "asc" },
    }),
    // Serien können vor dem Fenster starten — nur nach oben begrenzen
    prisma.calendarEvent.findMany({
      where: { companyId, recurrenceFreq: { not: null }, ...(to ? { start: { lte: to } } : {}) },
      include: ENTITY_INCLUDE,
    }),
  ]);

  const now = new Date();
  const windowFrom = from ?? now;
  const windowTo = to ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const expanded = recurring.flatMap((e) => {
    const durationMs = e.end ? e.end.getTime() - e.start.getTime() : 0;
    return expandRecurrence(e, windowFrom, windowTo).map((occStart) => ({
      ...e,
      id: `evt-${e.id}-${occStart.toISOString().slice(0, 10)}`,
      seriesId: e.id,
      start: occStart,
      end: e.end ? new Date(occStart.getTime() + durationMs) : null,
    }));
  });

  const auto = await getAutoEvents(companyId, from, to);
  return [...single, ...expanded, ...auto];
}

async function assertEntityOwnership(companyId: number, propertyId?: number | null, tenantId?: number | null): Promise<void> {
  if (propertyId) {
    const p = await prisma.property.findFirst({ where: { id: propertyId, companyId }, select: { id: true } });
    if (!p) throw new AppError(404, "Immobilie nicht gefunden");
  }
  if (tenantId) {
    const t = await prisma.tenant.findFirst({ where: { id: tenantId, companyId }, select: { id: true } });
    if (!t) throw new AppError(404, "Mieter nicht gefunden");
  }
}

export interface CalendarEventInput {
  title: string; description?: string | null; start: Date; end?: Date | null; allDay?: boolean;
  color?: string | null; type?: "MANUELL" | "BESICHTIGUNG";
  recurrenceFreq?: "TAEGLICH" | "WOECHENTLICH" | "MONATLICH" | "JAEHRLICH" | null;
  recurrenceInterval?: number; recurrenceUntil?: Date | null;
  reminderMinutes?: number | null;
  propertyId?: number | null; tenantId?: number | null;
  visitorName?: string | null; visitorContact?: string | null;
}

export async function createEvent(companyId: number, userId: number, data: CalendarEventInput) {
  await assertEntityOwnership(companyId, data.propertyId, data.tenantId);
  const { type = "MANUELL", ...rest } = data;
  return prisma.calendarEvent.create({
    data: { ...rest, companyId, createdByUserId: userId, type },
  });
}

export async function updateEvent(companyId: number, id: number, data: Partial<CalendarEventInput>) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError(404, "Termin nicht gefunden");
  const editable = ["MANUELL", "AUTO_EMAIL", "BESICHTIGUNG"] as const;
  if (!(editable as readonly string[]).includes(event.type)) {
    throw new AppError(403, "Nur manuelle Termine können bearbeitet werden");
  }
  await assertEntityOwnership(companyId, data.propertyId, data.tenantId);
  // Start oder Erinnerung geändert -> Erinnerung darf erneut feuern
  const resetReminder = data.start !== undefined || data.reminderMinutes !== undefined;
  return prisma.calendarEvent.update({
    where: { id },
    data: { ...data, ...(resetReminder ? { reminderSentFor: null } : {}) },
  });
}

export async function deleteEvent(companyId: number, id: number) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, companyId } });
  if (!event) throw new AppError(404, "Termin nicht gefunden");
  const deletable = ["MANUELL", "BESICHTIGUNG"] as const;
  if (!(deletable as readonly string[]).includes(event.type)) {
    throw new AppError(403, "Nur manuelle Termine können gelöscht werden");
  }
  await prisma.calendarEvent.delete({ where: { id } });
}

function toIcalDate(date: Date, allDay: boolean): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcal(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function exportIcal(companyId: number): Promise<string> {
  const from = new Date();
  const to = new Date();
  to.setMonth(to.getMonth() + 6);

  const events = await listEvents(companyId, from, to);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Immoverwaltung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Immoverwaltung",
    "X-WR-TIMEZONE:Europe/Berlin",
  ];

  for (const e of events) {
    const ev = e as { id: string | number; title: string; start: Date | string; end?: Date | string | null; allDay?: boolean; description?: string };
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : (ev.allDay ? new Date(start.getTime() + 86400000) : new Date(start.getTime() + 3600000));
    const uid = `event-${ev.id}@immoverwaltung`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toIcalDate(new Date(), false)}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toIcalDate(start, true)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcalDate(end, true)}`);
    } else {
      lines.push(`DTSTART:${toIcalDate(start, false)}`);
      lines.push(`DTEND:${toIcalDate(end, false)}`);
    }
    lines.push(`SUMMARY:${escapeIcal(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcal(ev.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
