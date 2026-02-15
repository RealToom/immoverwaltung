import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const propertyQuerySchema = paginationSchema.extend({
  status: z.enum(["AKTIV", "WARTUNG"]).optional(),
});

export const createPropertySchema = z.object({
  name: z.string().min(1).max(300),
  address: z.string().min(1).max(500),
  status: z.enum(["AKTIV", "WARTUNG"]).default("AKTIV"),
});

export const updatePropertySchema = createPropertySchema.partial();
