import { Request, Response, NextFunction } from "express";
import { verifyTenantAccessToken, TenantTokenPayload } from "../lib/tenantJwt.js";
import { UnauthorizedError } from "../lib/errors.js";

export function requireTenantAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Kein Token angegeben");
  }

  const token = authHeader.slice(7);
  let payload: TenantTokenPayload;

  try {
    payload = verifyTenantAccessToken(token);
  } catch {
    throw new UnauthorizedError("Ungültiger oder abgelaufener Token");
  }

  if (payload.role !== "TENANT") {
    throw new UnauthorizedError("Zugriff verweigert");
  }

  req.tenantUser = {
    id: payload.tenantUserId,
    tenantId: payload.tenantId,
    companyId: payload.companyId,
  };

  next();
}
