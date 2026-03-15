import type { Request, Response } from "express";
import * as svc from "../services/handover.service.js";
import { createPdfResponse } from "../lib/pdf.js";

export async function list(req: Request, res: Response) {
  const unitId = req.query.unitId ? Number(req.query.unitId) : undefined;
  res.json({ data: await svc.listHandovers(req.companyId!, unitId) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await svc.createHandover(req.companyId!, req.body) });
}

export async function getById(req: Request, res: Response) {
  res.json({ data: await svc.getHandover(req.companyId!, Number(req.params.id)) });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteHandover(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}

export async function exportPdf(req: Request, res: Response) {
  const h = await svc.getHandoverForPdf(req.companyId!, Number(req.params.id));

  const typeLabel = h.type === "EINZUG" ? "Einzugsprotokoll" : "Auszugsprotokoll";
  const dateStr = new Date(h.date).toLocaleDateString("de-DE");
  const property = h.unit?.property;
  const address = property
    ? `${property.street}, ${property.zip} ${property.city}`
    : "";

  const doc = createPdfResponse(res, `${typeLabel}_${h.tenantName}_${dateStr}`);
  const rooms = h.rooms as { name: string; condition: string; notes?: string }[];
  const meters = h.meterData as { label: string; type: string; value: number }[];

  const CONDITION: Record<string, string> = { GUT: "Gut", MAENGEL: "Mängel", DEFEKT: "Defekt" };

  // ── Header ──────────────────────────────────────────────────
  doc.fontSize(18).font("Helvetica-Bold").text(typeLabel, { align: "center" });
  doc.fontSize(11).font("Helvetica").text(h.company?.name ?? "", { align: "center" });
  doc.moveDown(1.5);

  // ── Metadata table ───────────────────────────────────────────
  const col1 = 50, col2 = 200;
  const meta = [
    ["Mieter:", h.tenantName],
    ["Datum:", dateStr],
    ["Einheit:", h.unit?.number ?? String(h.unitId)],
    ["Immobilie:", property?.name ?? ""],
    ["Adresse:", address],
  ];
  doc.fontSize(10).font("Helvetica-Bold").text("Allgemein", col1);
  doc.moveDown(0.3);
  for (const [label, value] of meta) {
    doc.font("Helvetica-Bold").text(label, col1, undefined, { continued: true, width: 140 });
    doc.font("Helvetica").text(value, col2);
  }
  if (h.notes) {
    doc.font("Helvetica-Bold").text("Notizen:", col1, undefined, { continued: true, width: 140 });
    doc.font("Helvetica").text(h.notes, col2);
  }
  doc.moveDown(1);

  // ── Rooms ────────────────────────────────────────────────────
  if (rooms.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").text("Raumzustand");
    doc.moveDown(0.4);
    const colW = [200, 100, 200];
    const headers = ["Raum", "Zustand", "Notizen"];
    let y = doc.y;
    doc.fontSize(9).font("Helvetica-Bold");
    headers.forEach((h, i) => {
      doc.text(h, col1 + colW.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colW[i] });
    });
    doc.moveDown(0.2);
    doc.moveTo(col1, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9);
    for (const r of rooms) {
      y = doc.y;
      doc.text(r.name, col1, y, { width: colW[0] });
      doc.text(CONDITION[r.condition] ?? r.condition, col1 + colW[0], y, { width: colW[1] });
      doc.text(r.notes ?? "—", col1 + colW[0] + colW[1], y, { width: colW[2] });
      doc.moveDown(0.3);
    }
    doc.moveDown(0.8);
  }

  // ── Meter data ───────────────────────────────────────────────
  if (meters.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").text("Zählerstände");
    doc.moveDown(0.4);
    const colW = [200, 120, 150];
    const headers = ["Bezeichnung", "Typ", "Stand"];
    let y = doc.y;
    doc.fontSize(9).font("Helvetica-Bold");
    headers.forEach((h, i) => {
      doc.text(h, col1 + colW.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colW[i] });
    });
    doc.moveDown(0.2);
    doc.moveTo(col1, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9);
    for (const m of meters) {
      y = doc.y;
      doc.text(m.label, col1, y, { width: colW[0] });
      doc.text(m.type, col1 + colW[0], y, { width: colW[1] });
      doc.text(m.value.toLocaleString("de-DE"), col1 + colW[0] + colW[1], y, { width: colW[2] });
      doc.moveDown(0.3);
    }
    doc.moveDown(1.5);
  }

  // ── Signature line ───────────────────────────────────────────
  doc.moveTo(col1, doc.y).lineTo(250, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").text("Unterschrift Mieter", col1);
  doc.moveDown(0.3);
  doc.moveTo(300, doc.y).lineTo(530, doc.y).stroke();
  doc.moveDown(0.3);
  doc.text("Unterschrift Verwalter", 300);

  doc.end();
}
