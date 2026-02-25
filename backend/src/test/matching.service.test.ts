import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { amountsMatch, scoreMatch } from "../services/matching.service.js";

describe("amountsMatch", () => {
  it("exact match returns true", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.00"), 1200)).toBe(true);
  });

  it("1 cent within tolerance", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.01"), 1200)).toBe(true);
  });

  it("2 cents exceeds tolerance", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.02"), 1200)).toBe(false);
  });

  it("float imprecision handled", () => {
    expect(amountsMatch(new Prisma.Decimal("1200.00"), 1200.0000001)).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("full name match scores 2", () => {
    expect(scoreMatch("Miete Januar Max Mustermann WE01", "Max Mustermann")).toBe(2);
  });

  it("single-word name match scores 2", () => {
    expect(scoreMatch("Miete Mustermann WE01", "Mustermann")).toBe(2);
  });

  it("no name scores 0", () => {
    expect(scoreMatch("Miete Januar", "Max Mustermann")).toBe(0);
  });

  it("case insensitive", () => {
    expect(scoreMatch("MIETE JAN MAX MUSTERMANN", "max mustermann")).toBe(2);
  });

  it("only first name scores 0 (all parts required)", () => {
    expect(scoreMatch("Miete Max", "Max Mustermann")).toBe(0);
  });
});
