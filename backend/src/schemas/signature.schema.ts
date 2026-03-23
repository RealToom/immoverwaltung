import { z } from "zod";

export const sendForSignatureSchema = z.object({
  templateId: z.number().int().positive(),
  signerEmail: z.string().email().optional(),
  signerName: z.string().min(1).optional(),
});
