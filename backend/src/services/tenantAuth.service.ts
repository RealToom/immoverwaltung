import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  signTenantAccessToken,
  signTenantRefreshToken,
  verifyTenantRefreshToken,
} from "../lib/tenantJwt.js";
import { env } from "../config/env.js";
import { UnauthorizedError, NotFoundError, BadRequestError } from "../lib/errors.js";
import { sendMailForCompany } from "../config/email.js";
import { logger } from "../lib/logger.js";

const COOKIE_NAME = "tenant_refresh_token";

export { COOKIE_NAME };

/** Login with email + password. Returns access + refresh token. */
export async function loginTenant(
  email: string,
  password: string,
  companyId: number
): Promise<{ accessToken: string; refreshToken: string }> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { email_companyId: { email, companyId } },
  });

  if (!tenantUser) {
    throw new UnauthorizedError("E-Mail oder Passwort falsch");
  }

  const valid = await bcrypt.compare(password, tenantUser.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("E-Mail oder Passwort falsch");
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
    data: {
      refreshToken,
      lastLoginAt: new Date(),
    },
  });

  return { accessToken, refreshToken };
}

/** Rotate refresh token. Returns new access + refresh token. */
export async function refreshTenantToken(
  token: string
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload;
  try {
    payload = verifyTenantRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Ungültiger oder abgelaufener Refresh Token");
  }

  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: payload.tenantUserId },
  });

  if (!tenantUser || tenantUser.refreshToken !== token) {
    throw new UnauthorizedError("Refresh Token ungültig");
  }

  const tokenPayload = {
    tenantUserId: tenantUser.id,
    tenantId: tenantUser.tenantId,
    companyId: tenantUser.companyId,
  };

  const accessToken = signTenantAccessToken(tokenPayload);
  const newRefreshToken = signTenantRefreshToken(tokenPayload);

  await prisma.tenantUser.update({
    where: { id: tenantUser.id },
    data: { refreshToken: newRefreshToken },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

/** Invalidate refresh token on logout. */
export async function logoutTenant(tenantUserId: number): Promise<void> {
  await prisma.tenantUser.update({
    where: { id: tenantUserId },
    data: { refreshToken: null },
  });
}

/** Accept invite: set password, activate account. */
export async function acceptInvite(
  token: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { inviteToken: token },
  });

  if (!tenantUser) {
    throw new BadRequestError("Ungültiger Einladungslink");
  }

  if (!tenantUser.inviteExpiresAt || tenantUser.inviteExpiresAt < new Date()) {
    throw new BadRequestError("Einladungslink ist abgelaufen");
  }

  if (tenantUser.passwordHash !== "") {
    throw new BadRequestError("Einladung bereits verwendet");
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);
  const tokenPayload = {
    tenantUserId: tenantUser.id,
    tenantId: tenantUser.tenantId,
    companyId: tenantUser.companyId,
  };

  const accessToken = signTenantAccessToken(tokenPayload);
  const refreshToken = signTenantRefreshToken(tokenPayload);

  await prisma.tenantUser.update({
    where: { id: tenantUser.id },
    data: {
      passwordHash,
      inviteToken: null,
      inviteExpiresAt: null,
      refreshToken,
      lastLoginAt: new Date(),
    },
  });

  return { accessToken, refreshToken };
}

/** Send invite email to tenant. Creates or updates TenantUser. */
export async function sendTenantInvite(
  tenantId: number,
  companyId: number
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { company: true },
  });

  if (!tenant || tenant.companyId !== companyId) {
    throw new NotFoundError("Mieter", tenantId);
  }

  if (!tenant.email) {
    throw new BadRequestError("Mieter hat keine E-Mail-Adresse");
  }

  const inviteToken = randomUUID();
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  // Upsert TenantUser (create if not exists, update invite token if exists)
  await prisma.tenantUser.upsert({
    where: { email_companyId: { email: tenant.email, companyId } },
    create: {
      email: tenant.email,
      passwordHash: "", // empty until invite accepted
      tenantId,
      companyId,
      inviteToken,
      inviteExpiresAt,
    },
    update: {
      inviteToken,
      inviteExpiresAt,
    },
  });

  const portalUrl = `${env.TENANT_PORTAL_URL}/${tenant.company.slug}/invite/${inviteToken}`;
  const companyName = tenant.company.name;

  const sent = await sendMailForCompany(
    companyId,
    tenant.email,
    `Einladung zum Mieter-Portal — ${companyName}`,
    `
      <p>Guten Tag ${tenant.name},</p>
      <p>Sie wurden eingeladen, das Mieter-Portal von <strong>${companyName}</strong> zu nutzen.</p>
      <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zu setzen und sich anzumelden:</p>
      <p><a href="${portalUrl}">${portalUrl}</a></p>
      <p>Dieser Link ist 48 Stunden gültig.</p>
      <p>Mit freundlichen Grüßen<br>${companyName}</p>
    `
  );

  if (!sent) {
    logger.warn({ tenantId, companyId }, "Invite-E-Mail konnte nicht gesendet werden — kein SMTP konfiguriert");
  }
}
