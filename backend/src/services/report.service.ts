import { prisma } from "../lib/prisma.js";

export interface ReportData {
  from?: Date;
  to?: Date;
  properties: Array<{
    name: string;
    totalUnits: number;
    occupiedUnits: number;
    monthlyRevenue: number;
  }>;
  income: number;
  expenses: number;
  ticketCount: number;
}

export async function generateReportData(
  companyId: number,
  from?: Date,
  to?: Date,
): Promise<ReportData> {
  const txDateFilter = from || to
    ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {};
  const ticketDateFilter = from || to
    ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {};

  const [properties, incomeAgg, expenseAgg, ticketCount] = await Promise.all([
    prisma.property.findMany({
      where: { companyId },
      include: { units: { select: { status: true, rent: true } } },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "EINNAHME", ...txDateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "AUSGABE", ...txDateFilter },
      _sum: { amount: true },
    }),
    prisma.maintenanceTicket.count({
      where: { companyId, ...ticketDateFilter },
    }),
  ]);

  return {
    from,
    to,
    properties: properties.map((p) => ({
      name: p.name,
      totalUnits: p.units.length,
      occupiedUnits: p.units.filter((u) => u.status === "VERMIETET").length,
      monthlyRevenue: p.units
        .filter((u) => u.status === "VERMIETET")
        .reduce((s, u) => s + u.rent, 0),
    })),
    income: incomeAgg._sum.amount ?? 0,
    expenses: Math.abs(expenseAgg._sum.amount ?? 0),
    ticketCount,
  };
}

// German-locale number formatting (comma as decimal separator)
function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function generateReportCsv(data: ReportData): Buffer {
  const fromStr = data.from ? data.from.toLocaleDateString("de-DE") : "Beginn";
  const toStr = data.to ? data.to.toLocaleDateString("de-DE") : "Heute";
  const net = data.income - data.expenses;

  const lines: string[] = [
    "Immobilienverwaltung \u2013 Bericht",
    `Zeitraum;${fromStr};bis;${toStr}`,
    "",
    "Immobilien",
    "Name;Einheiten gesamt;Einheiten belegt;Monatliche Einnahmen (EUR)",
    ...data.properties.map(
      (p) =>
        `${p.name};${p.totalUnits};${p.occupiedUnits};${fmt(p.monthlyRevenue)}`,
    ),
    "",
    "Finanzsummary",
    "Einnahmen (EUR);Ausgaben (EUR);Netto (EUR)",
    `${fmt(data.income)};${fmt(data.expenses)};${fmt(net)}`,
    "",
    "Wartungstickets",
    `Anzahl Tickets im Zeitraum;${data.ticketCount}`,
  ];

  // UTF-8 BOM + CRLF (matches DATEV export convention in this codebase)
  const BOM = "\uFEFF";
  return Buffer.from(BOM + lines.join("\r\n"), "utf-8");
}
