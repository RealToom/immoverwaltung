import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { dashboardLayout: { findUnique: mockFindUnique, upsert: mockUpsert } },
}));

import { getDashboardLayout, saveDashboardLayout } from "../services/dashboard.service.js";
import { DEFAULT_LAYOUT } from "../lib/dashboardWidgets.js";

describe("dashboard layout service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns role-filtered default layout when no row exists", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const out = await getDashboardLayout(1, 7, "READONLY");
    expect(out.some((i) => i.key === "kpi-revenue")).toBe(false); // BUCHHALTER-only
    expect(out.some((i) => i.key === "kpi-properties")).toBe(true);
  });

  it("returns empty layout when stored layout is empty (does not fall back to default)", async () => {
    mockFindUnique.mockResolvedValueOnce({ widgets: [] });
    const out = await getDashboardLayout(1, 7, "READONLY");
    expect(out).toEqual([]);
  });

  it("returns stored layout filtered by role", async () => {
    mockFindUnique.mockResolvedValueOnce({
      widgets: [{ key: "roi", x: 0, y: 0, w: 1, h: 1 }, { key: "kpi-tenants", x: 1, y: 0, w: 1, h: 1 }],
    });
    const out = await getDashboardLayout(1, 7, "READONLY");
    expect(out.map((i) => i.key)).toEqual(["kpi-tenants"]);
  });

  it("upserts on save and returns stored widgets", async () => {
    const widgets = [{ key: "kpi-units", x: 0, y: 0, w: 1, h: 1 }];
    mockUpsert.mockResolvedValueOnce({ widgets });
    const out = await saveDashboardLayout(1, 7, widgets);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 7 },
      create: { userId: 7, companyId: 1, widgets },
      update: { widgets },
    });
    expect(out).toEqual(widgets);
  });
});
