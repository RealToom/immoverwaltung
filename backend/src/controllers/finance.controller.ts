import type { Request, Response } from "express";
import * as financeService from "../services/finance.service.js";
import { createPdfResponse } from "../lib/pdf.js";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const summary = await financeService.getFinanceSummary(req.companyId!);
  res.json({ data: summary });
}

export async function getMonthly(req: Request, res: Response): Promise<void> {
  const months = Number(req.query.months) || 12;
  const data = await financeService.getMonthlyRevenue(req.companyId!, months);
  res.json({ data });
}

export async function getByProperty(req: Request, res: Response): Promise<void> {
  const data = await financeService.getRevenueByProperty(req.companyId!);
  res.json({ data });
}

export async function getTransactions(req: Request, res: Response): Promise<void> {
  const result = await financeService.listTransactions(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    search: (req.query.search as string) || "",
    type: req.query.type as "EINNAHME" | "AUSGABE" | undefined,
    bankAccountId: req.query.bankAccountId ? Number(req.query.bankAccountId) : undefined,
  });
  res.json(result);
}

export async function getExpenseBreakdown(req: Request, res: Response): Promise<void> {
  const data = await financeService.getExpenseBreakdown(req.companyId!);
  res.json({ data });
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await financeService.createTransaction(req.companyId!, req.body);
  res.status(201).json({ data: transaction });
}

export async function getRentCollection(req: Request, res: Response): Promise<void> {
  const months = Number(req.query.months) || 8;
  const data = await financeService.getRentCollection(req.companyId!, months);
  res.json({ data });
}

export async function patchTransaction(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await financeService.updateTransaction(req.companyId!, id, req.body);
  res.json({ data });
}

export async function getUtilityStatement(req: Request, res: Response): Promise<void> {
  const propertyId = Number(req.query.propertyId);
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await financeService.getUtilityStatement(req.companyId!, propertyId, year);
  res.json({ data });
}

export async function utilityStatementPdf(req: Request, res: Response): Promise<void> {
  const propertyId = Number(req.query.propertyId);
  const year = Number(req.query.year) || new Date().getFullYear();
  const statement = await financeService.getUtilityStatement(req.companyId!, propertyId, year);
  const costPerSqm = statement.totalArea > 0 ? statement.totalCosts / statement.totalArea : 0;

  const doc = createPdfResponse(res, `Nebenkostenabrechnung_${year}`);

  doc.fontSize(20).font("Helvetica-Bold").text("Nebenkostenabrechnung", { align: "center" });
  doc.fontSize(12).font("Helvetica").text(`Jahr: ${year}`, { align: "center" });
  doc.moveDown();
  doc.text(`Gesamtkosten: ${statement.totalCosts.toFixed(2)} €`);
  doc.text(`Gesamtfläche: ${statement.totalArea} m²`);
  doc.text(`Kosten pro m²: ${costPerSqm.toFixed(2)} €`);
  doc.moveDown();

  doc.fontSize(14).font("Helvetica-Bold").text("Abrechnung pro Einheit");
  doc.font("Helvetica").moveDown(0.5);
  for (const u of statement.items) {
    doc.fontSize(10).text(
      `Einheit ${u.unitNumber}  (${u.area} m²  ·  ${u.areaPercent.toFixed(1)} %)  –  Mieter: ${u.tenantName}  –  Anteil: ${u.amount.toFixed(2)} €`,
    );
  }

  doc.end();
}

export async function getRoi(req: Request, res: Response): Promise<void> {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await financeService.getRoiData(req.companyId!, year);
  res.json({ data });
}
