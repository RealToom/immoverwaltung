import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validierungsfehler",
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.error("Unhandled error:", err);
  } else {
    console.error("Unhandled error:", err.message);
  }
  res.status(500).json({
    error: { message: "Interner Serverfehler" },
  });
}
