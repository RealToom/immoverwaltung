import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { auditLogQuerySchema } from "../schemas/auditlog.schema.js";

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const { page, limit, action, from, to } = auditLogQuerySchema.parse(req.query);
  const skip = (page - 1) * limit;

  const where = {
    companyId: req.companyId!,
    ...(action ? { action } : {}),
    ...((from || to) ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      },
    } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { id: true, action: true, userId: true, ip: true, details: true, createdAt: true },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    data: logs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
