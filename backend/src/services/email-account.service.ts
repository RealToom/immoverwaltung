import imaps from "imap-simple";
import { prisma } from "../lib/prisma.js";
import { encryptString, decryptString } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listAccounts(companyId: number) {
  return prisma.emailAccount.findMany({
    where: { companyId },
    select: { id: true, label: true, email: true, imapHost: true, imapPort: true,
              smtpHost: true, smtpPort: true, isActive: true, lastSync: true, createdAt: true,
              allowedRoles: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function testImapConnection(config: {
  host: string; port: number; tls: boolean; user: string; password: string;
}): Promise<void> {
  const connection = await imaps.connect({
    imap: { host: config.host, port: config.port, tls: config.tls,
            user: config.user, password: config.password, authTimeout: 5000 },
  });
  await connection.end();
}

export async function createAccount(companyId: number, data: {
  label: string; email: string; imapHost: string; imapPort: number; imapTls: boolean;
  imapUser: string; password: string; smtpHost: string; smtpPort: number; smtpTls: boolean;
  skipConnectionTest?: boolean; allowedRoles?: string[];
}) {
  let imapConnected = true;
  // Test IMAP connection before saving (unless skipped)
  if (!data.skipConnectionTest) {
    try {
      await testImapConnection({ host: data.imapHost, port: data.imapPort,
                                 tls: data.imapTls, user: data.imapUser, password: data.password });
    } catch (err) {
      logger.warn({ err }, "IMAP-Verbindungstest fehlgeschlagen");
      throw new AppError(400, "IMAP-Verbindung fehlgeschlagen. Bitte Zugangsdaten prüfen oder 'Verbindungstest überspringen' aktivieren.");
    }
  } else {
    // If test is skipped, mark as inactive until manually synced
    imapConnected = false;
    logger.info({ email: data.email }, "IMAP-Verbindungstest übersprungen, Postfach wird als inaktiv gespeichert");
  }

  const { password, skipConnectionTest: _, allowedRoles, ...rest } = data;
  return prisma.emailAccount.create({
    data: {
      ...rest,
      encryptedPassword: encryptString(password),
      companyId,
      isActive: imapConnected,
      allowedRoles: allowedRoles ?? ["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"],
    },
  });
}

export async function updateAccount(companyId: number, id: number, data: {
  label?: string; isActive?: boolean; password?: string; allowedRoles?: string[];
}) {
  const account = await prisma.emailAccount.findFirst({ where: { id, companyId } });
  if (!account) throw new AppError(404, "Postfach nicht gefunden");

  const { password, allowedRoles, ...rest } = data;
  return prisma.emailAccount.update({
    where: { id },
    data: {
      ...rest,
      ...(password ? { encryptedPassword: encryptString(password) } : {}),
      ...(allowedRoles ? { allowedRoles } : {}),
    },
  });
}

export async function deleteAccount(companyId: number, id: number) {
  const account = await prisma.emailAccount.findFirst({ where: { id, companyId } });
  if (!account) throw new AppError(404, "Postfach nicht gefunden");
  await prisma.emailAccount.delete({ where: { id } });
}

export async function getDecryptedPassword(accountId: number, companyId: number): Promise<string> {
  const account = await prisma.emailAccount.findFirst({ where: { id: accountId, companyId } });
  if (!account) throw new AppError(404, "Postfach nicht gefunden");
  return decryptString(account.encryptedPassword);
}
