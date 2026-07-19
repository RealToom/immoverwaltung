import { describe, it, expect } from "vitest";
import { WIDGET_REGISTRY, DEFAULT_LAYOUT, normalizeLayout, getVisibleWidgets } from "./registry";

describe("widget registry", () => {
  it("every registry key matches its definition key and has a component", () => {
    for (const [key, def] of Object.entries(WIDGET_REGISTRY)) {
      expect(def.key).toBe(key);
      expect(def.component).toBeTypeOf("function");
    }
  });

  it("default layout keys all exist in the registry", () => {
    for (const item of DEFAULT_LAYOUT) {
      expect(WIDGET_REGISTRY[item.key]).toBeDefined();
    }
  });

  it("normalizeLayout drops unknown and role-forbidden keys", () => {
    const input = [
      { key: "kpi-properties", x: 0, y: 0, w: 1, h: 1 },
      { key: "roi", x: 1, y: 0, w: 1, h: 1 },
      { key: "ghost", x: 2, y: 0, w: 1, h: 1 },
    ];
    expect(normalizeLayout(input, "READONLY").map((i) => i.key)).toEqual(["kpi-properties"]);
    expect(normalizeLayout(input, "ADMIN").map((i) => i.key)).toEqual(["kpi-properties", "roi"]);
  });

  it("READONLY does not see finance widgets in the library", () => {
    const keys = getVisibleWidgets("READONLY").map((d) => d.key);
    expect(keys).not.toContain("roi");
    expect(keys).toContain("expiring-contracts");
  });
});
