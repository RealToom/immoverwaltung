import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../lib/errors.js";

export function tenantGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || !req.user.companyId) {
    next(new ForbiddenError("Kein Unternehmen zugeordnet"));
    return;
  }

  req.companyId = req.user.companyId;
  next();
}
