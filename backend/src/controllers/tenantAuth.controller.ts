import type { Request, Response } from "express";
import * as tenantAuthService from "../services/tenantAuth.service.js";
import type {
  TenantLoginInput,
  TenantAcceptInviteInput,
} from "../schemas/tenantAuth.schema.js";
import {
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_MAX_AGE_SECONDS,
} from "../services/tenantTwoFactor.service.js";

const COOKIE_NAME = tenantAuthService.COOKIE_NAME;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const isProduction = process.env.NODE_ENV === "production";

function securePart(): string {
  return isProduction ? " Secure;" : "";
}

export function setTenantRefreshCookie(res: Response, token: string): void {
  res.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly;${securePart()} SameSite=Strict; Path=/api/tenant; Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}`
  );
}

function clearTenantRefreshCookie(res: Response): void {
  res.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly;${securePart()} SameSite=Strict; Path=/api/tenant; Max-Age=0`
  );
}

export function setDeviceCookie(res: Response, deviceToken: string): void {
  res.append(
    "Set-Cookie",
    `${DEVICE_COOKIE_NAME}=${deviceToken}; HttpOnly;${securePart()} SameSite=Strict; Path=/api/tenant; Max-Age=${DEVICE_COOKIE_MAX_AGE_SECONDS}`
  );
}

export function clearDeviceCookie(res: Response): void {
  res.append(
    "Set-Cookie",
    `${DEVICE_COOKIE_NAME}=; HttpOnly;${securePart()} SameSite=Strict; Path=/api/tenant; Max-Age=0`
  );
}

export function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const cookie of header.split("; ")) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body as TenantLoginInput;
  const companyId = req.companyId!;
  const deviceToken = parseCookie(req, DEVICE_COOKIE_NAME);

  const result = await tenantAuthService.loginTenant(
    email,
    password,
    companyId,
    deviceToken
  );

  if (result.requiresTwoFactor) {
    res.json({ data: { requiresTwoFactor: true, mfaToken: result.mfaToken } });
    return;
  }

  setTenantRefreshCookie(res, result.refreshToken);
  res.json({ data: { accessToken: result.accessToken } });
}

export async function refreshHandler(req: Request, res: Response) {
  const token = parseCookie(req, COOKIE_NAME);
  if (!token) {
    res.status(401).json({ error: "Kein Refresh Token" });
    return;
  }

  const { accessToken, refreshToken } =
    await tenantAuthService.refreshTenantToken(token);
  setTenantRefreshCookie(res, refreshToken);
  res.json({ data: { accessToken } });
}

export async function logoutHandler(req: Request, res: Response) {
  const tenantUserId = req.tenantUser!.id;
  await tenantAuthService.logoutTenant(tenantUserId);
  clearTenantRefreshCookie(res);
  res.json({ data: { message: "Erfolgreich abgemeldet" } });
}

export async function acceptInviteHandler(req: Request, res: Response) {
  const { token, password } = req.body as TenantAcceptInviteInput;
  const { accessToken, refreshToken } = await tenantAuthService.acceptInvite(
    token,
    password
  );
  setTenantRefreshCookie(res, refreshToken);
  res.json({ data: { accessToken } });
}

export async function inviteTenantHandler(req: Request, res: Response) {
  const tenantId = parseInt(req.params.id as string, 10);
  const companyId = req.companyId!;
  await tenantAuthService.sendTenantInvite(tenantId, companyId);
  res.json({ data: { message: "Einladung wurde gesendet" } });
}
