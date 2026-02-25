import type { Request, Response } from "express";
import * as svc from "../services/email-message.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await svc.listMessages(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    accountId: req.query.accountId ? Number(req.query.accountId) : undefined,
    isRead: req.query.isRead === "true" ? true : req.query.isRead === "false" ? false : undefined,
    isInquiry: req.query.isInquiry === "true" ? true : req.query.isInquiry === "false" ? false : undefined,
    inquiryStatus: req.query.inquiryStatus as string | undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.getMessage(req.companyId!, Number(req.params.id)) });
}

export async function update(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.updateMessage(req.companyId!, Number(req.params.id), req.body) });
}

export async function reply(req: Request, res: Response): Promise<void> {
  await svc.replyToMessage(req.companyId!, Number(req.params.id), req.body.body);
  res.json({ message: "Antwort gesendet" });
}

export async function sendDocument(req: Request, res: Response): Promise<void> {
  await svc.sendDocument(req.companyId!, Number(req.params.id), req.body.documentId, req.body.body);
  res.json({ message: "Dokument gesendet" });
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  const event = await svc.createEventFromEmail(req.companyId!, req.userId!, Number(req.params.id), req.body);
  res.status(201).json({ data: event });
}

export async function sendNew(req: Request, res: Response): Promise<void> {
  await svc.sendNewEmail(req.companyId!, req.body);
  res.json({ message: "Nachricht gesendet" });
}
