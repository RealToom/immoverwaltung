import { describe, it, expect } from "vitest";
import { filterAiSuggestions } from "../services/imap-sync.js";

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

  it("sentinel -1 never matches a real ID", () => {
    const result = filterAiSuggestions(
      { suggestedTenantId: null, suggestedPropertyId: null },
      new Set([-1]),  // even if -1 is somehow in set, null input stays null
      propertyIds
    );
    expect(result.suggestedTenantId).toBeNull();
  });
});
