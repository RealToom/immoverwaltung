import { z } from "zod";

const roomSchema = z.object({
  name: z.string(),
  condition: z.enum(["GUT", "MAENGEL", "DEFEKT"]),
  notes: z.string().optional(),
});

const meterDataSchema = z.object({
  label: z.string(),
  value: z.number(),
  type: z.string(),
});

export const createHandoverSchema = z.object({
  type: z.enum(["EINZUG", "AUSZUG"]),
  date: z.string().datetime(),
  tenantName: z.string().min(1),
  notes: z.string().optional(),
  rooms: z.array(roomSchema).default([]),
  meterData: z.array(meterDataSchema).default([]),
  unitId: z.number().int(),
});
