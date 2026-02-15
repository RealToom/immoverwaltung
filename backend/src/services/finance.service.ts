import { prisma } from "../lib/prisma.js";
import type { TransactionType } from "@prisma/client";
import { paginationMeta } from "../schemas/common.schema.js";

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
}

export async function listTransactions(companyId: number, params: TransactionQuery) {
  const { page, limit, search, type } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };
  if (type) where.type = type;
  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { property: { select: { id: true, name: true } } },
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
  data: { date: Date; description: string; type: TransactionType; amount: number; category?: string; propertyId?: number | null }
) {
  return prisma.transaction.create({
    data: {
      ...data,
      companyId,
      propertyId: data.propertyId ?? null,
      category: data.category ?? "",
    },
    include: { property: { select: { id: true, name: true } } },
  });
}
