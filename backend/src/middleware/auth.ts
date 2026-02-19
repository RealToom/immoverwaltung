import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { UnauthorizedError } from "../lib/errors.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = {
      id: payload.userId,
      companyId: payload.companyId,
      role: payload.role,
    };
    req.companyId = payload.companyId;
    next();
  } catch {
    next(new UnauthorizedError("Token abgelaufen oder ungueltig"));
  }
}
