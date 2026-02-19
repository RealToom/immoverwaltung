import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const tenantQuerySchema = paginationSchema.extend({
  propertyId: z.coerce.number().int().positive().optional(),
});

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).default(""),
  moveIn: z.coerce.date(),
  unitId: z.number().int().positive().optional(),
});

export const updateTenantSchema = createTenantSchema.partial();
