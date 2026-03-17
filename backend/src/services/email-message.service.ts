import nodemailer from "nodemailer";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { decryptString, decryptFile } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createDocument } from "./document.service.js";
import { env } from "../config/env.js";

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
                suggestedTenantId: true,
                suggestedPropertyId: true,
                tenantId: true,
                propertyId: true,
                suggestedTenant: { select: { id: true, name: true } },
                suggestedProperty: { select: { id: true, name: true } },
                tenant: { select: { id: true, name: true } },
                property: { select: { id: true, name: true } },
                attachments: { select: { id: true, filename: true, mimeType: true, size: true } } },
    }),
    prisma.emailMessage.count({ where }),
  ]);

  return { data, meta: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) } };
}

export async function getMessage(companyId: number, id: number) {
  const msg = await prisma.emailMessage.findFirst({
    where: { id, companyId },
    include: {
      attachments: true,
      emailAccount: { select: { email: true, label: true } },
      suggestedTenant: { select: { id: true, name: true } },
      suggestedProperty: { select: { id: true, name: true } },
      tenant: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
    },
  });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");
  return msg;
}

export async function updateMessage(companyId: number, id: number, data: {
  isRead?: boolean; isInquiry?: boolean; inquiryStatus?: string;
  suggestedTenantId?: null;
  suggestedPropertyId?: null;
}) {
  const msg = await prisma.emailMessage.findFirst({ where: { id, companyId } });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");
  return prisma.emailMessage.update({ where: { id }, data: data as never });
}

async function getSmtpTransport(accountId: number, companyId: number) {
  const account = await prisma.emailAccount.findFirst({ where: { id: accountId, companyId } });
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
  const { transport, fromEmail } = await getSmtpTransport(msg.emailAccountId, companyId);

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

  const { transport, fromEmail } = await getSmtpTransport(msg.emailAccountId, companyId);

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

export async function sendNewEmail(companyId: number, data: {
  accountId: number; to: string; subject: string; body: string;
}) {
  const { transport, fromEmail } = await getSmtpTransport(data.accountId, companyId);
  await transport.sendMail({
    from: fromEmail,
    to: data.to,
    subject: data.subject,
    text: data.body,
  });
  logger.info({ to: data.to, subject: data.subject }, "[EMAIL] Neue Nachricht gesendet");
}

export async function createEventFromEmail(companyId: number, userId: number, messageId: number, data: {
  title: string; start: Date; end?: Date; allDay?: boolean;
}) {
  const msg = await prisma.emailMessage.findFirst({ where: { id: messageId, companyId } });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");

  // Remove old AI suggestion if present
  if (msg.suggestedEventId) {
    await prisma.calendarEvent.deleteMany({ where: { id: msg.suggestedEventId, companyId } });
  }

  const event = await prisma.calendarEvent.create({
    data: { ...data, type: "AUTO_EMAIL", color: "#3b82f6", companyId, createdByUserId: userId, sourceId: messageId },
  });
  await prisma.emailMessage.update({ where: { id: messageId }, data: { suggestedEventId: event.id } });
  return event;
}

export async function assignEmail(
  companyId: number,
  id: number,
  data: { tenantId?: number; propertyId?: number }
) {
  const msg = await prisma.emailMessage.findFirst({ where: { id, companyId } });
  if (!msg) throw new AppError(404, "Nachricht nicht gefunden");

  // Validate that provided tenantId/propertyId belong to the same company
  if (data.tenantId != null) {
    const tenant = await prisma.tenant.findFirst({ where: { id: data.tenantId, companyId } });
    if (!tenant) throw new AppError(400, "Mieter nicht gefunden");
  }
  if (data.propertyId != null) {
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, companyId } });
    if (!property) throw new AppError(400, "Objekt nicht gefunden");
  }

  // Idempotency: skip file/document creation if already assigned
  if (msg.tenantId !== null || msg.propertyId !== null) {
    return prisma.emailMessage.update({
      where: { id },
      data: {
        tenantId: data.tenantId ?? null,
        propertyId: data.propertyId ?? null,
        suggestedTenantId: null,
        suggestedPropertyId: null,
      },
    });
  }

  const content = msg.bodyText ?? "";
  const dir = path.join(env.UPLOAD_DIR, "email-documents", String(companyId));
  await fsPromises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `email-${id}-${Date.now()}.txt`);
  await fsPromises.writeFile(filePath, content, "utf8");

  const bytes = Buffer.byteLength(content, "utf8");
  const fileSize = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  try {
    await createDocument(companyId, {
      name: `E-Mail: ${msg.subject}`,
      fileType: "email",
      fileSize,
      filePath,
      tenantId: data.tenantId ?? undefined,
      propertyId: data.propertyId ?? undefined,
    });
  } catch (err) {
    await fsPromises.unlink(filePath).catch(() => undefined);
    throw err;
  }

  // Note: createDocument + prisma.update are not atomic. If update fails after
  // createDocument succeeds, the document remains. Accepted trade-off since
  // file operations cannot be rolled back.
  return prisma.emailMessage.update({
    where: { id },
    data: {
      tenantId: data.tenantId ?? null,
      propertyId: data.propertyId ?? null,
      suggestedTenantId: null,
      suggestedPropertyId: null,
    },
  });
}
