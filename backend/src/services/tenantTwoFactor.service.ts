import { createHash, randomInt, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import {
  signTenantAccessToken,
  signTenantRefreshToken,
} from "../lib/tenantJwt.js";
import { sendMailForCompany } from "../config/email.js";
import { logger } from "../lib/logger.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors.js";

export const DEVICE_COOKIE_NAME = "tenant_device_token";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 Tage

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** 6-stelligen Code generieren, SHA-256-Hash auf TenantUser speichern, per E-Mail senden. */
export async function sendTwoFactorCode(
  tenantUserId: number,
  companyId: number
): Promise<void> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: tenantUserId },
    include: {
      tenant: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  if (!tenantUser || tenantUser.companyId !== companyId) {
    throw new NotFoundError("TenantUser", tenantUserId);
  }

  const code = randomInt(100000, 999999).toString();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.tenantUser.update({
    where: { id: tenantUserId },
    data: { twoFactorCode: codeHash, twoFactorCodeExpiresAt: expiresAt },
  });

  const sent = await sendMailForCompany(
    companyId,
    tenantUser.email,
    `Ihr Anmeldecode — ${tenantUser.company.name}`,
    `
      <p>Guten Tag ${tenantUser.tenant.name},</p>
      <p>Ihr Anmeldecode lautet:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p>
      <p>Der Code ist 10 Minuten gültig.</p>
      <p>Falls Sie diesen Code nicht angefordert haben, ignorieren Sie diese E-Mail.</p>
      <p>Mit freundlichen Grüßen<br>${tenantUser.company.name}</p>
    `
  );

  if (!sent) {
    logger.warn(
      { tenantUserId, companyId },
      "2FA-Code konnte nicht per E-Mail gesendet werden"
    );
  }
}

/** Code gegen gespeicherten Hash prüfen. Löscht Code nach Erfolg (Einmalcode). */
export async function verifyTwoFactorCode(
  tenantUserId: number,
  code: string
): Promise<void> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: tenantUserId },
  });

  if (!tenantUser) {
    throw new NotFoundError("TenantUser", tenantUserId);
  }

  if (
    !tenantUser.twoFactorCode ||
    !tenantUser.twoFactorCodeExpiresAt ||
    tenantUser.twoFactorCodeExpiresAt < new Date() ||
    tenantUser.twoFactorCode !== sha256(code)
  ) {
    throw new BadRequestError("Code ungültig oder abgelaufen");
  }

  await prisma.tenantUser.update({
    where: { id: tenantUserId },
    data: { twoFactorCode: null, twoFactorCodeExpiresAt: null },
  });
}

/** Prüft ob ein Device-Token-Cookie einem gültigen TrustedDevice entspricht. Löscht abgelaufene Einträge. */
export async function isTrustedDevice(
  tenantUserId: number,
  companyId: number,
  deviceToken: string
): Promise<boolean> {
  const tokenHash = sha256(deviceToken);
  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash },
  });

  if (!device) return false;

  if (
    device.tenantUserId !== tenantUserId ||
    device.companyId !== companyId ||
    device.expiresAt < new Date()
  ) {
    await prisma.trustedDevice.delete({ where: { tokenHash } });
    return false;
  }

  return true;
}

/** Neues TrustedDevice anlegen. Gibt das Raw-Token zurück (wird im Cookie gespeichert). */
export async function createTrustedDevice(
  tenantUserId: number,
  companyId: number
): Promise<string> {
  const deviceToken = randomUUID();
  const tokenHash = sha256(deviceToken);
  const expiresAt = new Date(
    Date.now() + DEVICE_COOKIE_MAX_AGE_SECONDS * 1000
  );

  await prisma.trustedDevice.create({
    data: { tenantUserId, companyId, tokenHash, expiresAt },
  });

  return deviceToken;
}

/** 2FA aktivieren (nach Code-Bestätigung). */
export async function enableTwoFactor(tenantUserId: number): Promise<void> {
  await prisma.tenantUser.update({
    where: { id: tenantUserId },
    data: {
      twoFactorEnabled: true,
      twoFactorCode: null,
      twoFactorCodeExpiresAt: null,
    },
  });
}

/** 2FA deaktivieren + alle TrustedDevices löschen. Erfordert Passwort-Bestätigung. */
export async function disableTwoFactor(
  tenantUserId: number,
  password: string
): Promise<void> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: tenantUserId },
  });

  if (!tenantUser) {
    throw new NotFoundError("TenantUser", tenantUserId);
  }

  const valid = await bcrypt.compare(password, tenantUser.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Passwort falsch");
  }

  await prisma.$transaction([
    prisma.trustedDevice.deleteMany({ where: { tenantUserId } }),
    prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: {
        twoFactorEnabled: false,
        twoFactorCode: null,
        twoFactorCodeExpiresAt: null,
      },
    }),
  ]);
}

/** Admin: 2FA zurücksetzen + alle TrustedDevices löschen. Prüft companyId-Isolation. */
export async function adminResetTwoFactor(
  tenantUserId: number,
  companyId: number
): Promise<void> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: tenantUserId },
  });

  if (!tenantUser || tenantUser.companyId !== companyId) {
    throw new NotFoundError("TenantUser", tenantUserId);
  }

  await prisma.$transaction([
    prisma.trustedDevice.deleteMany({ where: { tenantUserId } }),
    prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: {
        twoFactorEnabled: false,
        twoFactorCode: null,
        twoFactorCodeExpiresAt: null,
      },
    }),
  ]);
}

/** 2FA-Status eines TenantUsers abfragen. */
export async function getTwoFactorStatus(
  tenantUserId: number
): Promise<{ enabled: boolean }> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: tenantUserId },
    select: { twoFactorEnabled: true },
  });

  if (!tenantUser) {
    throw new NotFoundError("TenantUser", tenantUserId);
  }

  return { enabled: tenantUser.twoFactorEnabled };
}

/**
 * Nach mfaToken-Verifizierung: volle Access+Refresh-Tokens ausstellen.
 * Optional TrustedDevice anlegen und Raw-Token zurückgeben.
 */
export async function completeTwoFactorLogin(
  tenantUserId: number,
  companyId: number,
  rememberDevice: boolean
): Promise<{
  accessToken: string;
  refreshToken: string;
  deviceToken?: string;
}> {
  const tenantUser = await prisma.tenantUser.findUniqueOrThrow({
    where: { id: tenantUserId },
  });

  if (tenantUser.companyId !== companyId) {
    throw new UnauthorizedError("Ungültige Anfrage");
  }

  const tokenPayload = {
    tenantUserId: tenantUser.id,
    tenantId: tenantUser.tenantId,
    companyId: tenantUser.companyId,
  };

  const accessToken = signTenantAccessToken(tokenPayload);
  const refreshToken = signTenantRefreshToken(tokenPayload);

  await prisma.tenantUser.update({
    where: { id: tenantUser.id },
    data: { refreshToken, lastLoginAt: new Date() },
  });

  if (rememberDevice) {
    const deviceToken = await createTrustedDevice(
      tenantUser.id,
      tenantUser.companyId
    );
    return { accessToken, refreshToken, deviceToken };
  }

  return { accessToken, refreshToken };
}
