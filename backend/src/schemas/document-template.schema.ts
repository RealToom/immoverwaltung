import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  category: z.string().default(""),
  content: z.string().min(1),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  content: z.string().min(1).optional(),
});

export const renderTemplateSchema = z.object({
  variables: z.record(z.string(), z.unknown()).default({}),
});
