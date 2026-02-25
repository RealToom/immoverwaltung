import { describe, it, expect } from "vitest";
import {
  formatDatevDate,
  formatDecimalGerman,
  buildBelegfeld1,
} from "../services/datev.service.js";

describe("formatDatevDate", () => {
  it("returns DDMM format", () => {
    expect(formatDatevDate(new Date("2026-03-15T12:00:00Z"))).toBe("1503");
  });

  it("pads single digits", () => {
    expect(formatDatevDate(new Date("2026-01-05T12:00:00Z"))).toBe("0501");
  });
});

describe("formatDecimalGerman", () => {
  it("uses comma separator", () => {
    expect(formatDecimalGerman(1234.56)).toBe("1234,56");
  });

  it("uses absolute value for negative amounts", () => {
    expect(formatDecimalGerman(-500)).toBe("500,00");
  });
});

describe("buildBelegfeld1", () => {
  it("pads to TX + 9 digits", () => {
    expect(buildBelegfeld1(42)).toBe("TX000000042");
  });

  it("result is max 12 chars", () => {
    expect(buildBelegfeld1(123456789012).length).toBeLessThanOrEqual(12);
  });
});
