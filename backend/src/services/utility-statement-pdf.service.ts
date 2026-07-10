import fs from "node:fs";
import { createPdfFile } from "../lib/pdf.js";

export interface TenantStatementCategoryLine {
  category: string;
  amount: number;
}

export interface TenantStatementPdfInput {
  companyName: string;
  propertyName: string;
  tenantName: string;
  unitNumber: string;
  year: number;
  amount: number;
  balance: number;
  isRefund: boolean;
  categories: TenantStatementCategoryLine[];
  co2: { landlordPercentage: number; landlordShare: number; tenantShare: number; energyClass: string | null } | null;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

/**
 * Renders one tenant's finalized utility statement as a PDF and writes it
 * to outputPath. Pure rendering — no Prisma access, no I/O beyond the file
 * write itself, so it's testable without mocking anything but the filesystem.
 */
export async function generateTenantStatementPdf(
  input: TenantStatementPdfInput,
  outputPath: string
): Promise<{ filePath: string; fileSizeBytes: number }> {
  const { doc, done } = createPdfFile(outputPath);

  doc.fontSize(18).font("Helvetica-Bold").text("Nebenkostenabrechnung", { align: "center" });
  doc.fontSize(11).font("Helvetica").text(`Abrechnungszeitraum: ${input.year}`, { align: "center" });
  doc.moveDown(1.5);

  doc.fontSize(11).text(`Vermieter: ${input.companyName}`);
  doc.text(`Mieter: ${input.tenantName}`);
  doc.text(`Einheit: ${input.unitNumber}, ${input.propertyName}`);
  doc.moveDown();

  doc.fontSize(13).font("Helvetica-Bold").text("Kostenaufstellung nach Kategorie");
  doc.font("Helvetica").fontSize(10).moveDown(0.5);
  if (input.categories.length === 0) {
    doc.text("Keine kategorisierten Kosten vorhanden.");
  } else {
    for (const c of input.categories) {
      doc.text(`${c.category}: ${formatEur(c.amount)}`);
    }
  }
  doc.moveDown();

  if (input.co2 && input.co2.landlordShare > 0) {
    doc.fontSize(13).font("Helvetica-Bold").text("CO2-Kostenaufteilung (CO2KostAufG)");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(`Energieklasse des Gebäudes: ${input.co2.energyClass ?? "unbekannt"}`);
    doc.text(
      `Vermieter-Anteil: ${input.co2.landlordPercentage}% (${formatEur(input.co2.landlordShare)}) — bereits von den umgelegten Kosten abgezogen.`
    );
    doc.moveDown();
  }

  doc.fontSize(13).font("Helvetica-Bold").text("Ergebnis");
  doc.font("Helvetica").fontSize(11).moveDown(0.5);
  doc.text(`Ihr Kostenanteil: ${formatEur(input.amount)}`);
  doc.text(
    input.isRefund
      ? `Guthaben: ${formatEur(Math.abs(input.balance))}`
      : `Nachzahlung: ${formatEur(Math.abs(input.balance))}`
  );
  doc.moveDown(2);

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#555555")
    .text(
      "Hinweis: Gemäß § 556 Abs. 3 BGB können Einwendungen gegen diese Abrechnung innerhalb von 12 Monaten nach " +
        'Zugang schriftlich erhoben werden. Ein Widerspruch kann bequem über das Mieter-Portal (Menüpunkt "Abrechnung ' +
        'prüfen") eingereicht werden.',
      { align: "left" }
    );

  doc.end();
  await done;

  const stats = fs.statSync(outputPath);
  return { filePath: outputPath, fileSizeBytes: stats.size };
}
