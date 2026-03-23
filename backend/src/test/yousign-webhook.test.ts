import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import crypto from "crypto";

const { mockUpdateMany } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { contract: { updateMany: mockUpdateMany } },
}));

vi.mock("../config/env.js", () => ({
  env: { YOUSIGN_WEBHOOK_SECRET: "test-webhook-secret" },
}));

import { yousignWebhookHandler } from "../routes/yousign-webhook.routes.js";

function makeHmacHeader(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
}

function makeReq(body: object, sig?: string): Partial<Request> {
  const bodyStr = JSON.stringify(body);
  const signature = sig ?? makeHmacHeader(bodyStr, "test-webhook-secret");
  return {
    body: Buffer.from(bodyStr),
    headers: { "x-yousign-signature-256": signature },
  } as Partial<Request>;
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
}

describe("yousignWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 on invalid HMAC signature", async () => {
    const req = makeReq(
      { type: "signature_request.done", data: { object: {} } },
      "bad-signature",
    );
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("sets signatureStatus=ABGESCHLOSSEN, status=AKTIV, saves document ids on signature_request.done", async () => {
    mockUpdateMany.mockResolvedValueOnce({});
    const event = {
      type: "signature_request.done",
      data: {
        object: {
          id: "req_123",
          external_id: "42",
          documents: [{ id: "doc_456", signed_file_url: "https://example.com/signed.pdf" }],
        },
      },
    };
    const req = makeReq(event);
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({
        signatureStatus: "ABGESCHLOSSEN",
        status: "AKTIV",
        signedDocumentId: "doc_456",
        signedDocumentUrl: "https://example.com/signed.pdf",
      }),
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("sets signatureStatus=ABGELEHNT on signature_request.declined", async () => {
    mockUpdateMany.mockResolvedValueOnce({});
    const event = {
      type: "signature_request.declined",
      data: { object: { external_id: "10" } },
    };
    const req = makeReq(event);
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { signatureStatus: "ABGELEHNT" },
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("sets signatureStatus=ABGELAUFEN on signature_request.expired", async () => {
    mockUpdateMany.mockResolvedValueOnce({});
    const event = {
      type: "signature_request.expired",
      data: { object: { external_id: "7" } },
    };
    const req = makeReq(event);
    const res = makeRes();
    await yousignWebhookHandler(req as Request, res as unknown as Response);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { signatureStatus: "ABGELAUFEN" },
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});
