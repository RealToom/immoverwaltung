import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import type { RegisterInput, LoginInput, UpdateProfileInput, UpdateNotificationPrefsInput } from "../schemas/auth.schema.js";

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const isProduction = process.env.NODE_ENV === "production";

function setRefreshCookie(res: Response, token: string): void {
  const securePart = isProduction ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `refreshToken=${token}; HttpOnly;${securePart} SameSite=Lax; Path=/api/auth; Max-Age=${REFRESH_COOKIE_MAX_AGE / 1000}`
  );
}

function clearRefreshCookie(res: Response): void {
  const securePart = isProduction ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `refreshToken=; HttpOnly;${securePart} SameSite=Lax; Path=/api/auth; Max-Age=0`
  );
}

function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  const cookies = header.split("; ");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

export async function registerHandler(req: Request, res: Response) {
  const { name, email, password, companyName } = req.body as RegisterInput;

  const result = await authService.register(name, email, password, companyName);

  setRefreshCookie(res, result.refreshToken);

  res.status(201).json({
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  const result = await authService.login(email, password);

  setRefreshCookie(res, result.refreshToken);

  res.json({
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
}

export async function refreshHandler(req: Request, res: Response) {
  const token = parseCookie(req, "refreshToken");

  if (!token) {
    throw new (await import("../lib/errors.js")).UnauthorizedError(
      "Kein Refresh-Token vorhanden"
    );
  }

  const result = await authService.refreshToken(token);

  // Set new refresh token cookie (rotation)
  setRefreshCookie(res, result.refreshToken);

  res.json({ data: { accessToken: result.accessToken } });
}

export async function logoutHandler(req: Request, res: Response) {
  // Revoke refresh token from DB
  const token = parseCookie(req, "refreshToken");
  if (token) {
    const { prisma } = await import("../lib/prisma.js");
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  clearRefreshCookie(res);

  res.json({ data: { message: "Abgemeldet" } });
}

export async function getMeHandler(req: Request, res: Response) {
  const user = await authService.getProfile(req.user!.id);

  res.json({ data: user });
}

export async function updateMeHandler(req: Request, res: Response) {
  const data = req.body as UpdateProfileInput;

  const user = await authService.updateProfile(req.user!.id, data);

  res.json({ data: user });
}

export async function getNotificationPrefsHandler(req: Request, res: Response) {
  const prefs = await authService.getNotificationPrefs(req.user!.id);

  res.json({ data: prefs });
}

export async function updateNotificationPrefsHandler(req: Request, res: Response) {
  const data = req.body as UpdateNotificationPrefsInput;

  const prefs = await authService.updateNotificationPrefs(req.user!.id, data);

  res.json({ data: prefs });
}
