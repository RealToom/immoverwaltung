import type { Request, Response } from "express";
import * as documentService from "../services/document.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const documents = await documentService.listDocuments(req.companyId!, Number(req.params.propertyId));
  res.json({ data: documents });
}

export async function create(req: Request, res: Response): Promise<void> {
  const doc = await documentService.createDocument(req.companyId!, Number(req.params.propertyId), req.body);
  res.status(201).json({ data: doc });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await documentService.deleteDocument(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
