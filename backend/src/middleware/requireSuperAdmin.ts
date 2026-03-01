import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    next(new AppError(401, "Nicht autorisiert"));
    return;
  }
  const token = auth.slice(7);
  try {
    jwt.verify(token, env.SUPERADMIN_JWT_SECRET);
    next();
  } catch {
    next(new AppError(401, "Ungültiger Superadmin-Token"));
  }
}
