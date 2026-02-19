import { z } from "zod";

export const createDocumentSchema = z.object({
  name: z.string().min(1).max(300),
  fileType: z.string().min(1).max(100),
  fileSize: z.string().max(50).default("0 KB"),
  filePath: z.string().max(1000).nullable().optional(),
});
