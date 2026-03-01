import { prisma } from "../lib/prisma.js";
import { isEmailEnabled, sendMail, sendMailForCompany } from "../config/email.js";

interface NotificationPrefs {
  emailVertrag?: boolean;
  emailWartung?: boolean;
  emailFinanzen?: boolean;
}

async function getUsersWithPref(companyId: number, prefKey: keyof NotificationPrefs): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { companyId },
    select: { email: true, notificationPrefs: true },
  });

  return users
    .filter((u) => {
      const prefs = (u.notificationPrefs ?? {}) as NotificationPrefs;
      return prefs[prefKey] === true;
    })
    .map((u) => u.email);
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function htmlWrapper(title: string, content: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">${title}</h2>
      ${content}
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #9ca3af;">
        Diese E-Mail wurde automatisch von der Immobilienverwaltung gesendet.
      </p>
    </div>
  `;
}

export async function notifyContractStatusChange(
  companyId: number,
  data: { tenantName: string; propertyName: string; status: string }
): Promise<void> {
  if (!isEmailEnabled) return;

  const recipients = await getUsersWithPref(companyId, "emailVertrag");
  if (recipients.length === 0) return;

  const statusLabels: Record<string, string> = {
    AKTIV: "Aktiv",
    AUSLAUFEND: "Auslaufend",
    GEKUENDIGT: "Gekuendigt",
    ENTWURF: "Entwurf",
  };

  const subject = `Vertragsstatus geaendert: ${escHtml(data.tenantName)}`;
  const html = htmlWrapper("Vertragsstatus-Aenderung", `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Mieter:</td><td style="padding: 8px; font-weight: bold;">${escHtml(data.tenantName)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Immobilie:</td><td style="padding: 8px;">${escHtml(data.propertyName)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Neuer Status:</td><td style="padding: 8px; font-weight: bold;">${escHtml(statusLabels[data.status] ?? data.status)}</td></tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMailForCompany(companyId, to, subject, html)));
}

export async function notifyMaintenanceCreated(
  companyId: number,
  data: { title: string; priority: string; propertyName: string; reportedBy: string }
): Promise<void> {
  if (!isEmailEnabled) return;

  const recipients = await getUsersWithPref(companyId, "emailWartung");
  if (recipients.length === 0) return;

  const priorityLabels: Record<string, string> = {
    NIEDRIG: "Niedrig",
    MITTEL: "Mittel",
    HOCH: "Hoch",
    DRINGEND: "Dringend",
  };

  const subject = `Neuer Wartungsauftrag: ${escHtml(data.title)}`;
  const html = htmlWrapper("Neuer Wartungsauftrag", `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Titel:</td><td style="padding: 8px; font-weight: bold;">${escHtml(data.title)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Prioritaet:</td><td style="padding: 8px; font-weight: bold; color: ${data.priority === "DRINGEND" ? "#ef4444" : data.priority === "HOCH" ? "#f97316" : "#1a1a1a"};">${escHtml(priorityLabels[data.priority] ?? data.priority)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Immobilie:</td><td style="padding: 8px;">${escHtml(data.propertyName)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Gemeldet von:</td><td style="padding: 8px;">${escHtml(data.reportedBy)}</td></tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMailForCompany(companyId, to, subject, html)));
}

export async function sendTempPasswordEmail(
  to: string,
  data: { name: string; temporaryPassword: string; appUrl: string }
): Promise<void> {
  if (!isEmailEnabled) return;

  const subject = "Ihr temporaeres Passwort - Immoverwaltung";
  const html = htmlWrapper("Temporaeres Passwort", `
    <p>Hallo ${escHtml(data.name)},</p>
    <p>Ihr Passwort wurde zurueckgesetzt. Bitte melden Sie sich mit dem folgenden temporaeren Passwort an und aendern Sie es anschliessend sofort:</p>
    <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
      <code style="font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #1a1a1a;">${data.temporaryPassword}</code>
    </div>
    <p><a href="${data.appUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Jetzt anmelden</a></p>
    <p style="color: #ef4444; font-size: 13px;">Wichtig: Aendern Sie Ihr Passwort sofort nach dem ersten Login!</p>
  `);

  await sendMail(to, subject, html);
}

export async function notifyRentPayment(
  companyId: number,
  data: { tenantName: string; amount: number; month: string }
): Promise<void> {
  if (!isEmailEnabled) return;

  const recipients = await getUsersWithPref(companyId, "emailFinanzen");
  if (recipients.length === 0) return;

  const subject = `Mietzahlung eingegangen: ${escHtml(data.tenantName)}`;
  const html = htmlWrapper("Mietzahlung eingegangen", `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Mieter:</td><td style="padding: 8px; font-weight: bold;">${escHtml(data.tenantName)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Betrag:</td><td style="padding: 8px; font-weight: bold;">${data.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Monat:</td><td style="padding: 8px;">${data.month}</td></tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMailForCompany(companyId, to, subject, html)));
}

export async function sendDigestEmails(companyId: number, frequency: string): Promise<void> {
  if (!isEmailEnabled) return;

  const users = await prisma.user.findMany({
    where: { companyId },
    select: { email: true, notificationPrefs: true },
  });

  const recipients = users
    .filter((u) => {
      const prefs = (u.notificationPrefs ?? {}) as Record<string, unknown>;
      return prefs.digestFrequency === frequency;
    })
    .map((u) => u.email);

  if (recipients.length === 0) return;

  // Gather digest data
  const now = new Date();
  const [openTickets, overdueRent, upcomingEvents] = await Promise.all([
    prisma.maintenanceTicket.count({
      where: { companyId, status: { in: ["OFFEN", "IN_BEARBEITUNG", "WARTEND"] } },
    }),
    prisma.rentPayment.count({
      where: { companyId, status: "AUSSTEHEND", dueDate: { lt: now } },
    }),
    prisma.calendarEvent.count({
      where: { companyId, start: { gte: now, lte: new Date(now.getTime() + 7 * 86400_000) } },
    }),
  ]);

  const frequencyLabels: Record<string, string> = {
    TAEGLICH: "Tagesübersicht",
    WOECHENTLICH: "Wochenübersicht",
    MONATLICH: "Monatsübersicht",
  };
  const period = escHtml(frequencyLabels[frequency] ?? frequency);

  const subject = `Immoverwaltung – ${period}`;
  const html = htmlWrapper(period, `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 8px; color: #6b7280;">Offene Wartungstickets:</td>
        <td style="padding: 8px; font-weight: bold; color: ${openTickets > 0 ? "#ef4444" : "#1a1a1a"};">${openTickets}</td>
      </tr>
      <tr>
        <td style="padding: 8px; color: #6b7280;">Überfällige Mietzahlungen:</td>
        <td style="padding: 8px; font-weight: bold; color: ${overdueRent > 0 ? "#ef4444" : "#1a1a1a"};">${overdueRent}</td>
      </tr>
      <tr>
        <td style="padding: 8px; color: #6b7280;">Termine (nächste 7 Tage):</td>
        <td style="padding: 8px; font-weight: bold;">${upcomingEvents}</td>
      </tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMailForCompany(companyId, to, subject, html)));
}
