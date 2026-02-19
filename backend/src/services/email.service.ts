import { prisma } from "../lib/prisma.js";
import { isEmailEnabled, sendMail } from "../config/email.js";

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

  const subject = `Vertragsstatus geaendert: ${data.tenantName}`;
  const html = htmlWrapper("Vertragsstatus-Aenderung", `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Mieter:</td><td style="padding: 8px; font-weight: bold;">${data.tenantName}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Immobilie:</td><td style="padding: 8px;">${data.propertyName}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Neuer Status:</td><td style="padding: 8px; font-weight: bold;">${statusLabels[data.status] ?? data.status}</td></tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMail(to, subject, html)));
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

  const subject = `Neuer Wartungsauftrag: ${data.title}`;
  const html = htmlWrapper("Neuer Wartungsauftrag", `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Titel:</td><td style="padding: 8px; font-weight: bold;">${data.title}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Prioritaet:</td><td style="padding: 8px; font-weight: bold; color: ${data.priority === "DRINGEND" ? "#ef4444" : data.priority === "HOCH" ? "#f97316" : "#1a1a1a"};">${priorityLabels[data.priority] ?? data.priority}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Immobilie:</td><td style="padding: 8px;">${data.propertyName}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Gemeldet von:</td><td style="padding: 8px;">${data.reportedBy}</td></tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMail(to, subject, html)));
}

export async function notifyRentPayment(
  companyId: number,
  data: { tenantName: string; amount: number; month: string }
): Promise<void> {
  if (!isEmailEnabled) return;

  const recipients = await getUsersWithPref(companyId, "emailFinanzen");
  if (recipients.length === 0) return;

  const subject = `Mietzahlung eingegangen: ${data.tenantName}`;
  const html = htmlWrapper("Mietzahlung eingegangen", `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Mieter:</td><td style="padding: 8px; font-weight: bold;">${data.tenantName}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Betrag:</td><td style="padding: 8px; font-weight: bold;">${data.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Monat:</td><td style="padding: 8px;">${data.month}</td></tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMail(to, subject, html)));
}
