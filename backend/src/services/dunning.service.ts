import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { isEmailEnabled, sendMail } from "../config/email.js";

export async function listDunning(companyId: number, contractId?: number) {
  return prisma.dunningRecord.findMany({
    where: { companyId, ...(contractId ? { contractId } : {}) },
    include: {
      contract: {
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, number: true } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });
}

export async function sendDunning(companyId: number, contractId: number) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId },
    include: {
      tenant: true,
      property: true,
      dunningRecords: { where: { status: "OFFEN" }, orderBy: { level: "desc" }, take: 1 },
      rentPayments: { where: { status: { in: ["AUSSTEHEND", "VERSPAETET"] } } },
    },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");

  const overdueAmount = contract.rentPayments.reduce(
    (sum, p) => sum + (p.amountDue - p.amountPaid),
    0,
  );
  if (overdueAmount <= 0) throw new AppError(400, "Keine offenen Zahlungen vorhanden");

  const lastLevel = contract.dunningRecords[0]?.level ?? 0;
  if (lastLevel >= 3) throw new AppError(400, "Maximale Mahnstufe (3) bereits erreicht");

  const level = lastLevel + 1;
  const daysUntilDue = [14, 7, 5][level - 1];
  const dueDate = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);

  const record = await prisma.dunningRecord.create({
    data: {
      level,
      sentAt: new Date(),
      dueDate,
      totalAmount: overdueAmount,
      contractId,
      companyId,
    },
  });

  if (isEmailEnabled) {
    const levelLabels = ["", "Erste Mahnung", "Zweite Mahnung", "Letzte Mahnung"];
    await sendMail(
      contract.tenant.email,
      `${levelLabels[level]}: Ausstehende Mietzahlung`,
      `<p>Sehr geehrte/r ${contract.tenant.name},</p>
      <p>wir weisen Sie darauf hin, dass ein Betrag von <strong>${overdueAmount.toFixed(2)} €</strong>
      für ${contract.property.name} noch aussteht.</p>
      <p>Bitte begleichen Sie den Betrag bis zum ${dueDate.toLocaleDateString("de-DE")}.</p>`,
    );
    logger.info({ contractId, level, amount: overdueAmount }, "[MAHNWESEN] Mahnung versendet");
  }

  return record;
}

export async function resolveDunning(companyId: number, id: number) {
  const rec = await prisma.dunningRecord.findFirst({ where: { id, companyId } });
  if (!rec) throw new AppError(404, "Mahnung nicht gefunden");
  return prisma.dunningRecord.update({ where: { id }, data: { status: "BEZAHLT" } });
}

export async function markOverduePayments(): Promise<number> {
  const { count } = await prisma.rentPayment.updateMany({
    where: { status: "AUSSTEHEND", dueDate: { lt: new Date() } },
    data: { status: "VERSPAETET" },
  });
  if (count > 0) logger.info({ count }, "[MAHNWESEN] Zahlungen als VERSPAETET markiert");
  return count;
}
