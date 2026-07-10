import PDFDocument from "pdfkit";
import fs from "node:fs";
import type { Response } from "express";

export function createPdfResponse(res: Response, filename: string): PDFKit.PDFDocument {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  return doc;
}

/**
 * Like createPdfResponse, but pipes to a file on disk instead of an HTTP
 * response — for batch-generating documents that get stored (via
 * document.service.ts) rather than streamed to a single requester.
 */
export function createPdfFile(filePath: string): { doc: PDFKit.PDFDocument; done: Promise<void> } {
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  const done = new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return { doc, done };
}
