import { z } from "zod";

export const createUnitSchema = z.object({
  number: z.string().min(1).max(50),
  floor: z.number().int(),
  area: z.number().positive(),
  rent: z.number().min(0),
  status: z.enum(["VERMIETET", "FREI", "WARTUNG"]).default("FREI"),
  tenantId: z.number().int().positive().nullable().optional(),
});

export const updateUnitSchema = createUnitSchema.partial();
