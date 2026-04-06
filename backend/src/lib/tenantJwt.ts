import jwt from "jsonwebtoken";

export interface TenantTokenPayload {
  tenantUserId: number;
  tenantId: number;
  companyId: number;
  role: "TENANT";
}

function getTenantAccessSecret(): string {
  const s = process.env.JWT_TENANT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_TENANT_ACCESS_SECRET ist nicht gesetzt");
  return s;
}

function getTenantRefreshSecret(): string {
  const s = process.env.JWT_TENANT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_TENANT_REFRESH_SECRET ist nicht gesetzt");
  return s;
}

export function signTenantAccessToken(
  payload: Omit<TenantTokenPayload, "role">
): string {
  return jwt.sign({ ...payload, role: "TENANT" }, getTenantAccessSecret(), {
    expiresIn: "15m",
  });
}

export function signTenantRefreshToken(
  payload: Omit<TenantTokenPayload, "role">
): string {
  return jwt.sign({ ...payload, role: "TENANT" }, getTenantRefreshSecret(), {
    expiresIn: "7d",
  });
}

export function verifyTenantAccessToken(token: string): TenantTokenPayload {
  return jwt.verify(token, getTenantAccessSecret()) as TenantTokenPayload;
}

export function verifyTenantRefreshToken(token: string): TenantTokenPayload {
  return jwt.verify(token, getTenantRefreshSecret()) as TenantTokenPayload;
}
