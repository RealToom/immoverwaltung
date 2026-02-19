import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import type { UserRole } from "@prisma/client";

function sanitize(user: Record<string, unknown>) {
  const { passwordHash, failedLoginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure complexity: uppercase + lowercase + digit always present
  return pw.replace(/.$/, "X").replace(/..$/, "9").replace(/...$/, "a");
}

export async function listUsers(companyId: number) {
  const users = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      lockedUntil: true,
      failedLoginAttempts: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return users.map((u) => ({
    ...u,
    isLocked: u.lockedUntil != null && u.lockedUntil > new Date(),
  }));
}

export async function createUser(
  companyId: number,
  data: { name: string; email: string; password: string; role: UserRole; phone?: string }
) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError(409, "E-Mail wird bereits verwendet");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      phone: data.phone ?? "",
      companyId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

export async function updateUser(
  companyId: number,
  id: number,
  data: { name?: string; role?: UserRole; phone?: string }
) {
  const existing = await prisma.user.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Benutzer", id);

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

export async function deleteUser(companyId: number, id: number, requestingUserId: number) {
  const existing = await prisma.user.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Benutzer", id);

  if (id === requestingUserId) {
    throw new AppError(400, "Sie können sich nicht selbst löschen");
  }

  // Prevent deleting the last admin
  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { companyId, role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new AppError(400, "Der letzte Administrator kann nicht gelöscht werden");
    }
  }

  await prisma.user.delete({ where: { id } });
}

export async function resetUserPassword(companyId: number, id: number) {
  const existing = await prisma.user.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Benutzer", id);

  const newPassword = generatePassword();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  return { temporaryPassword: newPassword };
}

export async function unlockUser(companyId: number, id: number) {
  const existing = await prisma.user.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError("Benutzer", id);

  await prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
