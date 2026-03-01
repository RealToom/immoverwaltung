import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";
import { decryptString } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";

let serverTransporter: Transporter | null = null;

export const isEmailEnabled = !!env.SMTP_HOST;

if (isEmailEnabled) {
  serverTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  logger.info({ smtp: `${env.SMTP_HOST}:${env.SMTP_PORT}` }, "E-Mail-Versand aktiviert");
} else {
  logger.info("E-Mail-Versand deaktiviert (SMTP_HOST nicht konfiguriert)");
}

/** Get transporter for a specific company (falls back to server .env). */
async function getCompanyTransporter(companyId: number): Promise<{ transporter: Transporter; from: string } | null> {
  const settings = await prisma.companySmtpSettings.findUnique({ where: { companyId } });

  if (settings) {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: decryptString(settings.encryptedPass) },
    });
    return { transporter, from: `"${settings.fromName}" <${settings.fromAddress}>` };
  }

  if (serverTransporter) {
    return { transporter: serverTransporter, from: env.SMTP_FROM };
  }

  return null;
}

/** Send mail for a specific company (uses company SMTP or server fallback). */
export async function sendMailForCompany(
  companyId: number,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const config = await getCompanyTransporter(companyId);
    if (!config) return false;
    await config.transporter.sendMail({ from: config.from, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "E-Mail-Versand fehlgeschlagen");
    return false;
  }
}

/** Legacy: send mail using server transporter (no company context). */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!serverTransporter) return false;

  try {
    await serverTransporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "E-Mail-Versand fehlgeschlagen");
    return false;
  }
}
