import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const emailMessageQuerySchema = paginationSchema.extend({
  accountId: z.coerce.number().int().positive().optional(),
  isRead: z.enum(["true", "false"]).optional(),
  isInquiry: z.enum(["true", "false"]).optional(),
  inquiryStatus: z.enum(["NEU", "IN_BEARBEITUNG", "AKZEPTIERT", "ABGELEHNT"]).optional(),
});

export const updateEmailMessageSchema = z.object({
  isRead: z.boolean().optional(),
  isInquiry: z.boolean().optional(),
  inquiryStatus: z.enum(["NEU", "IN_BEARBEITUNG", "AKZEPTIERT", "ABGELEHNT"]).optional(),
});

export const replyEmailSchema = z.object({
  body: z.string().min(1).max(50000),
});

export const sendDocumentSchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().max(5000).default("Im Anhang finden Sie das angeforderte Dokument."),
});

export const createEventFromEmailSchema = z.object({
  title: z.string().min(1).max(200),
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
  allDay: z.boolean().default(false),
});
