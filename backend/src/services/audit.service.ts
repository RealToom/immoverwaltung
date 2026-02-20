import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { Prisma } from "@prisma/client";

export interface AuditContext {
  userId?: number;
  companyId?: number;
  ip?: string;
}

/**
 * Schreibt einen Audit-Log-Eintrag in die DB (DSGVO Art. 5).
 * Schlägt stumm fehl (mit Pino-Warnung) damit Hauptoperation nicht blockiert wird.
 */
export async function createAuditLog(
  action: string,
  ctx: AuditContext,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: ctx.userId ?? null,
        companyId: ctx.companyId ?? null,
        ip: ctx.ip ?? null,
        details: details as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Audit-Log-Fehler dürfen die Hauptoperation nicht blockieren
    logger.warn({ err, action, ctx }, "Audit-Log konnte nicht gespeichert werden");
  }
}

/**
 * Löscht Audit-Logs die älter als `days` Tage sind (DSGVO-Retention).
 * Aufgerufen aus retention.service.ts.
 */
export async function deleteOldAuditLogs(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
