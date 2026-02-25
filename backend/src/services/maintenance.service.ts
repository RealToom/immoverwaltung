import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";
import { paginationMeta } from "../schemas/common.schema.js";
import { notifyMaintenanceCreated } from "./email.service.js";
import { logger } from "../lib/logger.js";
import type { MaintenanceStatus, MaintenancePriority, MaintenanceCategory, Prisma } from "@prisma/client";

interface MaintenanceQuery {
  page: number;
  limit: number;
  search: string;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  category?: MaintenanceCategory;
  propertyId?: number;
  from?: Date;
  to?: Date;
}

interface CreateTicketData {
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  unitLabel: string;
  reportedBy: string;
  assignedTo?: string | null;
  dueDate?: Date | null;
  cost?: number | null;
  notes?: string | null;
  propertyId: number;
  unitId?: number | null;
}

type UpdateTicketData = Partial<CreateTicketData> & {
  status?: MaintenanceStatus;
};

const ticketInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, number: true } },
} as const;

export async function listTickets(companyId: number, params: MaintenanceQuery) {
  const { page, limit, search, status, priority, category, propertyId, from, to } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.MaintenanceTicketWhereInput = { companyId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (propertyId) where.propertyId = propertyId;
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: from }),
      ...(to && { lte: to }),
    };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { property: { name: { contains: search, mode: "insensitive" } } },
      { reportedBy: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.maintenanceTicket.count({ where }),
  ]);

  return { data: tickets, meta: paginationMeta(total, page, limit) };
}

export async function getTicket(companyId: number, id: number) {
  const ticket = await prisma.maintenanceTicket.findFirst({
    where: { id, companyId },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, number: true } },
    },
  });
  if (!ticket) throw new NotFoundError("Wartungsauftrag", id);
  return ticket;
}

export async function createTicket(companyId: number, data: CreateTicketData) {
  const ticket = await prisma.maintenanceTicket.create({
    data: { ...data, companyId },
    include: ticketInclude,
  });

  if (data.priority === "HOCH" || data.priority === "DRINGEND") {
    notifyMaintenanceCreated(companyId, {
      title: data.title,
      priority: data.priority,
      propertyName: ticket.property.name,
      reportedBy: data.reportedBy,
    }).catch((err) => logger.error({ err }, "E-Mail-Benachrichtigung fehlgeschlagen"));
  }

  // Auto-set property status to WARTUNG when a ticket is created
  await prisma.property.updateMany({
    where: { id: data.propertyId, companyId, status: "AKTIV" },
    data: { status: "WARTUNG" },
  });

  return ticket;
}

export async function updateTicket(companyId: number, id: number, data: UpdateTicketData) {
  const existing = await prisma.maintenanceTicket.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Wartungsauftrag", id);

  const updated = await prisma.maintenanceTicket.update({
    where: { id },
    data,
    include: ticketInclude,
  });

  // When a ticket is resolved (ERLEDIGT), check if there are remaining open tickets
  if (data.status === "ERLEDIGT" && updated.propertyId) {
    const openCount = await prisma.maintenanceTicket.count({
      where: {
        propertyId: updated.propertyId,
        companyId,
        status: { in: ["OFFEN", "IN_BEARBEITUNG", "WARTEND"] },
      },
    });
    if (openCount === 0) {
      await prisma.property.updateMany({
        where: { id: updated.propertyId, companyId, status: "WARTUNG" },
        data: { status: "AKTIV" },
      });
    }
  }

  return updated;
}

export async function deleteTicket(companyId: number, id: number) {
  const existing = await prisma.maintenanceTicket.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Wartungsauftrag", id);

  return prisma.maintenanceTicket.delete({ where: { id } });
}
