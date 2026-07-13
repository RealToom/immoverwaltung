import { z } from "zod";
import { DISPUTE_STATUSES } from "../services/billing-dispute.service.js";

export const generateStatementSchema = z.object({
  propertyId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
});

export const listDisputesQuerySchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
});

export const listStatementsQuerySchema = z.object({
  propertyId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const updateDisputeStatusSchema = z.object({
  status: z.enum(DISPUTE_STATUSES),
});

export const distributionKeysSchema = z.object({
  costConfiguration: z.record(z.string(), z.enum(["WOHNFLAECHE", "PERSONEN", "WOHNEINHEIT"])),
});

export const prepaymentAdjustmentSchema = z.object({
  utilityPrepayment: z.number().min(0).max(100000),
});

export const settlementStatusSchema = z.object({
  settlementStatus: z.enum(["OFFEN", "BEZAHLT", "VERRECHNET"]),
});
