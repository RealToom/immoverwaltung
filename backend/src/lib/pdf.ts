import PDFDocument from "pdfkit";
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
