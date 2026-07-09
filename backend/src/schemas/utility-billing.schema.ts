import { z } from "zod";
import { DISPUTE_STATUSES } from "../services/billing-dispute.service.js";

export const generateStatementSchema = z.object({
  propertyId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
});

export const listDisputesQuerySchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
});

export const updateDisputeStatusSchema = z.object({
  status: z.enum(DISPUTE_STATUSES),
});
