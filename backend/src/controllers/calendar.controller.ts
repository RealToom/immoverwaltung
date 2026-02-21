import type { Request, Response } from "express";
import * as calendarService from "../services/calendar.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;
  const events = await calendarService.listEvents(req.companyId!, from, to);
  res.json({ data: events });
}

export async function create(req: Request, res: Response): Promise<void> {
  const event = await calendarService.createEvent(req.companyId!, req.userId!, req.body);
  res.status(201).json({ data: event });
}

export async function update(req: Request, res: Response): Promise<void> {
  const event = await calendarService.updateEvent(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: event });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await calendarService.deleteEvent(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
