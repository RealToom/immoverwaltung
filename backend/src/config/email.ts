import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";

let transporter: Transporter | null = null;

export const isEmailEnabled = !!env.SMTP_HOST;

if (isEmailEnabled) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  logger.info({ smtp: `${env.SMTP_HOST}:${env.SMTP_PORT}` }, "E-Mail-Versand aktiviert");
} else {
  logger.info("E-Mail-Versand deaktiviert (SMTP_HOST nicht konfiguriert)");
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) return false;

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "E-Mail-Versand fehlgeschlagen");
    return false;
  }
}
