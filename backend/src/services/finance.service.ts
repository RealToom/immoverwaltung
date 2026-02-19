import { prisma } from "../lib/prisma.js";
import type { TransactionType } from "@prisma/client";
import { paginationMeta } from "../schemas/common.schema.js";
import { notifyRentPayment } from "./email.service.js";

export async function getFinanceSummary(companyId: number) {
  const monthlyRevenue = await prisma.unit.aggregate({
    where: { property: { companyId }, status: "VERMIETET" },
    _sum: { rent: true },
  });

  const income = await prisma.transaction.aggregate({
    where: { companyId, type: "EINNAHME" },
    _sum: { amount: true },
  });

  const expenses = await prisma.transaction.aggregate({
    where: { companyId, type: "AUSGABE" },
    _sum: { amount: true },
  });

  const totalIncome = income._sum.amount ?? 0;
  const totalExpenses = Math.abs(expenses._sum.amount ?? 0);

  return {
    monthlyRevenue: monthlyRevenue._sum.rent ?? 0,
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
  };
}

export async function getMonthlyRevenue(companyId: number, months: number = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });

  const monthlyData: Record<string, { einnahmen: number; ausgaben: number }> = {};

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyData[key]) {
      monthlyData[key] = { einnahmen: 0, ausgaben: 0 };
    }
    if (tx.type === "EINNAHME") {
      monthlyData[key].einnahmen += tx.amount;
    } else {
      monthlyData[key].ausgaben += Math.abs(tx.amount);
    }
  }

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    einnahmen: data.einnahmen,
    ausgaben: data.ausgaben,
    netto: data.einnahmen - data.ausgaben,
  }));
}

export async function getRevenueByProperty(companyId: number) {
  const properties = await prisma.property.findMany({
    where: { companyId },
    include: {
      units: {
        select: { rent: true, status: true },
      },
    },
  });

  return properties.map((p) => {
    const totalPotential = p.units.reduce((sum, u) => sum + u.rent, 0);
    const actualRevenue = p.units
      .filter((u) => u.status === "VERMIETET")
      .reduce((sum, u) => sum + u.rent, 0);

    return {
      propertyId: p.id,
      propertyName: p.name,
      actualRevenue,
      potentialRevenue: totalPotential,
      occupancyRate: p.units.length > 0
        ? Math.round((p.units.filter((u) => u.status === "VERMIETET").length / p.units.length) * 100)
        : 0,
    };
  });
}

interface TransactionQuery {
  page: number;
  limit: number;
  search: string;
  type?: TransactionType;
  bankAccountId?: number;
}

export async function listTransactions(companyId: number, params: TransactionQuery) {
  const { page, limit, search, type, bankAccountId } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (type) where.type = type;
  if (bankAccountId) where.bankAccountId = bankAccountId;
  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { data: transactions, meta: paginationMeta(total, page, limit) };
}

export async function getExpenseBreakdown(companyId: number) {
  const expenses = await prisma.transaction.findMany({
    where: { companyId, type: "AUSGABE" },
    select: { category: true, amount: true },
  });

  const categoryMap: Record<string, number> = {};
  for (const tx of expenses) {
    const cat = tx.category || "Sonstiges";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + Math.abs(tx.amount);
  }

  return Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getRentCollection(companyId: number, months: number = 8) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const payments = await prisma.rentPayment.findMany({
    where: {
      companyId,
      month: { gte: startMonth },
    },
    orderBy: { month: "asc" },
  });

  // Group by month and compute percentages
  const monthlyMap: Record<string, { total: number; puenktlich: number; verspaetet: number; ausstehend: number }> = {};

  for (const p of payments) {
    const key = `${p.month.getFullYear()}-${String(p.month.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) {
      monthlyMap[key] = { total: 0, puenktlich: 0, verspaetet: 0, ausstehend: 0 };
    }
    monthlyMap[key].total++;
    if (p.status === "PUENKTLICH") monthlyMap[key].puenktlich++;
    else if (p.status === "VERSPAETET") monthlyMap[key].verspaetet++;
    else monthlyMap[key].ausstehend++;
  }

  return Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      puenktlich: Math.round((data.puenktlich / data.total) * 100),
      verspaetet: Math.round((data.verspaetet / data.total) * 100),
      ausstehend: Math.round((data.ausstehend / data.total) * 100),
    }));
}

export async function createTransaction(
  companyId: number,
  data: { date: Date; description: string; type: TransactionType; amount: number; category?: string; propertyId?: number | null; bankAccountId?: number | null; }
) {
  const transaction = await prisma.transaction.create({
    data: {
      ...data,
      companyId,
      propertyId: data.propertyId ?? null,
      bankAccountId: data.bankAccountId ?? null,
      category: data.category ?? "",
    },
    include: {
      property: { select: { id: true, name: true } },
      bankAccount: { select: { id: true, name: true } },
    },
  });

  if (data.type === "EINNAHME") {
    const monthStr = data.date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    // TODO: Only notify if it allows explicit override or checking logic - keeping simple for now
    notifyRentPayment(companyId, {
      tenantName: data.description,
      amount: data.amount,
      month: monthStr,
    }).catch((err) => console.error("E-Mail-Benachrichtigung fehlgeschlagen:", err));
  }

  return transaction;
}

export async function updateTransaction(
  companyId: number,
  id: number,
  data: { allocatable?: boolean; category?: string }
) {
  const existing = await prisma.transaction.findFirst({ where: { id, companyId } });
  if (!existing) {
    const { NotFoundError } = await import("../lib/errors.js");
    throw new NotFoundError("Transaktion", id);
  }
  return prisma.transaction.update({ where: { id }, data });
}

export async function getUtilityStatement(companyId: number, propertyId: number, year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  // All allocatable AUSGABE transactions for this property in the given year
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      propertyId,
      type: "AUSGABE",
      allocatable: true,
      date: { gte: startDate, lt: endDate },
    },
  });

  const totalCosts = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // All VERMIETET units with tenant
  const units = await prisma.unit.findMany({
    where: {
      propertyId,
      property: { companyId },
      status: "VERMIETET",
      tenantId: { not: null },
    },
    include: { tenant: { select: { id: true, name: true } } },
  });

  const totalArea = units.reduce((sum, u) => sum + u.area, 0);

  const items = units.map((u) => {
    const areaPercent = totalArea > 0 ? (u.area / totalArea) * 100 : 0;
    const amount = totalArea > 0 ? totalCosts * (u.area / totalArea) : 0;
    return {
      unitId: u.id,
      unitNumber: u.number,
      tenantName: u.tenant?.name ?? "–",
      area: u.area,
      areaPercent: Math.round(areaPercent * 100) / 100,
      amount: Math.round(amount * 100) / 100,
    };
  });

  return { year, propertyId, totalCosts, totalArea, items };
}

export async function getRoiData(companyId: number, year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const properties = await prisma.property.findMany({
    where: { companyId },
    select: { id: true, name: true, purchasePrice: true, equity: true },
  });

  const results = await Promise.all(
    properties.map(async (p) => {
      const [incomeAgg, expenseAgg] = await Promise.all([
        prisma.transaction.aggregate({
          where: { companyId, propertyId: p.id, type: "EINNAHME", date: { gte: startDate, lt: endDate } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { companyId, propertyId: p.id, type: "AUSGABE", date: { gte: startDate, lt: endDate } },
          _sum: { amount: true },
        }),
      ]);

      const annualIncome = incomeAgg._sum.amount ?? 0;
      const annualExpenses = Math.abs(expenseAgg._sum.amount ?? 0);
      const netIncome = annualIncome - annualExpenses;

      const bruttorendite = p.purchasePrice ? (annualIncome / p.purchasePrice) * 100 : null;
      const nettorendite = p.purchasePrice ? (netIncome / p.purchasePrice) * 100 : null;
      const ekRendite = p.equity ? (netIncome / p.equity) * 100 : null;

      return {
        propertyId: p.id,
        name: p.name,
        purchasePrice: p.purchasePrice,
        equity: p.equity,
        annualIncome,
        annualExpenses,
        netIncome,
        bruttorendite: bruttorendite !== null ? Math.round(bruttorendite * 100) / 100 : null,
        nettorendite: nettorendite !== null ? Math.round(nettorendite * 100) / 100 : null,
        ekRendite: ekRendite !== null ? Math.round(ekRendite * 100) / 100 : null,
      };
    })
  );

  return results.sort((a, b) => {
    if (a.nettorendite === null && b.nettorendite === null) return 0;
    if (a.nettorendite === null) return 1;
    if (b.nettorendite === null) return -1;
    return b.nettorendite - a.nettorendite;
  });
}
