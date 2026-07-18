import type { Request, Response } from "express";
import {
  getDashboardStats,
  getRecentActivity,
  getDashboardLayout,
  saveDashboardLayout,
  getRevenueSeries,
  getExpiringCertificates,
} from "../services/dashboard.service.js";

export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await getDashboardStats(req.companyId!);
  res.json({ data: stats });
}

export async function getActivity(req: Request, res: Response): Promise<void> {
  const data = await getRecentActivity(req.companyId!);
  res.json({ data });
}

export async function getLayout(req: Request, res: Response): Promise<void> {
  const { id: userId, role } = req.user!;
  const data = await getDashboardLayout(req.companyId!, userId, role);
  res.json({ data });
}

export async function putLayout(req: Request, res: Response): Promise<void> {
  const { id: userId } = req.user!;
  const data = await saveDashboardLayout(req.companyId!, userId, req.body.widgets);
  res.json({ data });
}

export async function getRevenue(req: Request, res: Response): Promise<void> {
  const data = await getRevenueSeries(req.companyId!);
  res.json({ data });
}

export async function getCertificates(req: Request, res: Response): Promise<void> {
  const data = await getExpiringCertificates(req.companyId!);
  res.json({ data });
}
