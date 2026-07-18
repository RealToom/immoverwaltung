import { z } from "zod";
import { WIDGET_KEYS } from "../lib/dashboardWidgets.js";

const layoutItemSchema = z.object({
  key: z.string().refine((k) => WIDGET_KEYS.has(k), { message: "Unbekannter Widget-Key" }),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(999),
  w: z.number().int().min(1).max(4),
  h: z.number().int().min(1).max(12),
});

export const dashboardLayoutSchema = z.object({
  widgets: z.array(layoutItemSchema).max(40),
});
