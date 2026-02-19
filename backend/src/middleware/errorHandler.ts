import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

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

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "Datei zu gross (max. 10 MB)"
      : `Upload-Fehler: ${err.message}`;
    res.status(400).json({ error: { message } });
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

  // multer fileFilter errors kommen als plain Error
  if (err.message?.includes("Nicht unterstuetzter Dateityp")) {
    res.status(400).json({ error: { message: err.message } });
    return;
  }

  logger.error({ err }, "Unbehandelter Fehler");
  res.status(500).json({
    error: { message: "Interner Serverfehler" },
  });
}
