import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mockFetch so vi.mock factories can reference it
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.stubGlobal("fetch", mockFetch);

vi.mock("../config/env.js", () => ({
  env: {
    YOUSIGN_API_KEY: "test-api-key",
    YOUSIGN_BASE_URL: "https://api-sandbox.yousign.app/v3",
  },
}));

import {
  uploadDocument,
  createSignatureRequest,
  activateRequest,
  getSignedDocument,
} from "../services/yousign.service.js";

describe("yousign.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("uploadDocument", () => {
    it("returns document id on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "doc_123" }),
      });
      const result = await uploadDocument(Buffer.from("pdf content"), "test.pdf");
      expect(result).toBe("doc_123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api-sandbox.yousign.app/v3/documents",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws AppError(502) when Yousign returns non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, text: async () => "Bad Request" });
      await expect(uploadDocument(Buffer.from("pdf"), "test.pdf")).rejects.toMatchObject({
        statusCode: 502,
      });
    });
  });

  describe("createSignatureRequest", () => {
    it("returns signature request id on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "req_456" }),
      });
      const signer = { email: "mieter@example.com", firstName: "Max", lastName: "Müller" };
      const result = await createSignatureRequest("doc_123", signer, 42);
      expect(result).toBe("req_456");
    });
  });

  describe("activateRequest", () => {
    it("resolves without error on success", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await expect(activateRequest("req_456")).resolves.toBeUndefined();
    });
  });

  describe("getSignedDocument", () => {
    it("returns PDF buffer on success", async () => {
      const fakeBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBytes.buffer,
      });
      const buf = await getSignedDocument("req_456", "doc_789");
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf[0]).toBe(0x25); // '%' — confirms it's the PDF magic bytes
    });
  });
});
