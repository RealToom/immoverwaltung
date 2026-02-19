import type { Request, Response } from "express";
import { getDashboardStats, getRecentActivity } from "../services/dashboard.service.js";

export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await getDashboardStats(req.companyId!);
  res.json({ data: stats });
}

export async function getActivity(req: Request, res: Response): Promise<void> {
  const data = await getRecentActivity(req.companyId!);
  res.json({ data });
}
