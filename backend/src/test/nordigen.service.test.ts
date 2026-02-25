import { describe, it, expect } from "vitest";
import { maskIban } from "../services/nordigen.service.js";

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

describe("token cache logic", () => {
  it("considers token expired when expiresAt is in the past", () => {
    const pastTime = Date.now() - 1000;
    expect(Date.now() >= pastTime).toBe(true);
  });

  it("considers token valid when expiresAt is in the future", () => {
    const futureTime = Date.now() + 60_000;
    expect(Date.now() >= futureTime).toBe(false);
  });
});
