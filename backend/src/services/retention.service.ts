import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { deleteOldAuditLogs } from "./audit.service.js";
import { startImapSync, stopImapSync } from "./imap-sync.service.js";
import { processRecurringTransactions } from "./recurring-transaction.service.js";
import { markOverduePayments } from "./dunning.service.js";
import { processOverdueSchedules } from "./maintenance-schedule.service.js";
import { syncAllAccounts } from "./banking.service.js";
import { matchAllPendingTransactions } from "./matching.service.js";
import { sendDigestEmails } from "./email.service.js";

/**
 * DSGVO Art. 17 / Art. 5(1)(e) - Aufbewahrungsfristen
 *
 * Loescht automatisch Dokumente, deren Aufbewahrungsfrist (retentionUntil)
 * abgelaufen ist. Entfernt sowohl die Datei von der Festplatte als auch
 * den Datenbank-Eintrag.
 *
 * Wird beim Server-Start gestartet und laeuft alle 60 Minuten.
 */

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 Stunde
const BANKING_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Stunden

// In-memory dedup: avoids double-sending if server restarts during the 8 AM hour
const digestSentAt = new Map<string, number>();

async function processDigests(): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  if (hour !== 8) return;

  const day = now.getDay();   // 0=Sun, 1=Mon
  const date = now.getDate();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const companies = await prisma.company.findMany({ select: { id: true } });

  for (const company of companies) {
    for (const freq of ["TAEGLICH", "WOECHENTLICH", "MONATLICH"] as const) {
      if (freq === "WOECHENTLICH" && day !== 1) continue;
      if (freq === "MONATLICH" && date !== 1) continue;

      const key = `${company.id}:${freq}`;
      if ((digestSentAt.get(key) ?? 0) >= dayStart) continue; // Already sent today

      digestSentAt.set(key, Date.now());
      await sendDigestEmails(company.id, freq).catch((err) =>
        logger.error({ err, companyId: company.id, freq }, "[DIGEST] Fehler beim Senden"),
      );
    }
  }
}

export async function cleanupExpiredDocuments(): Promise<number> {
    const now = new Date();

    const expired = await prisma.document.findMany({
        where: {
            retentionUntil: { lte: now },
        },
    });

    if (expired.length === 0) return 0;

    for (const doc of expired) {
        if (doc.filePath) {
            try {
                fs.unlinkSync(doc.filePath);
            } catch {
                // Datei moeglicherweise schon geloescht
            }
        }
        await prisma.document.delete({ where: { id: doc.id } });
        logger.info({ documentId: doc.id, name: doc.name, retentionUntil: doc.retentionUntil }, "[DSGVO-CLEANUP] Dokument geloescht");
    }

    logger.info({ count: expired.length }, "[DSGVO-CLEANUP] Abgelaufene Dokumente entfernt");
    return expired.length;
}

export async function cleanupExpiredRefreshTokens(): Promise<number> {
    const { count } = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) {
        logger.info({ count }, "[TOKEN-CLEANUP] Abgelaufene Refresh-Tokens geloescht");
    }
    return count;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let bankingSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startRetentionCleanup(): void {
    // Sofort einmal ausfuehren
    Promise.all([
        cleanupExpiredDocuments(),
        cleanupExpiredRefreshTokens(),
        deleteOldAuditLogs(90).then((count) => {
            if (count > 0) logger.info({ count }, "[DSGVO-CLEANUP] Alte Audit-Logs geloescht (>90 Tage)");
        }),
        processRecurringTransactions().catch((err) => logger.error({ err }, "[RECURRING] Fehler beim Verarbeiten")),
        markOverduePayments().catch((err) => logger.error({ err }, "[MAHNWESEN] Fehler")),
        processOverdueSchedules().catch((err) => logger.error({ err }, "[WARTUNGSPLAN] Fehler")),
    ]).catch((err) => logger.error({ err }, "[CLEANUP] Fehler beim initialen Cleanup"));

    // Dann stuendlich
    cleanupTimer = setInterval(() => {
        Promise.all([
            cleanupExpiredDocuments(),
            cleanupExpiredRefreshTokens(),
            deleteOldAuditLogs(90).then((count) => {
                if (count > 0) logger.info({ count }, "[DSGVO-CLEANUP] Alte Audit-Logs geloescht (>90 Tage)");
            }),
            processRecurringTransactions().catch((err) => logger.error({ err }, "[RECURRING] Fehler beim Verarbeiten")),
            markOverduePayments().catch((err) => logger.error({ err }, "[MAHNWESEN] Fehler")),
            processOverdueSchedules().catch((err) => logger.error({ err }, "[WARTUNGSPLAN] Fehler")),
            processDigests().catch((err) => logger.error({ err }, "[DIGEST] Fehler")),
        ]).catch((err) => logger.error({ err }, "[CLEANUP] Fehler beim periodischen Cleanup"));
    }, CLEANUP_INTERVAL_MS);

    logger.info("Aufbewahrungsfristen-Cleanup gestartet (Intervall: 1h)");

    // Banking sync every 6 hours (PSD2 rate limit: max 4x/day per account)
    bankingSyncTimer = setInterval(() => {
        syncAllAccounts()
            .then(() => matchAllPendingTransactions())
            .catch((err) => logger.error({ err }, "[BANKING-SYNC] Fehler beim automatischen Sync"));
    }, BANKING_SYNC_INTERVAL_MS);

    logger.info("Banking-Sync gestartet (Intervall: 6h)");
    startImapSync();
}

export function stopRetentionCleanup(): void {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    if (bankingSyncTimer) {
        clearInterval(bankingSyncTimer);
        bankingSyncTimer = null;
    }
    stopImapSync();
}
