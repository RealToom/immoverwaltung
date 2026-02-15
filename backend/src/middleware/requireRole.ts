import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { ForbiddenError } from "../lib/errors.js";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as UserRole | undefined;
    if (!userRole || !roles.includes(userRole)) {
      next(new ForbiddenError("Keine Berechtigung fuer diese Aktion"));
      return;
    }
    next();
  };
}
