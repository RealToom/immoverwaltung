import { z } from "zod";

const VALID_ROLES = ["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"] as const;
const allowedRolesField = z
  .array(z.enum(VALID_ROLES))
  .min(1)
  .default(["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"]);

export const createEmailAccountSchema = z.object({
  label: z.string().min(1).max(100),
  email: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapTls: z.boolean().default(true),
  imapUser: z.string().min(1),
  password: z.string().min(1),   // plain-text, wird vor Speichern verschlüsselt
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpTls: z.boolean().default(true),
  skipConnectionTest: z.boolean().default(false),
  allowedRoles: allowedRolesField,
});

export const updateEmailAccountSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(1).optional(),
  allowedRoles: allowedRolesField.optional(),
});
