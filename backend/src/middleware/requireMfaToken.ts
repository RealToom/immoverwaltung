import type { Request, Response, NextFunction } from "express";
import { verifyMfaToken } from "../lib/jwt.js";
import { UnauthorizedError } from "../lib/errors.js";

export function requireMfaToken(type: "mfa_pending" | "mfa_setup") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers["x-mfa-token"] as string | undefined;
    if (!token) throw new UnauthorizedError("TOKEN_EXPIRED");

    let payload;
    try {
      payload = verifyMfaToken(token);
    } catch {
      throw new UnauthorizedError("TOKEN_EXPIRED");
    }

    if (payload.type !== type) throw new UnauthorizedError("TOKEN_EXPIRED");

    req.userId = payload.userId;
    next();
  };
}
