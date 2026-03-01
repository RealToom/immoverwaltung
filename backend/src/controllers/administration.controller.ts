import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { encryptString, decryptString } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import nodemailer from "nodemailer";

// ─── SMTP ────────────────────────────────────────────────────

export async function getSmtpHandler(req: Request, res: Response) {
  const smtp = await prisma.companySmtpSettings.findUnique({
    where: { companyId: req.companyId! },
  });

  if (!smtp) {
    res.json({ data: null });
    return;
  }

  // Never return the encrypted password
  const { encryptedPass: _, ...safe } = smtp;
  res.json({ data: safe });
}

export async function putSmtpHandler(req: Request, res: Response) {
  const { host, port, secure, user, password, fromAddress, fromName } = req.body as {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
    fromAddress: string;
    fromName: string;
  };

  const existing = await prisma.companySmtpSettings.findUnique({
    where: { companyId: req.companyId! },
  });

  let encryptedPass: string;
  if (password) {
    encryptedPass = encryptString(password);
  } else if (existing) {
    encryptedPass = existing.encryptedPass; // keep existing password
  } else {
    throw new AppError(400, "Passwort ist erforderlich");
  }

  const smtp = await prisma.companySmtpSettings.upsert({
    where: { companyId: req.companyId! },
    create: { companyId: req.companyId!, host, port, secure, user, encryptedPass, fromAddress, fromName },
    update: { host, port, secure, user, encryptedPass, fromAddress, fromName },
  });

  const { encryptedPass: __, ...safe } = smtp;
  res.json({ data: safe });
}

export async function testSmtpHandler(req: Request, res: Response) {
  const smtp = await prisma.companySmtpSettings.findUnique({
    where: { companyId: req.companyId! },
  });

  if (!smtp) {
    throw new AppError(400, "Kein SMTP konfiguriert");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: decryptString(smtp.encryptedPass) },
  });

  // Send test mail to the current admin user
  const adminUser = await prisma.user.findUnique({ where: { id: req.user!.id } });

  try {
    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromAddress}>`,
      to: adminUser!.email,
      subject: "SMTP Test — ImmoVerwalt",
      html: "<p>Der SMTP-Versand funktioniert korrekt.</p>",
    });
    res.json({ data: { success: true, message: `Test-Mail an ${adminUser!.email} gesendet` } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    throw new AppError(502, `SMTP-Test fehlgeschlagen: ${message}`);
  }
}

// ─── Custom Roles ────────────────────────────────────────────

export async function getRolesHandler(req: Request, res: Response) {
  const roles = await prisma.customRole.findMany({
    where: { companyId: req.companyId! },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  res.json({ data: roles });
}

export async function createRoleHandler(req: Request, res: Response) {
  const { name, pages } = req.body as { name: string; pages: string[] };

  if (!name?.trim()) throw new AppError(400, "Name ist erforderlich");

  const role = await prisma.customRole.create({
    data: { companyId: req.companyId!, name: name.trim(), pages: pages ?? [] },
    include: { _count: { select: { users: true } } },
  });

  res.status(201).json({ data: role });
}

export async function updateRoleHandler(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { name, pages } = req.body as { name?: string; pages?: string[] };

  // Verify role belongs to this company
  const existing = await prisma.customRole.findFirst({
    where: { id, companyId: req.companyId! },
  });
  if (!existing) throw new AppError(404, "Rolle nicht gefunden");

  const role = await prisma.customRole.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(pages !== undefined && { pages }),
    },
    include: { _count: { select: { users: true } } },
  });

  res.json({ data: role });
}

export async function deleteRoleHandler(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.customRole.findFirst({
    where: { id, companyId: req.companyId! },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw new AppError(404, "Rolle nicht gefunden");

  if (existing._count.users > 0) {
    throw new AppError(409, "Rolle kann nicht gelöscht werden (Benutzer zugewiesen)");
  }

  await prisma.customRole.delete({ where: { id } });
  res.status(204).send();
}

export async function setUserCustomRoleHandler(req: Request, res: Response) {
  const userId = Number(req.params.id);
  const { customRoleId } = req.body as { customRoleId: number | null };

  // Verify user belongs to this company
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId: req.companyId! },
  });
  if (!user) throw new AppError(404, "Benutzer nicht gefunden");

  // If assigning a role, verify it belongs to this company
  if (customRoleId !== null && customRoleId !== undefined) {
    const role = await prisma.customRole.findFirst({
      where: { id: customRoleId, companyId: req.companyId! },
    });
    if (!role) throw new AppError(404, "Rolle nicht gefunden");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { customRoleId: customRoleId ?? null },
    include: { customRole: true },
  });

  const { passwordHash, failedLoginAttempts, lockedUntil, ...safe } = updated;
  res.json({ data: safe });
}
