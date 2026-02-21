import { z } from "zod";

export const createRecurringSchema = z.object({
  description: z.string().min(1),
  type: z.enum(["EINNAHME", "AUSGABE"]),
  amount: z.number().positive().multipleOf(0.01),
  category: z.string().default(""),
  allocatable: z.boolean().default(false),
  interval: z.enum(["MONATLICH", "VIERTELJAEHRLICH", "HALBJAEHRLICH", "JAEHRLICH"]),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  propertyId: z.number().int().optional(),
});

export const updateRecurringSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().multipleOf(0.01).optional(),
  isActive: z.boolean().optional(),
  endDate: z.string().datetime().optional(),
});
