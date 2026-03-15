import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listBudgets(companyId: number, propertyId?: number, year?: number) {
  return prisma.maintenanceBudget.findMany({
    where: {
      companyId,
      ...(propertyId ? { propertyId } : {}),
      ...(year ? { year } : {}),
    },
    include: { property: { select: { id: true, name: true, street: true, city: true } } },
    orderBy: [{ year: "desc" }, { propertyId: "asc" }],
  });
}

export async function upsertBudget(
  companyId: number,
  data: { propertyId: number; year: number; plannedAmount: number; notes?: string | null },
) {
  // Verify property belongs to company
  const property = await prisma.property.findFirst({ where: { id: data.propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  return prisma.maintenanceBudget.upsert({
    where: { companyId_propertyId_year: { companyId, propertyId: data.propertyId, year: data.year } },
    create: { companyId, propertyId: data.propertyId, year: data.year, plannedAmount: data.plannedAmount, notes: data.notes ?? null },
    update: { plannedAmount: data.plannedAmount, notes: data.notes ?? null },
    include: { property: { select: { id: true, name: true, street: true, city: true } } },
  });
}

export async function deleteBudget(companyId: number, id: number) {
  const existing = await prisma.maintenanceBudget.findFirst({ where: { id, companyId } });
  if (!existing) throw new AppError(404, "Budget nicht gefunden");
  await prisma.maintenanceBudget.delete({ where: { id } });
}

export async function getBudgetWithActual(companyId: number, propertyId: number, year: number) {
  const [budget, transactions] = await Promise.all([
    prisma.maintenanceBudget.findUnique({
      where: { companyId_propertyId_year: { companyId, propertyId, year } },
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        propertyId,
        type: "AUSGABE",
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
        category: "Instandhaltung",
      },
      select: { amount: true },
    }),
  ]);

  const actualAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  return { budget, actualAmount, year, propertyId };
}

export async function getBudgetSummary(companyId: number, year: number) {
  const [budgets, transactions] = await Promise.all([
    prisma.maintenanceBudget.findMany({
      where: { companyId, year },
      include: { property: { select: { id: true, name: true } } },
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        type: "AUSGABE",
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        category: "Instandhaltung",
        propertyId: { not: null },
      },
      select: { propertyId: true, amount: true },
    }),
  ]);

  // Group actual costs by propertyId
  const actualByProperty = new Map<number, number>();
  for (const t of transactions) {
    if (t.propertyId) {
      actualByProperty.set(t.propertyId, (actualByProperty.get(t.propertyId) ?? 0) + t.amount);
    }
  }

  return budgets.map((b) => ({
    ...b,
    actualAmount: actualByProperty.get(b.propertyId) ?? 0,
  }));
}
