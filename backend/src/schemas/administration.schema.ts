import { z } from "zod";

export const putSmtpSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(1).max(255),
  password: z.string().min(1).max(500).optional(),
  fromAddress: z.string().email().max(300),
  fromName: z.string().min(1).max(200),
});

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  pages: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  pages: z.array(z.string()).optional(),
});

export const setUserCustomRoleSchema = z.object({
  customRoleId: z.number().int().positive().nullable(),
});
