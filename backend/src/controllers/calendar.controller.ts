import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import * as calendarService from "../services/calendar.service.js";
import { prisma } from "../lib/prisma.js";

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

export async function exportIcal(req: Request, res: Response): Promise<void> {
  const ics = await calendarService.exportIcal(req.companyId!);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="kalender.ics"');
  res.send(ics);
}

// Public: resolve user by calendarToken and return iCal feed (no auth required)
export async function exportIcalByToken(req: Request, res: Response): Promise<void> {
  const token = String(req.params.token);
  const user = await prisma.user.findUnique({ where: { calendarToken: token }, select: { companyId: true } });
  if (!user) {
    res.status(404).send("Ungültiger Kalender-Token.");
    return;
  }
  const ics = await calendarService.exportIcal(user.companyId);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="kalender.ics"');
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(ics);
}

// GET /api/calendar/token — return current user's calendarToken (generate if missing)
export async function getCalendarToken(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  let user = await prisma.user.findUnique({ where: { id: userId }, select: { calendarToken: true } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!user.calendarToken) {
    user = await prisma.user.update({ where: { id: userId }, data: { calendarToken: randomUUID() }, select: { calendarToken: true } });
  }
  res.json({ data: { calendarToken: user.calendarToken } });
}

// POST /api/calendar/token/regenerate — generate a new calendarToken for current user
export async function regenerateCalendarToken(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { calendarToken: randomUUID() },
    select: { calendarToken: true },
  });
  res.json({ data: { calendarToken: user.calendarToken } });
}
