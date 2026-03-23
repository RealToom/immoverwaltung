import { z } from "zod";

export const energyPassportSchema = z.object({
  certificateType: z.enum(["VERBRAUCH", "BEDARF"]),
  energyClass: z.enum(["A+", "A", "B", "C", "D", "E", "F", "G", "H"]),
  primaryEnergyDemand: z.number().positive().optional(),
  finalEnergyDemand: z.number().positive().optional(),
  energyCarrier: z.string().min(1).max(100).optional(),
  issuedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  certificateNumber: z.string().min(1).max(100).optional(),
});

export const consumptionQuerySchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const propertyIdParamSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
});
