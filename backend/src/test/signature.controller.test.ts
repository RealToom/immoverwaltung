import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { contract: { findFirst: mockFindFirst, update: mockUpdate } },
}));

// Mock Yousign service — should NOT be called when guard fires
vi.mock("../services/yousign.service.js", () => ({
  uploadDocument: vi.fn(),
  createSignatureRequest: vi.fn(),
  activateRequest: vi.fn(),
  getSignedDocument: vi.fn(),
}));

// Mock document-template service
vi.mock("../services/document-template.service.js", () => ({
  renderTemplate: vi.fn(),
}));

import { sendForSignature } from "../controllers/signature.controller.js";
import { uploadDocument } from "../services/yousign.service.js";

function makeReq(body: object, params = { id: "1" }): Partial<Request> {
  return { body, params, companyId: 1 } as unknown as Partial<Request>;
}

function makeRes() {
  return {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
}

describe("sendForSignature controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 409 when contract.signatureStatus is AUSSTEHEND", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      companyId: 1,
      signatureStatus: "AUSSTEHEND",
      tenant: { email: "mieter@test.de", firstName: "Max", lastName: "Müller" },
    });

    const req = makeReq({ templateId: 1 });
    const res = makeRes();

    await expect(
      sendForSignature(req as Request, res as unknown as Response),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(uploadDocument).not.toHaveBeenCalled();
  });
});
