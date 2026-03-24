import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError, UnauthorizedError } from "../lib/errors.js";
import { encryptString } from "../lib/crypto.js";
import { signAccessToken, signRefreshToken } from "../lib/jwt.js";
import {
  generateSecret,
  generateQrCodeUri,
  verifyCode,
  generateBackupCodes,
  verifyBackupCode,
} from "../services/totp.service.js";
import { createAuditLog } from "../services/audit.service.js";

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";

function setRefreshCookie(res: Response, token: string): void {
  const securePart = isProduction ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `refreshToken=${token}; HttpOnly;${securePart} SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_COOKIE_MAX_AGE / 1000}`,
  );
}

async function issueAndStoreTokens(user: { id: number; companyId: number; role: string }) {
  const payload = { userId: user.id, companyId: user.companyId, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

const otpBodySchema = z.object({
  code: z.union([
    z.string().length(6).regex(/^\d{6}$/),
    z.string().length(9).regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  ]),
});

// POST /api/auth/2fa/setup — guarded by requireMfaToken("mfa_setup")
export async function setup2faHandler(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (user.totpEnabled) throw new AppError(400, "2FA bereits aktiviert");
  const plainSecret = generateSecret();
  const encryptedSecret = encryptString(plainSecret);
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptedSecret },
  });
  const qrCodeDataUrl = await generateQrCodeUri(encryptedSecret, user.email);
  res.json({ data: { qrCodeDataUrl, secret: plainSecret } });
}

// POST /api/auth/2fa/verify-setup — guarded by requireMfaToken("mfa_setup")
export async function verifySetupHandler(req: Request, res: Response): Promise<void> {
  const { code } = z.object({ code: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  if (!user.totpSecret) throw new AppError(400, "2FA setup not started");

  const valid = await verifyCode(user.totpSecret, code);
  if (!valid) throw new UnauthorizedError("INVALID_OTP");

  const { plain, hashed } = await generateBackupCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpBackupCodes: hashed },
  });

  const { accessToken, refreshToken } = await issueAndStoreTokens(user);
  setRefreshCookie(res, refreshToken);
  await createAuditLog("LOGIN", { companyId: user.companyId, userId: user.id }, { method: "totp_setup" });

  res.json({ data: { backupCodes: plain, accessToken } });
}

// POST /api/auth/verify-2fa — guarded by requireMfaToken("mfa_pending")
export async function verify2faHandler(req: Request, res: Response): Promise<void> {
  const { code } = otpBodySchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  if (code.length === 6) {
    const valid = await verifyCode(user.totpSecret!, code);
    if (!valid) throw new UnauthorizedError("INVALID_OTP");
  } else {
    const idx = await verifyBackupCode(code, user.totpBackupCodes);
    if (idx === -1) throw new UnauthorizedError("INVALID_OTP");
    const updatedCodes = user.totpBackupCodes.filter((_, i) => i !== idx);
    await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: updatedCodes } });
  }

  const { accessToken, refreshToken } = await issueAndStoreTokens(user);
  setRefreshCookie(res, refreshToken);
  await createAuditLog("LOGIN", { companyId: user.companyId, userId: user.id }, { method: "totp" });

  res.json({ data: { accessToken } });
}

// POST /api/auth/2fa/regenerate-backup-codes — guarded by requireAuth
export async function regenerateBackupCodesHandler(req: Request, res: Response): Promise<void> {
  const { code } = z.object({ code: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  if (!user.totpEnabled || !user.totpSecret) throw new AppError(400, "2FA nicht aktiviert");

  const valid = await verifyCode(user.totpSecret, code);
  if (!valid) throw new UnauthorizedError("INVALID_OTP");

  const { plain, hashed } = await generateBackupCodes();
  await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: hashed } });

  res.json({ data: { backupCodes: plain } });
}
