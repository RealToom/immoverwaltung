import { prisma } from "../lib/prisma.js";

interface ActivityItem {
  type: "payment" | "tenant" | "maintenance";
  text: string;
  detail: string;
  time: string;
  createdAt: string;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return diffMin <= 1 ? "vor 1 Min." : `vor ${diffMin} Min.`;
  if (diffHours < 24) return diffHours === 1 ? "vor 1 Std." : `vor ${diffHours} Std.`;
  if (diffDays === 1) return "Gestern";
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return `vor ${Math.floor(diffDays / 7)} Wo.`;
}

export async function getRecentActivity(companyId: number): Promise<ActivityItem[]> {
  const [transactions, tenants, tickets] = await Promise.all([
    prisma.transaction.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 10,
      include: { property: { select: { name: true } } },
    }),
    prisma.tenant.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { units: { include: { property: { select: { name: true } } } } },
    }),
    prisma.maintenanceTicket.findMany({
      where: { companyId, status: "ERLEDIGT" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { property: { select: { name: true } } },
    }),
  ]);

  const items: (ActivityItem & { sortDate: Date })[] = [];

  for (const tx of transactions) {
    const isIncome = tx.type === "EINNAHME";
    items.push({
      type: "payment",
      text: isIncome ? "Mietzahlung eingegangen" : "Ausgabe verbucht",
      detail: `${tx.description} – ${tx.property?.name ?? "Allgemein"}`,
      time: timeAgo(tx.date),
      createdAt: tx.date.toISOString(),
      sortDate: tx.date,
    });
  }

  for (const t of tenants) {
    const firstUnit = t.units[0];
    const unitInfo = firstUnit
      ? `${firstUnit.property.name}, ${firstUnit.number}`
      : "";
    items.push({
      type: "tenant",
      text: "Neuer Mieter eingezogen",
      detail: `${t.name}${unitInfo ? ` – ${unitInfo}` : ""}`,
      time: timeAgo(t.createdAt),
      createdAt: t.createdAt.toISOString(),
      sortDate: t.createdAt,
    });
  }

  for (const ticket of tickets) {
    items.push({
      type: "maintenance",
      text: "Wartungsauftrag abgeschlossen",
      detail: `${ticket.title} – ${ticket.property.name}`,
      time: timeAgo(ticket.updatedAt),
      createdAt: ticket.updatedAt.toISOString(),
      sortDate: ticket.updatedAt,
    });
  }

  items.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  return items.slice(0, 8).map(({ sortDate: _, ...rest }) => rest);
}

export async function getDashboardStats(companyId: number) {
  const [
    propertyCount,
    unitStats,
    tenantCount,
    openTickets,
    urgentTickets,
  ] = await Promise.all([
    prisma.property.count({ where: { companyId } }),

    prisma.unit.aggregate({
      where: { property: { companyId } },
      _count: true,
      _sum: { rent: true },
    }),

    prisma.tenant.count({ where: { companyId } }),

    prisma.maintenanceTicket.count({
      where: { companyId, status: { in: ["OFFEN", "IN_BEARBEITUNG", "WARTEND"] } },
    }),

    prisma.maintenanceTicket.count({
      where: { companyId, priority: { in: ["HOCH", "DRINGEND"] }, status: { not: "ERLEDIGT" } },
    }),
  ]);

  const occupiedUnits = await prisma.unit.count({
    where: { property: { companyId }, status: "VERMIETET" },
  });

  const vacantUnits = await prisma.unit.count({
    where: { property: { companyId }, status: "FREI" },
  });

  const monthlyRevenue = await prisma.unit.aggregate({
    where: { property: { companyId }, status: "VERMIETET" },
    _sum: { rent: true },
  });

  return {
    properties: propertyCount,
    totalUnits: unitStats._count,
    occupiedUnits,
    vacantUnits,
    tenants: tenantCount,
    monthlyRevenue: monthlyRevenue._sum.rent ?? 0,
    openTickets,
    urgentTickets,
  };
}
