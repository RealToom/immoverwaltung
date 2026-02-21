import { z } from "zod";

export const createMeterSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["STROM", "WASSER", "GAS", "WAERME", "SONSTIGES"]),
  unitId: z.number().int().optional(),
  propertyId: z.number().int(),
});

export const updateMeterSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(["STROM", "WASSER", "GAS", "WAERME", "SONSTIGES"]).optional(),
});

export const createMeterReadingSchema = z.object({
  value: z.number(),
  readAt: z.string().datetime(),
  note: z.string().optional(),
});
