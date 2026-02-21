import { z } from "zod";

export const dunningQuerySchema = z.object({
  contractId: z.coerce.number().int().optional(),
});
