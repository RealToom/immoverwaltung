import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const TRACKED_TYPES = ["STROM", "GAS", "WASSER", "WAERME"] as const;

function emptyConsumption(): Record<string, number[]> {
  return Object.fromEntries(TRACKED_TYPES.map((t) => [t, Array(12).fill(0)]));
}

export async function getConsumption(companyId: number, propertyId: number, year: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const meters = await prisma.meter.findMany({
    where: { propertyId, companyId, unitId: { not: null } },
    include: {
      unit: { select: { id: true, number: true } },
      readings: {
        where: { readAt: { gte: yearStart, lt: yearEnd } },
        orderBy: { readAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const unitMap = new Map<number, { unitNumber: string; consumption: Record<string, number[]> }>();

  for (const meter of meters) {
    if (!meter.unitId || !meter.unit) continue;
    if (!(TRACKED_TYPES as readonly string[]).includes(meter.type)) continue;

    const prevReading = await prisma.meterReading.findFirst({
      where: { meterId: meter.id, companyId, readAt: { lt: yearStart } },
      orderBy: { readAt: "desc" },
    });

    const allReadings = prevReading
      ? [prevReading, ...meter.readings]
      : meter.readings;

    if (!unitMap.has(meter.unitId)) {
      unitMap.set(meter.unitId, {
        unitNumber: meter.unit.number,
        consumption: emptyConsumption(),
      });
    }

    const unitData = unitMap.get(meter.unitId)!;

    for (let i = 1; i < allReadings.length; i++) {
      const newer = allReadings[i];
      const older = allReadings[i - 1];
      const delta = Math.max(0, newer.value - older.value);
      const month = new Date(newer.readAt).getMonth(); // 0-indexed
      unitData.consumption[meter.type][month] += delta;
    }
  }

  const units = Array.from(unitMap.entries()).map(([unitId, data]) => ({
    unitId,
    unitNumber: data.unitNumber,
    consumption: data.consumption,
  }));

  return { year, units };
}
