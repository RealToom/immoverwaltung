import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

const INSURANCE_TYPES = ["GEBAEUDE", "HAFTPFLICHT", "ELEMENTAR", "RECHTSSCHUTZ", "SONSTIGES"] as const;
const INSURANCE_STATUSES = ["AKTIV", "ABGELAUFEN", "GEKUENDIGT"] as const;

export const insuranceQuerySchema = paginationSchema.extend({
  propertyId: z.coerce.number().int().positive().optional(),
  type: z.enum(INSURANCE_TYPES).optional(),
  status: z.enum(INSURANCE_STATUSES).optional(),
});

export const createInsuranceSchema = z.object({
  name: z.string().min(1).max(200),
  insurer: z.string().min(1).max(200),
  policyNumber: z.string().max(100).nullable().optional(),
  type: z.enum(INSURANCE_TYPES),
  status: z.enum(INSURANCE_STATUSES).optional(),
  premium: z.number().positive(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  propertyId: z.number().int().positive().nullable().optional(),
});

export const updateInsuranceSchema = createInsuranceSchema.partial();
