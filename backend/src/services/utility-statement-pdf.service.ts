import fs from "node:fs";
import { createPdfFile } from "../lib/pdf.js";
import { TenantCategoryLine } from "../lib/betrkv.js";

export interface TenantStatementPdfInput {
  companyName: string;
  propertyName: string;
  tenantName: string;
  unitNumber: string;
  year: number;
  /** Tenant's total allocated cost share. */
  amount: number;
  /** totalPrepaid - amount (positive = refund). */
  balance: number;
  isRefund: boolean;
  /** Prepayments (Nebenkostenvorauszahlungen) credited to this tenant. */
  totalPrepaid: number;
  /** Distribution key data (§ 556 BGB formal requirements). */
  area: number;
  totalArea: number;
  occupancyDays: number;
  daysInYear: number;
  /** Property-level gross allocatable costs. */
  totalCosts: number;
  categories: TenantCategoryLine[];
  /** Per-category distribution key (Verteilerschlüssel), e.g. { GRUNDSTEUER: "WOHNFLAECHE" }. */
  distributionKeys?: Record<string, string>;
  co2: { landlordPercentage: number; landlordShare: number; tenantShare: number; energyClass: string | null } | null;
  heating: {
    consumptionBased: boolean;
    consumptionSharePercent?: number | null;
    warning?: string;
    estimationNotice?: string;
  } | null;
  vacancyDeduction: number;
  /** § 556a BGB: note shown when the property contains commercial units. */
  vorwegabzugNote?: string | null;
  /** § 35a EStG: the tenant's deductible labor-cost share (Lohnkosten). */
  laborCostShare?: number;
}

const DISTRIBUTION_KEY_LABELS: Record<string, string> = {
  WOHNFLAECHE: "Wohnfläche",
  PERSONEN: "Personenzahl",
  WOHNEINHEIT: "Wohneinheit",
};

function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function formatArea(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Renders one tenant's finalized utility statement as a PDF and writes it to
 * outputPath. Contains the formal minimum content required by § 556 Abs. 3
 * BGB case law: total costs per category, the distribution key, the
 * derivation of the tenant's share, and the deduction of prepayments.
 * Pure rendering — no Prisma access, no I/O beyond the file write itself.
 */
export async function generateTenantStatementPdf(
  input: TenantStatementPdfInput,
  outputPath: string
): Promise<{ filePath: string; fileSizeBytes: number }> {
  const { doc, done } = createPdfFile(outputPath);

  doc.fontSize(18).font("Helvetica-Bold").text("Nebenkostenabrechnung", { align: "center" });
  doc.fontSize(11).font("Helvetica").text(
    `Abrechnungszeitraum: 01.01.${input.year} – 31.12.${input.year}`,
    { align: "center" }
  );
  doc.moveDown(1.5);

  doc.fontSize(11).text(`Vermieter/Verwalter: ${input.companyName}`);
  doc.text(`Mieter: ${input.tenantName}`);
  doc.text(`Einheit: ${input.unitNumber}, ${input.propertyName}`);
  doc.moveDown();

  doc.fontSize(13).font("Helvetica-Bold").text("Verteilerschlüssel");
  doc.font("Helvetica").fontSize(10).moveDown(0.5);
  doc.text(
    `Wohnfläche: ${formatArea(input.area)} m² von ${formatArea(input.totalArea)} m² Gesamtfläche. ` +
      `Nutzungszeitraum: ${input.occupancyDays} von ${input.daysInYear} Tagen.`
  );
  if (input.heating?.consumptionBased) {
    const consPercent = input.heating.consumptionSharePercent ?? 70;
    doc.text(
      `Heiz-/Warmwasserkosten: ${consPercent} % nach gemessenem Verbrauch, ` +
        `${100 - consPercent} % als Grundkosten nach Wohnfläche (§ 7 HeizkostenV).`
    );
  }
  doc.text("Übrige Betriebskosten: nach Wohnfläche, zeitanteilig für den Nutzungszeitraum.");
  doc.moveDown();

  doc.fontSize(13).font("Helvetica-Bold").text("Kostenaufstellung");
  doc.font("Helvetica").fontSize(10).moveDown(0.5);
  if (input.categories.length === 0) {
    doc.text("Keine kategorisierten Kosten vorhanden.");
  } else {
    for (const c of input.categories) {
      const key = input.distributionKeys?.[c.category];
      const keyLabel = key ? ` [${DISTRIBUTION_KEY_LABELS[key] ?? key}]` : "";
      doc.text(
        `${c.label}${keyLabel}  —  Gesamtkosten: ${formatEur(c.propertyTotal)}, Ihr Anteil: ${formatEur(c.tenantShare)}`
      );
    }
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text(
      `Gesamtkosten der Liegenschaft: ${formatEur(input.totalCosts)} — Ihr Kostenanteil: ${formatEur(input.amount)}`
    );
    doc.font("Helvetica");
  }
  if (input.vacancyDeduction > 0) {
    doc.moveDown(0.5);
    doc.text(
      `Auf Leerstand entfallende Kosten von ${formatEur(input.vacancyDeduction)} trägt der Eigentümer; ` +
        "sie wurden nicht auf die Mieter umgelegt."
    );
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

  if (input.heating?.warning) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#8a6d00").text("Hinweis zur Heizkostenverteilung");
    doc.font("Helvetica").text(input.heating.warning);
    doc.fillColor("#000000").moveDown();
  }

  if (input.heating?.estimationNotice) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#8a6d00").text("Hinweis zur Verbrauchsschätzung");
    doc.font("Helvetica").text(input.heating.estimationNotice);
    doc.fillColor("#000000").moveDown();
  }

  if (input.vorwegabzugNote) {
    doc.fontSize(10).font("Helvetica-Bold").text("Vorwegabzug Gewerbe (§ 556a BGB)");
    doc.font("Helvetica").text(input.vorwegabzugNote);
    doc.moveDown();
  }

  doc.fontSize(13).font("Helvetica-Bold").text("Ergebnis");
  doc.font("Helvetica").fontSize(11).moveDown(0.5);
  doc.text(`Ihr Kostenanteil: ${formatEur(input.amount)}`);
  doc.text(`Geleistete Vorauszahlungen: ${formatEur(input.totalPrepaid)}`);
  doc.font("Helvetica-Bold").text(
    input.isRefund
      ? `Ihr Guthaben: ${formatEur(Math.abs(input.balance))}`
      : `Nachzahlung: ${formatEur(Math.abs(input.balance))}`
  );
  doc.font("Helvetica").moveDown();

  if (input.laborCostShare && input.laborCostShare > 0) {
    doc.fontSize(13).font("Helvetica-Bold").text("Bescheinigung nach § 35a EStG");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(
      `In Ihrem Kostenanteil enthaltene Lohn-/Arbeitskosten für haushaltsnahe Dienst- und ` +
        `Handwerkerleistungen: ${formatEur(input.laborCostShare)}. Hiervon können Sie 20 % ` +
        `(${formatEur(Math.round(input.laborCostShare * 0.2 * 100) / 100)}) gemäß § 35a EStG von Ihrer ` +
        `Einkommensteuer absetzen.`
    );
    doc.moveDown(2);
  } else {
    doc.moveDown();
  }

  doc
    .fontSize(8)
    .fillColor("#555555")
    .text(
      "Hinweis: Gemäß § 556 Abs. 3 BGB können Einwendungen gegen diese Abrechnung innerhalb von 12 Monaten nach " +
        "Zugang schriftlich erhoben werden. Die Einsicht in die Abrechnungsbelege wird auf Wunsch gewährt. Ein " +
        'Widerspruch kann bequem über das Mieter-Portal (Menüpunkt "Abrechnung prüfen") eingereicht werden.',
      { align: "left" }
    );

  doc.end();
  await done;

  const stats = fs.statSync(outputPath);
  return { filePath: outputPath, fileSizeBytes: stats.size };
}
