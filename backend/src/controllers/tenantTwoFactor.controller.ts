import type { Request, Response } from "express";
import * as twoFactorService from "../services/tenantTwoFactor.service.js";
import { verifyTenantMfaToken } from "../lib/tenantJwt.js";
import type {
  Verify2faInput,
  Confirm2faInput,
  Disable2faInput,
} from "../schemas/tenantTwoFactor.schema.js";
import { UnauthorizedError } from "../lib/errors.js";
import {
  setDeviceCookie,
  clearDeviceCookie,
  setTenantRefreshCookie,
} from "./tenantAuth.controller.js";

// ─── POST /verify-2fa ──────────────────────────────────────────────────────────
export async function verify2faHandler(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("mfaToken fehlt");
  }
  const rawMfaToken = authHeader.slice(7);

  let payload;
  try {
    payload = verifyTenantMfaToken(rawMfaToken);
  } catch {
    throw new UnauthorizedError("mfaToken ungültig oder abgelaufen");
  }

  const { code, rememberDevice } = req.body as Verify2faInput;

  await twoFactorService.verifyTwoFactorCode(payload.tenantUserId, code);

  const result = await twoFactorService.completeTwoFactorLogin(
    payload.tenantUserId,
    payload.companyId,
    rememberDevice ?? false
  );

  if (result.deviceToken) {
    setDeviceCookie(res, result.deviceToken);
  }

  setTenantRefreshCookie(res, result.refreshToken);
  res.json({ data: { accessToken: result.accessToken } });
}

// ─── GET /me/2fa/status ────────────────────────────────────────────────────────
export async function get2faStatusHandler(req: Request, res: Response) {
  const tenantUserId = req.tenantUser!.id;
  const status = await twoFactorService.getTwoFactorStatus(tenantUserId);
  res.json({ data: status });
}

// ─── POST /me/2fa/enable ───────────────────────────────────────────────────────
export async function enable2faHandler(req: Request, res: Response) {
  const tenantUserId = req.tenantUser!.id;
  const companyId = req.tenantUser!.companyId;
  await twoFactorService.sendTwoFactorCode(tenantUserId, companyId);
  res.json({ data: { codeSent: true } });
}

// ─── POST /me/2fa/confirm ──────────────────────────────────────────────────────
export async function confirm2faHandler(req: Request, res: Response) {
  const tenantUserId = req.tenantUser!.id;
  const { code } = req.body as Confirm2faInput;
  await twoFactorService.verifyTwoFactorCode(tenantUserId, code);
  await twoFactorService.enableTwoFactor(tenantUserId);
  res.json({ data: { success: true } });
}

// ─── DELETE /me/2fa ────────────────────────────────────────────────────────────
export async function disable2faHandler(req: Request, res: Response) {
  const tenantUserId = req.tenantUser!.id;
  const { password } = req.body as Disable2faInput;
  await twoFactorService.disableTwoFactor(tenantUserId, password);
  clearDeviceCookie(res);
  res.json({ data: { success: true } });
}

// ─── DELETE /tenants/:tenantUserId/2fa (Admin-Reset) ──────────────────────────
export async function adminReset2faHandler(req: Request, res: Response) {
  const tenantUserId = parseInt(req.params.tenantUserId as string, 10);
  const companyId = req.companyId!;
  await twoFactorService.adminResetTwoFactor(tenantUserId, companyId);
  res.json({ data: { success: true } });
}
