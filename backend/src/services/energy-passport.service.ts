import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function getPassport(companyId: number, propertyId: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  return prisma.energyPassport.findUnique({ where: { propertyId } });
}

export async function upsertPassport(
  companyId: number,
  propertyId: number,
  data: {
    certificateType: "VERBRAUCH" | "BEDARF";
    energyClass: string;
    primaryEnergyDemand?: number;
    finalEnergyDemand?: number;
    energyCarrier?: string;
    issuedAt: string;
    validUntil: string;
    certificateNumber?: string;
  },
) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new AppError(404, "Immobilie nicht gefunden");

  return prisma.energyPassport.upsert({
    where: { propertyId },
    create: {
      ...data,
      issuedAt: new Date(data.issuedAt),
      validUntil: new Date(data.validUntil),
      propertyId,
      companyId,
    },
    update: {
      ...data,
      issuedAt: new Date(data.issuedAt),
      validUntil: new Date(data.validUntil),
    },
  });
}
