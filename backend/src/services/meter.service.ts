import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listMeters(companyId: number, propertyId?: number) {
  return prisma.meter.findMany({
    where: { companyId, ...(propertyId ? { propertyId } : {}) },
    include: {
      unit: { select: { id: true, number: true } },
      readings: { orderBy: { readAt: "desc" }, take: 2 },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMeter(companyId: number, data: {
  label: string; type: string; propertyId: number; unitId?: number;
}) {
  return prisma.meter.create({
    data: { ...data, type: data.type as never, companyId },
  });
}

export async function deleteMeter(companyId: number, id: number) {
  const meter = await prisma.meter.findFirst({ where: { id, companyId } });
  if (!meter) throw new AppError(404, "Zähler nicht gefunden");
  await prisma.meter.delete({ where: { id } });
}

export async function addReading(companyId: number, meterId: number, data: {
  value: number; readAt: string; note?: string;
}) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, companyId } });
  if (!meter) throw new AppError(404, "Zähler nicht gefunden");
  return prisma.meterReading.create({
    data: { ...data, readAt: new Date(data.readAt), meterId, companyId },
  });
}

export async function listReadings(companyId: number, meterId: number) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, companyId } });
  if (!meter) throw new AppError(404, "Zähler nicht gefunden");
  const readings = await prisma.meterReading.findMany({
    where: { meterId, companyId },
    orderBy: { readAt: "desc" },
  });
  return readings.map((r, i) => ({
    ...r,
    consumption: i < readings.length - 1 ? r.value - readings[i + 1].value : null,
  }));
}

export async function deleteReading(companyId: number, id: number) {
  const reading = await prisma.meterReading.findFirst({ where: { id, companyId } });
  if (!reading) throw new AppError(404, "Ablesung nicht gefunden");
  await prisma.meterReading.delete({ where: { id } });
}
