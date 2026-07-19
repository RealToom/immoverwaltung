import { prisma } from "../lib/prisma.js";
import {
  DEFAULT_LAYOUT,
  filterLayoutForRole,
  type LayoutItem,
} from "../lib/dashboardWidgets.js";

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
    setupStatus: {
      smtpSet: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      nordigenSet: !!(process.env.NORDIGEN_SECRET_ID && process.env.NORDIGEN_SECRET_KEY),
      anthropicSet: !!process.env.ANTHROPIC_API_KEY,
    }
  };
}

export async function getDashboardLayout(
  companyId: number,
  userId: number,
  role: string,
): Promise<LayoutItem[]> {
  const row = await prisma.dashboardLayout.findUnique({ where: { userId } });
  const stored = (row?.widgets as LayoutItem[] | undefined) ?? [];
  const base = row ? stored : DEFAULT_LAYOUT;
  return filterLayoutForRole(base, role);
}

export async function saveDashboardLayout(
  companyId: number,
  userId: number,
  widgets: LayoutItem[],
): Promise<LayoutItem[]> {
  const row = await prisma.dashboardLayout.upsert({
    where: { userId },
    create: { userId, companyId, widgets },
    update: { widgets },
  });
  return row.widgets as LayoutItem[];
}

export async function getRevenueSeries(
  companyId: number,
): Promise<{ month: string; label: string; total: number }[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const txns = await prisma.transaction.findMany({
    where: { companyId, type: "EINNAHME", date: { gte: start } },
    select: { date: true, amount: true },
  });

  const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const buckets: { month: string; label: string; total: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ month: key, label: MONTHS[d.getMonth()], total: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const tx of txns) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i !== undefined) buckets[i].total += tx.amount;
  }
  return buckets;
}

export async function getExpiringCertificates(
  companyId: number,
): Promise<{ id: number; propertyName: string; energyClass: string; validUntil: string }[]> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 365); // ablaufend innerhalb 12 Monaten

  const rows = await prisma.energyPassport.findMany({
    where: { property: { companyId }, validUntil: { lte: horizon } },
    orderBy: { validUntil: "asc" },
    take: 10,
    include: { property: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    propertyName: r.property.name,
    energyClass: r.energyClass,
    validUntil: r.validUntil.toISOString(),
  }));
}
