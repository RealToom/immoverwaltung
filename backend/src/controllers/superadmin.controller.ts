// backend/src/controllers/superadmin.controller.ts
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import os from "os";
import { execSync } from "child_process";
import fs from "fs";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { password } = req.body as { password?: string };
  if (!password || password !== env.SUPERADMIN_SECRET) {
    throw new AppError(401, "Falsches Passwort");
  }
  const token = jwt.sign({ superadmin: true }, env.SUPERADMIN_JWT_SECRET, { expiresIn: "8h" });
  res.json({ data: { token } });
}

export async function getStats(req: Request, res: Response): Promise<void> {
  const [companies, users, properties, tenants, contracts] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.property.count(),
    prisma.tenant.count(),
    prisma.contract.count(),
  ]);

  // Server stats
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let diskTotal = 0;
  let diskUsed = 0;
  let diskFree = 0;
  try {
    const dfOutput = execSync("df -k / 2>/dev/null | tail -1", { encoding: "utf8" }).trim();
    const parts = dfOutput.split(/\s+/);
    diskTotal = parseInt(parts[1]) * 1024;
    diskUsed = parseInt(parts[2]) * 1024;
    diskFree = parseInt(parts[3]) * 1024;
  } catch {
    // ignore if not available
  }

  // Last backup
  let lastBackup: string | null = null;
  try {
    const backupDir = "/root/immoverwaltung/backups";
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith(".sql.gz"))
        .sort()
        .reverse();
      if (files.length > 0) {
        const stat = fs.statSync(`${backupDir}/${files[0]}`);
        lastBackup = stat.mtime.toISOString();
      }
    }
  } catch {
    // ignore
  }

  res.json({
    data: {
      db: { companies, users, properties, tenants, contracts },
      server: {
        memory: { total: totalMem, used: usedMem, free: freeMem },
        disk: { total: diskTotal, used: diskUsed, free: diskFree },
        lastBackup,
        uptime: os.uptime(),
      },
    },
  });
}

export async function getCompanies(req: Request, res: Response): Promise<void> {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          properties: true,
          tenants: true,
          contracts: true,
        },
      },
    },
  });
  res.json({ data: companies });
}

export async function createCompany(req: Request, res: Response): Promise<void> {
  const { companyName, adminEmail, adminPassword, adminName } = req.body as {
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    adminName?: string;
  };
  if (!companyName || !adminEmail || !adminPassword) {
    throw new AppError(400, "companyName, adminEmail und adminPassword sind Pflichtfelder");
  }
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cost = env.BCRYPT_COST;
  const passwordHash = await bcrypt.hash(adminPassword, cost);

  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({
      data: { name: companyName, slug, address: "", taxNumber: "" },
    });
    await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName ?? "Admin",
        role: "ADMIN",
        companyId: c.id,
      },
    });
    return c;
  });

  res.status(201).json({ data: { companyId: company.id, companyName, adminEmail } });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const companyId = Number(req.params.id);
  const { email, newPassword } = req.body as { email: string; newPassword: string };
  if (!email || !newPassword) throw new AppError(400, "email und newPassword erforderlich");
  const cost = env.BCRYPT_COST;
  const passwordHash = await bcrypt.hash(newPassword, cost);
  const updated = await prisma.user.updateMany({
    where: { email, companyId },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });
  if (updated.count === 0) throw new AppError(404, "User nicht gefunden");
  res.json({ data: { updated: updated.count } });
}

export async function deleteCompany(req: Request, res: Response): Promise<void> {
  const companyId = Number(req.params.id);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM audit_logs WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM dunning_records WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM rent_payments WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM contracts WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM documents WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM document_templates WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM meter_readings WHERE meter_id IN (SELECT id FROM meters WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId}))`;
    await tx.$executeRaw`DELETE FROM meters WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM maintenance_tickets WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM maintenance_schedules WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM handover_protocols WHERE unit_id IN (SELECT id FROM units WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId}))`;
    await tx.$executeRaw`DELETE FROM units WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM properties WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM tenants WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM bank_transactions WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM transactions WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM recurring_transactions WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM bank_accounts WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM calendar_events WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM email_attachments WHERE message_id IN (SELECT id FROM email_messages WHERE account_id IN (SELECT id FROM email_accounts WHERE company_id = ${companyId}))`;
    await tx.$executeRaw`DELETE FROM email_messages WHERE account_id IN (SELECT id FROM email_accounts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM email_accounts WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM company_accounting_settings WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM users WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM companies WHERE id = ${companyId}`;
  });

  res.json({ data: { deleted: company.name } });
}
