import type { Request, Response } from "express";
import { generateReportData, generateReportCsv } from "../services/report.service.js";
import { createPdfResponse } from "../lib/pdf.js";

export async function exportReport(req: Request, res: Response): Promise<void> {
  const format = (req.query.format as string) === "pdf" ? "pdf" : "csv";
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;

  const data = await generateReportData(req.companyId!, from, to);

  if (format === "pdf") {
    const fromStr = data.from ? data.from.toLocaleDateString("de-DE") : "Beginn";
    const toStr = data.to ? data.to.toLocaleDateString("de-DE") : "Heute";

    const doc = createPdfResponse(res, `Bericht_${fromStr}-${toStr}`);

    doc.fontSize(20).font("Helvetica-Bold").text("Immobilienverwaltung \u2013 Bericht", { align: "center" });
    doc.fontSize(12).font("Helvetica").text(`Zeitraum: ${fromStr} \u2013 ${toStr}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").text("Immobilien");
    doc.font("Helvetica").moveDown(0.5);
    for (const p of data.properties) {
      doc.fontSize(10).text(
        `${p.name}  \u2013  ${p.occupiedUnits}/${p.totalUnits} Units  \u2013  ` +
        `Rent: ${p.monthlyRevenue.toFixed(2).replace(".", ",")} \u20ac  \u2013  ` +
        `Maintenance: ${p.maintenanceCost.toFixed(2).replace(".", ",")} \u20ac  \u2013  ` +
        `Tickets: ${p.openTickets}`,
      );
    }

    doc.moveDown();
    doc.fontSize(14).font("Helvetica-Bold").text("Finanzsummary");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(`Einnahmen:  ${data.income.toFixed(2).replace(".", ",")} \u20ac`);
    doc.text(`Ausgaben:   ${data.expenses.toFixed(2).replace(".", ",")} \u20ac`);
    doc.text(`Netto:      ${(data.income - data.expenses).toFixed(2).replace(".", ",")} \u20ac`);

    doc.moveDown();
    doc.fontSize(14).font("Helvetica-Bold").text("Wartungstickets");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(`Tickets im Zeitraum: ${data.ticketCount}`);

    doc.end();
    return;
  }

  // CSV
  const csv = generateReportCsv(data);
  const fromStr = data.from ? data.from.toLocaleDateString("de-DE") : "Beginn";
  const toStr = data.to ? data.to.toLocaleDateString("de-DE") : "Heute";
  const csvFilename = encodeURIComponent(`Bericht_${fromStr}-${toStr}.csv`);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${csvFilename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.send(csv);
}
