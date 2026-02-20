import bcrypt from "bcrypt";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { AppError, UnauthorizedError } from "../lib/errors.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function issueTokens(user: { id: number; companyId: number; role: string }) {
  const payload = { userId: user.id, companyId: user.companyId, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

function sanitizeUser<T extends Record<string, unknown>>(user: T) {
  const { passwordHash, failedLoginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

export async function register(
  name: string,
  email: string,
  password: string,
  companyName: string
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "E-Mail wird bereits verwendet");
  }

  const slug = slugify(companyName);

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      company: {
        create: {
          name: companyName,
          slug,
        },
      },
    },
    include: { company: true },
  });

  const tokens = issueTokens(user);

  // Store refresh token in DB
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const safeUser = sanitizeUser(user);

  return { user: safeUser, ...tokens };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });

  if (!user) {
    throw new UnauthorizedError("Ungueltige Anmeldedaten");
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    throw new AppError(
      423,
      `Account gesperrt. Versuchen Sie es in ${minutes} Minuten erneut.`
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lockout = attempts >= 10 ? new Date(Date.now() + 30 * 60 * 1000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil: lockout },
    });
    throw new UnauthorizedError("Ungueltige Anmeldedaten");
  }

  // Reset failed attempts on successful login
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  const tokens = issueTokens(user);

  // Store refresh token in DB
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const safeUser = sanitizeUser(user);

  return { user: safeUser, ...tokens };
}

export async function refreshToken(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Ungueltiger Refresh-Token");
  }

  // Verify token exists in DB
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    // If token was used but not in DB, possible token reuse -> revoke all
    if (!storedToken) {
      await prisma.refreshToken.deleteMany({
        where: { userId: payload.userId },
      });
    }
    throw new UnauthorizedError("Ungueltiger Refresh-Token");
  }

  // Delete old token (rotation)
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new UnauthorizedError("Benutzer nicht gefunden");
  }

  const tokenPayload = {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
  };

  const accessToken = signAccessToken(tokenPayload);
  const newRefreshToken = signRefreshToken(tokenPayload);

  // Store new refresh token
  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeRefreshTokens(userId: number) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });

  if (!user) {
    throw new AppError(404, "Benutzer nicht gefunden");
  }

  const safeUser = sanitizeUser(user);

  return safeUser;
}

export async function updateProfile(
  userId: number,
  data: { name?: string; phone?: string; bio?: string }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: { company: true },
  });

  const safeUser = sanitizeUser(user);

  return safeUser;
}

const DEFAULT_NOTIFICATION_PREFS = {
  emailVertrag: true,
  emailWartung: true,
  emailFinanzen: false,
  pushVertrag: true,
  pushWartung: true,
  pushFinanzen: false,
  reminderDays: 30,
  digestFrequency: "WOECHENTLICH" as const,
};

export async function getNotificationPrefs(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });

  if (!user) {
    throw new AppError(404, "Benutzer nicht gefunden");
  }

  const stored = (user.notificationPrefs as Record<string, unknown>) ?? {};
  return { ...DEFAULT_NOTIFICATION_PREFS, ...stored };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, "Benutzer nicht gefunden");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Aktuelles Passwort ist falsch");
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_COST);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Alle Refresh-Tokens widerrufen → erzwingt Re-Login auf allen Geräten
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function updateNotificationPrefs(
  userId: number,
  data: Record<string, unknown>
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });

  if (!user) {
    throw new AppError(404, "Benutzer nicht gefunden");
  }

  const current = (user.notificationPrefs as Record<string, unknown>) ?? {};
  const merged = { ...current, ...data };

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: merged as Prisma.InputJsonValue },
  });

  return { ...DEFAULT_NOTIFICATION_PREFS, ...merged };
}
