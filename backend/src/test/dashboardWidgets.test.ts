import { describe, it, expect } from "vitest";
import { canSeeWidget, filterLayoutForRole, DEFAULT_LAYOUT } from "../lib/dashboardWidgets.js";

describe("dashboardWidgets role filtering", () => {
  it("hides BUCHHALTER-only widgets from READONLY", () => {
    expect(canSeeWidget("READONLY", "roi")).toBe(false);
    expect(canSeeWidget("READONLY", "kpi-properties")).toBe(true);
    expect(canSeeWidget("BUCHHALTER", "roi")).toBe(true);
    expect(canSeeWidget("ADMIN", "quick-actions")).toBe(true);
  });

  it("filterLayoutForRole drops unknown keys and forbidden widgets", () => {
    const input = [
      { key: "kpi-properties", x: 0, y: 0, w: 1, h: 1 },
      { key: "roi", x: 1, y: 0, w: 1, h: 1 },
      { key: "does-not-exist", x: 2, y: 0, w: 1, h: 1 },
    ];
    const out = filterLayoutForRole(input, "READONLY");
    expect(out.map((i) => i.key)).toEqual(["kpi-properties"]);
  });

  it("default layout contains only known keys", () => {
    const out = filterLayoutForRole(DEFAULT_LAYOUT, "ADMIN");
    expect(out).toHaveLength(DEFAULT_LAYOUT.length);
  });
});
