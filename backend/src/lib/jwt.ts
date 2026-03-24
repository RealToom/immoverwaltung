import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: number;
  companyId: number;
  role: string;
}

function getAccessSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_ACCESS_SECRET ist nicht gesetzt");
  return s;
}

function getRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_REFRESH_SECRET ist nicht gesetzt");
  return s;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getAccessSecret()) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getRefreshSecret()) as TokenPayload;
}

export interface MfaTokenPayload {
  userId: number;
  type: "mfa_pending" | "mfa_setup";
}

export function signMfaToken(
  userId: number,
  type: "mfa_pending" | "mfa_setup"
): string {
  return jwt.sign({ userId, type }, getAccessSecret(), { expiresIn: "5m" });
}

export function verifyMfaToken(token: string): MfaTokenPayload {
  return jwt.verify(token, getAccessSecret()) as MfaTokenPayload;
}
