import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { maskIban, getAccessToken, resetTokenCacheForTesting } from "../services/nordigen.service.js";

describe("maskIban", () => {
  it("masks middle digits of a full IBAN", () => {
    expect(maskIban("DE89370400440532013000")).toBe("DE89****3000");
  });

  it("handles short strings gracefully", () => {
    expect(maskIban("DE12")).toBe("****");
  });

  it("preserves first 4 and last 4 chars", () => {
    const result = maskIban("GB29NWBK60161331926819");
    expect(result.startsWith("GB29")).toBe(true);
    expect(result.endsWith("6819")).toBe(true);
    expect(result).toContain("****");
  });
});

describe("getAccessToken cache", () => {
  beforeEach(() => {
    resetTokenCacheForTesting();
    // Provide required env vars so the function doesn't throw before fetching
    process.env.NORDIGEN_SECRET_ID = "test-id";
    process.env.NORDIGEN_SECRET_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetTokenCacheForTesting();
  });

  it("calls fetch only once when token is still valid", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access: "tok-abc", access_expires: 86400 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getAccessToken();
    await getAccessToken();

    // fetch should have been called only ONCE (second call uses cache)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("calls fetch again when token is expired", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access: "tok-xyz", access_expires: 0 }), // expires immediately (0 - 300 = -300s → already stale)
    });
    vi.stubGlobal("fetch", mockFetch);

    await getAccessToken();
    await getAccessToken();

    // Both calls should hit fetch because access_expires=0 makes cache immediately stale
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
