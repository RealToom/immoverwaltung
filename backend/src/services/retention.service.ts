import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { deleteOldAuditLogs } from "./audit.service.js";
import { startImapSync, stopImapSync } from "./imap-sync.service.js";
import { processRecurringTransactions } from "./recurring-transaction.service.js";
import { markOverduePayments } from "./dunning.service.js";
import { processOverdueSchedules } from "./maintenance-schedule.service.js";

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
        ]).catch((err) => logger.error({ err }, "[CLEANUP] Fehler beim periodischen Cleanup"));
    }, CLEANUP_INTERVAL_MS);

    logger.info("Aufbewahrungsfristen-Cleanup gestartet (Intervall: 1h)");
    startImapSync();
}

export function stopRetentionCleanup(): void {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    stopImapSync();
}
