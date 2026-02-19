import { Request, Response } from "express";
import fs from "fs";
import { scanReceipt } from "../services/receipt.service.js";
import { logger } from "../lib/logger.js";

export async function scanReceiptController(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }
  try {
    const result = await scanReceipt(file.path, file.mimetype);
    res.json({ data: result });
  } catch (err) {
    logger.error({ err }, "KI-Scan fehlgeschlagen");
    res.status(502).json({ error: "KI-Scan fehlgeschlagen. Bitte erneut versuchen." });
  } finally {
    // Temporäre Datei sofort löschen
    fs.unlink(file.path, () => {});
  }
}
