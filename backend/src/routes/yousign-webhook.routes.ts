import type { Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

function validateHmac(body: Buffer, header: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.YOUSIGN_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  try {
    // timingSafeEqual throws RangeError when buffer lengths differ (e.g. truncated/malformed
    // signatures). The catch intentionally returns false in that case.
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

function parseContractId(obj: { external_id?: string }): number | null {
  if (!obj.external_id) return null;
  const id = parseInt(obj.external_id, 10);
  return isNaN(id) ? null : id;
}

export async function yousignWebhookHandler(req: Request, res: Response): Promise<void> {
  // Note: Verify exact header name against Yousign sandbox during first integration test.
  // Yousign may send "X-Yousign-Signature" or "X-Yousign-Signature-256".
  const sig = req.headers["x-yousign-signature-256"] as string | undefined;

  if (!sig || !validateHmac(req.body as Buffer, sig)) {
    logger.warn("Yousign webhook: invalid signature");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    const event = JSON.parse((req.body as Buffer).toString()) as {
      type: string;
      data: { object: Record<string, unknown> };
    };

    if (event.type === "signature_request.done") {
      const obj = event.data.object as {
        external_id?: string;
        documents?: Array<{ id: string; signed_file_url?: string }>;
      };
      const contractId = parseContractId(obj);
      if (contractId) {
        const doc = obj.documents?.[0];
        // No companyId filter needed: webhook is HMAC-authenticated, contractId set by our
        // own code, and contract IDs are globally unique. signatureRequestId guard ensures
        // we only update contracts that actually initiated a signature request.
        await prisma.contract.updateMany({
          where: { id: contractId, signatureRequestId: { not: null } },
          data: {
            signatureStatus: "ABGESCHLOSSEN",
            signedDocumentId: doc?.id ?? null,
            signedDocumentUrl: doc?.signed_file_url ?? null,
          },
        });
        // Only activate contracts still in ENTWURF — a late or replayed "done" event must
        // not reactivate a contract that was meanwhile terminated (GEKUENDIGT).
        await prisma.contract.updateMany({
          where: { id: contractId, signatureRequestId: { not: null }, status: "ENTWURF" },
          data: { status: "AKTIV" },
        });
      }
    } else if (event.type === "signature_request.declined") {
      const obj = event.data.object as { external_id?: string };
      const contractId = parseContractId(obj);
      if (contractId) {
        await prisma.contract.updateMany({
          where: { id: contractId, signatureRequestId: { not: null } },
          data: { signatureStatus: "ABGELEHNT" },
        });
      }
    } else if (event.type === "signature_request.expired") {
      const obj = event.data.object as { external_id?: string };
      const contractId = parseContractId(obj);
      if (contractId) {
        await prisma.contract.updateMany({
          where: { id: contractId, signatureRequestId: { not: null } },
          data: { signatureStatus: "ABGELAUFEN" },
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Yousign webhook: processing error");
    res.sendStatus(500);
    return;
  }

  res.sendStatus(200);
}
