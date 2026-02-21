import type { Request, Response } from "express";
import * as svc from "../services/document-template.service.js";
import { createPdfResponse } from "../lib/pdf.js";

export async function list(req: Request, res: Response) {
  res.json({ data: await svc.listTemplates(req.companyId!) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await svc.createTemplate(req.companyId!, req.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await svc.updateTemplate(req.companyId!, Number(req.params.id), req.body) });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteTemplate(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}

export async function renderToPdf(req: Request, res: Response) {
  const { variables = {} } = req.body as { variables?: Record<string, unknown> };
  const rendered = await svc.renderTemplate(
    req.companyId!,
    Number(req.params.id),
    variables,
  );
  const doc = createPdfResponse(res, "Dokument");
  doc.fontSize(11).text(rendered, { lineGap: 4 });
  doc.end();
}
