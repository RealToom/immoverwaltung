import nodemailer from "nodemailer";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { decryptString, decryptFile } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

export async function listMessages(companyId: number, opts: {
  page: number; limit: number; accountId?: number;
  isRead?: boolean; isInquiry?: boolean; inquiryStatus?: string;
}) {
  const where = {
    companyId,
    ...(opts.accountId ? { emailAccountId: opts.accountId } : {}),
    ...(opts.isRead !== undefined ? { isRead: opts.isRead } : {}),
    ...(opts.isInquiry !== undefined ? { isInquiry: opts.isInquiry } : {}),
    ...(opts.inquiryStatus ? { inquiryStatus: opts.inquiryStatus as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.emailMessage.findMany({
      where, orderBy: { receivedAt: "desc" },
      skip: (opts.page - 1) * opts.limit, take: opts.limit,
      select: { id: true, fromAddress: true, fromName: true, subject: true, receivedAt: true,
                isRead: true, isInquiry: true, inquiryStatus: true, suggestedEventId: true,
                attachments: { select: { id: true, filename: true, mimeType: true, size: true } } },
    }),
    prisma.emailMessage.count({ where }),
  ]);

  return { data, meta: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) } };
}

export async function getMessage(companyId: number, id: number) {
  const msg = await prisma.emailMessage.findFirst({
    where: { id, companyId },
    include: { attachments: true, emailAccount: { select: { email: true, label: true } } },
  });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");
  return msg;
}

export async function updateMessage(companyId: number, id: number, data: {
  isRead?: boolean; isInquiry?: boolean; inquiryStatus?: string;
}) {
  const msg = await prisma.emailMessage.findFirst({ where: { id, companyId } });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");
  return prisma.emailMessage.update({ where: { id }, data: data as never });
}

async function getSmtpTransport(accountId: number) {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError(404, "Postfach nicht gefunden");
  const password = decryptString(account.encryptedPassword);
  return {
    transport: nodemailer.createTransport({
      host: account.smtpHost, port: account.smtpPort,
      secure: account.smtpTls, auth: { user: account.imapUser, pass: password },
    }),
    fromEmail: account.email,
  };
}

export async function replyToMessage(companyId: number, messageId: number, body: string) {
  const msg = await getMessage(companyId, messageId);
  const { transport, fromEmail } = await getSmtpTransport(msg.emailAccountId);

  await transport.sendMail({
    from: fromEmail,
    to: msg.fromAddress,
    subject: `Re: ${msg.subject}`,
    text: body,
  });

  logger.info({ messageId, to: msg.fromAddress }, "[EMAIL] Antwort gesendet");
}

export async function sendDocument(companyId: number, messageId: number, documentId: number, body: string) {
  const [msg, doc] = await Promise.all([
    getMessage(companyId, messageId),
    prisma.document.findFirst({ where: { id: documentId, companyId } }),
  ]);
  if (!doc) throw new AppError(404, "Dokument nicht gefunden");

  const { transport, fromEmail } = await getSmtpTransport(msg.emailAccountId);

  let attachmentContent: Buffer | null = null;
  if (doc.filePath) {
    attachmentContent = doc.isEncrypted ? decryptFile(doc.filePath) : fs.readFileSync(doc.filePath);
  }

  await transport.sendMail({
    from: fromEmail,
    to: msg.fromAddress,
    subject: `Re: ${msg.subject}`,
    text: body,
    ...(attachmentContent ? { attachments: [{ filename: doc.name, content: attachmentContent }] } : {}),
  });

  logger.info({ messageId, documentId, to: msg.fromAddress }, "[EMAIL] Dokument gesendet");
}

export async function createEventFromEmail(companyId: number, userId: number, messageId: number, data: {
  title: string; start: Date; end?: Date; allDay?: boolean;
}) {
  const msg = await prisma.emailMessage.findFirst({ where: { id: messageId, companyId } });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");

  // Remove old AI suggestion if present
  if (msg.suggestedEventId) {
    await prisma.calendarEvent.deleteMany({ where: { id: msg.suggestedEventId } });
  }

  const event = await prisma.calendarEvent.create({
    data: { ...data, type: "AUTO_EMAIL", color: "#3b82f6", companyId, createdByUserId: userId, sourceId: messageId },
  });
  await prisma.emailMessage.update({ where: { id: messageId }, data: { suggestedEventId: event.id } });
  return event;
}
