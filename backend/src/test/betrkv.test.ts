import { describe, it, expect } from "vitest";
import { buildTenantCategoryLines, BETRKV_LABELS } from "../lib/betrkv.js";

describe("buildTenantCategoryLines", () => {
  it("category shares sum EXACTLY to the tenant's amount (no 1-cent drift)", () => {
    // Real-world case that previously produced 1077.44 as category sum vs
    // 1077.43 as the tenant's amount.
    const transactions = [
      { amount: -1200, betrkvCategory: "GRUNDSTEUER" },
      { amount: -850.5, betrkvCategory: "WASSERVERSORGUNG" },
      { amount: -640, betrkvCategory: "VERSICHERUNGEN" },
      { amount: -4200, betrkvCategory: "SONSTIGE_KOSTEN" },
      { amount: -480, betrkvCategory: "GARTENPFLEGE" },
    ];
    const lines = buildTenantCategoryLines(transactions, 1077.43, 0);

    const sum = Math.round(lines.reduce((s, l) => s + l.tenantShare, 0) * 100) / 100;
    expect(sum).toBe(1077.43);
    expect(lines).toHaveLength(5);
    expect(lines[0].propertyTotal).toBe(1200);
    expect(lines[0].label).toBe("Grundsteuer");
  });

  it("routes heating amounts to heating categories and the rest proportionally", () => {
    const transactions = [
      { amount: -1000, betrkvCategory: "HEIZUNG" },
      { amount: -500, betrkvCategory: "GRUNDSTEUER" },
    ];
    const lines = buildTenantCategoryLines(transactions, 800, 600);

    const heizung = lines.find((l) => l.category === "HEIZUNG");
    const grundsteuer = lines.find((l) => l.category === "GRUNDSTEUER");
    expect(heizung?.tenantShare).toBe(600);
    expect(heizung?.propertyTotal).toBe(1000);
    expect(grundsteuer?.tenantShare).toBe(200);
  });

  it("groups uncategorized transactions under 'Ohne Kategorie'", () => {
    const transactions = [
      { amount: -300, betrkvCategory: null },
      { amount: -100, betrkvCategory: "GRUNDSTEUER" },
    ];
    const lines = buildTenantCategoryLines(transactions, 200, 0);
    const uncategorized = lines.find((l) => l.category === "OHNE_KATEGORIE");
    expect(uncategorized).toBeDefined();
    expect(uncategorized?.tenantShare).toBe(150);
    expect(uncategorized?.label).toBe(BETRKV_LABELS.OHNE_KATEGORIE);
  });
});
