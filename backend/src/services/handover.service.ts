import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { Prisma } from "@prisma/client";

export async function listHandovers(companyId: number, unitId?: number) {
  return prisma.handoverProtocol.findMany({
    where: { companyId, ...(unitId ? { unitId } : {}) },
    include: { unit: { select: { id: true, number: true } } },
    orderBy: { date: "desc" },
  });
}

export async function createHandover(companyId: number, data: {
  type: string; date: string; tenantName: string; notes?: string;
  rooms: object[]; meterData: object[]; unitId: number;
}) {
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId, property: { companyId } },
  });
  if (!unit) throw new AppError(404, "Einheit nicht gefunden");

  return prisma.handoverProtocol.create({
    data: {
      ...data,
      type: data.type as never,
      date: new Date(data.date),
      rooms: data.rooms as Prisma.InputJsonValue,
      meterData: data.meterData as Prisma.InputJsonValue,
      companyId,
    },
  });
}

export async function getHandover(companyId: number, id: number) {
  const h = await prisma.handoverProtocol.findFirst({ where: { id, companyId } });
  if (!h) throw new AppError(404, "Protokoll nicht gefunden");
  return h;
}

export async function deleteHandover(companyId: number, id: number) {
  const h = await prisma.handoverProtocol.findFirst({ where: { id, companyId } });
  if (!h) throw new AppError(404, "Protokoll nicht gefunden");
  await prisma.handoverProtocol.delete({ where: { id } });
}
