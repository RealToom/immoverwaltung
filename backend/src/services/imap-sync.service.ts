import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { decryptString } from "../lib/crypto.js";
import { env } from "../config/env.js";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let syncTimer: ReturnType<typeof setInterval> | null = null;

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface AiAnalysisResult {
  hasAppointment: boolean;
  appointmentTitle?: string;
  appointmentDate?: string; // ISO string
  isInquiry: boolean;
}

async function analyzeEmailWithAi(subject: string, bodyText: string): Promise<AiAnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) return { hasAppointment: false, isInquiry: false };

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Analysiere diese E-Mail und antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text darum):
{
  "hasAppointment": boolean,
  "appointmentTitle": string or null,
  "appointmentDate": "ISO-8601-Datum" or null,
  "isInquiry": boolean
}

isInquiry=true wenn die Mail eine Wohnungsanfrage/Besichtigungswunsch von einem Interessenten ist.
hasAppointment=true wenn ein konkreter Termin mit Datum/Uhrzeit genannt wird.

Betreff: ${subject}
Text: ${bodyText.slice(0, 1000)}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    return JSON.parse(text) as AiAnalysisResult;
  } catch (err) {
    logger.warn({ err }, "[IMAP-SYNC] KI-Analyse fehlgeschlagen, übersprungen");
    return { hasAppointment: false, isInquiry: false };
  }
}

export async function syncAccount(accountId: number, companyId: number): Promise<void> {
  const account = await prisma.emailAccount.findFirst({ where: { id: accountId, companyId, isActive: true } });
  if (!account) return;

  const password = decryptString(account.encryptedPassword);

  let connection: Awaited<ReturnType<typeof imaps.connect>> | null = null;
  try {
    connection = await imaps.connect({
      imap: { host: account.imapHost, port: account.imapPort, tls: account.imapTls,
              user: account.imapUser, password, authTimeout: 10000 },
    });

    await connection.openBox("INBOX");

    // Only fetch messages since last sync (max 7 days back)
    const since = account.lastSync ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const searchCriteria = [["SINCE", since.toUTCString()]];
    const fetchOptions = { bodies: ["HEADER", "TEXT", ""], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);
    logger.info({ accountId, count: messages.length }, "[IMAP-SYNC] Neue Nachrichten gefunden");

    for (const msg of messages) {
      const fullBody = msg.parts.find((p) => p.which === "");
      if (!fullBody) continue;

      const parsed = await simpleParser(fullBody.body as string);
      const messageId = (parsed.messageId ?? `${accountId}-${msg.attributes.uid}`);

      // Duplicate guard
      const exists = await prisma.emailMessage.findUnique({ where: { messageId } });
      if (exists) continue;

      const bodyText = parsed.text ?? "";
      const subject = parsed.subject ?? "(kein Betreff)";

      // AI analysis
      const ai = await analyzeEmailWithAi(subject, bodyText);

      // Save email to DB
      const emailMsg = await prisma.emailMessage.create({
        data: {
          messageId,
          fromAddress: parsed.from?.value[0]?.address ?? "",
          fromName: parsed.from?.value[0]?.name ?? null,
          toAddress: account.email,
          subject,
          bodyText: bodyText.slice(0, 50000),
          bodyHtml: (parsed.html || null)?.slice(0, 200000) ?? null,
          receivedAt: parsed.date ?? new Date(),
          isInquiry: ai.isInquiry,
          inquiryStatus: ai.isInquiry ? "NEU" : null,
          emailAccountId: accountId,
          companyId,
        },
      });

      // AI appointment suggestion: create CalendarEvent
      if (ai.hasAppointment && ai.appointmentDate) {
        const event = await prisma.calendarEvent.create({
          data: {
            title: ai.appointmentTitle ?? subject,
            description: `Aus E-Mail von ${emailMsg.fromAddress}: ${subject}`,
            start: new Date(ai.appointmentDate),
            type: "AUTO_EMAIL",
            color: "#8b5cf6",
            companyId,
            sourceId: emailMsg.id,
          },
        });
        await prisma.emailMessage.update({
          where: { id: emailMsg.id },
          data: { suggestedEventId: event.id },
        });
      }

      // Save attachment metadata (no file storage)
      for (const attachment of parsed.attachments ?? []) {
        await prisma.emailAttachment.create({
          data: {
            filename: attachment.filename ?? "Anhang",
            mimeType: attachment.contentType,
            size: attachment.size ?? 0,
            emailMessageId: emailMsg.id,
            companyId,
          },
        });
      }
    }

    await prisma.emailAccount.update({ where: { id: accountId }, data: { lastSync: new Date() } });
    logger.info({ accountId, processed: messages.length }, "[IMAP-SYNC] Account synchronisiert");
  } catch (err) {
    logger.error({ err, accountId }, "[IMAP-SYNC] Fehler beim Sync");
  } finally {
    if (connection) {
      try { await connection.end(); } catch { /* ignore */ }
    }
  }
}

export async function syncAllAccounts(): Promise<void> {
  const accounts = await prisma.emailAccount.findMany({ where: { isActive: true }, select: { id: true, companyId: true } });
  for (const acc of accounts) {
    await syncAccount(acc.id, acc.companyId);
  }
}

export function startImapSync(): void {
  syncAllAccounts().catch((err) => logger.error({ err }, "[IMAP-SYNC] Fehler beim initialen Sync"));
  syncTimer = setInterval(() => {
    syncAllAccounts().catch((err) => logger.error({ err }, "[IMAP-SYNC] Fehler beim periodischen Sync"));
  }, SYNC_INTERVAL_MS);
  logger.info("IMAP-Sync gestartet (Intervall: 5 Min)");
}

export function stopImapSync(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}
