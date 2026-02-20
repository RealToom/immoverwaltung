import { Request, Response } from "express";
import fs from "fs";
import { scanReceipt } from "../services/receipt.service.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

export async function scanReceiptController(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }

  // KI-Scan nur wenn API-Key konfiguriert
  if (!env.ANTHROPIC_API_KEY) {
    fs.unlink(file.path, () => {});
    res.status(503).json({ error: "KI-Belegscan ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)" });
    return;
  }

  try {
    const result = await scanReceipt(file.path, file.mimetype);
    res.json({ data: result });
  } catch (err) {
    // Fehlerdetails sanitieren — kein API-Key oder Stack-Trace in der Antwort
    logger.error({ errorMessage: err instanceof Error ? err.message : "Unknown" }, "KI-Scan fehlgeschlagen");
    res.status(502).json({ error: "KI-Scan fehlgeschlagen. Bitte erneut versuchen." });
  } finally {
    // Temporäre Datei sofort löschen (mit Fehler-Logging)
    fs.unlink(file.path, (unlinkErr) => {
      if (unlinkErr && unlinkErr.code !== "ENOENT") {
        logger.warn(
          { err: unlinkErr, path: file.path },
          "Temporäre Scan-Datei konnte nicht gelöscht werden — manuelle Bereinigung nötig"
        );
      }
    });
  }
}
