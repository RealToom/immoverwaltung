import { describe, it, expect } from "vitest";
import { filterAiSuggestions } from "../services/imap-sync.service.js";

describe("filterAiSuggestions", () => {
  const tenantIds = new Set([1, 2, 3]);
  const propertyIds = new Set([10, 20]);

  it("passes through valid IDs", () => {
    const result = filterAiSuggestions(
      { suggestedTenantId: 1, suggestedPropertyId: 10 },
      tenantIds,
      propertyIds
    );
    expect(result).toEqual({ suggestedTenantId: 1, suggestedPropertyId: 10 });
  });

  it("nullifies invalid tenant ID (prompt injection guard)", () => {
    const result = filterAiSuggestions(
      { suggestedTenantId: 999, suggestedPropertyId: 10 },
      tenantIds,
      propertyIds
    );
    expect(result.suggestedTenantId).toBeNull();
    expect(result.suggestedPropertyId).toBe(10);
  });

  it("nullifies invalid property ID", () => {
    const result = filterAiSuggestions(
      { suggestedTenantId: 2, suggestedPropertyId: 999 },
      tenantIds,
      propertyIds
    );
    expect(result.suggestedTenantId).toBe(2);
    expect(result.suggestedPropertyId).toBeNull();
  });

  it("handles null inputs", () => {
    const result = filterAiSuggestions(
      { suggestedTenantId: null, suggestedPropertyId: null },
      tenantIds,
      propertyIds
    );
    expect(result).toEqual({ suggestedTenantId: null, suggestedPropertyId: null });
  });

  it("null input stays null even when set contains valid IDs", () => {
    // Ensures AI returning null is treated as null (not coerced to a match)
    const result = filterAiSuggestions(
      { suggestedTenantId: null, suggestedPropertyId: null },
      new Set([1, 2, 3]),
      new Set([10, 20])
    );
    expect(result.suggestedTenantId).toBeNull();
    expect(result.suggestedPropertyId).toBeNull();
  });

  it("nullifies both when both IDs are invalid (prompt injection attempt)", () => {
    const result = filterAiSuggestions(
      { suggestedTenantId: 999, suggestedPropertyId: 888 },
      tenantIds,
      propertyIds
    );
    expect(result.suggestedTenantId).toBeNull();
    expect(result.suggestedPropertyId).toBeNull();
  });
});
