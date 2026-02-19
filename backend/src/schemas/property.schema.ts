import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const propertyQuerySchema = paginationSchema.extend({
  status: z.enum(["AKTIV", "WARTUNG"]).optional(),
});

export const createPropertySchema = z.object({
  name: z.string().min(1).max(300),
  street: z.string().min(1).max(300),
  zip: z.string().min(1).max(10),
  city: z.string().min(1).max(200),
  status: z.enum(["AKTIV", "WARTUNG"]).default("AKTIV"),
  purchasePrice: z.number().positive().optional(),
  equity: z.number().positive().optional(),
});

export const updatePropertySchema = z.object({
  name: z.string().min(1).max(300).optional(),
  street: z.string().min(1).max(300).optional(),
  zip: z.string().min(1).max(10).optional(),
  city: z.string().min(1).max(200).optional(),
  status: z.enum(["AKTIV", "WARTUNG"]).optional(),
  purchasePrice: z.number().positive().nullable().optional(),
  equity: z.number().positive().nullable().optional(),
});
