import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPropertyFindFirst, mockMeterFindMany, mockReadingFindFirst } = vi.hoisted(() => ({
  mockPropertyFindFirst: vi.fn(),
  mockMeterFindMany: vi.fn(),
  mockReadingFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    property: { findFirst: mockPropertyFindFirst },
    meter: { findMany: mockMeterFindMany },
    meterReading: { findFirst: mockReadingFindFirst },
  },
}));

import { getConsumption } from "../services/energy-consumption.service.js";

describe("energy-consumption.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates Feb and Mar deltas correctly using prev reading for Feb", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
    mockMeterFindMany.mockResolvedValueOnce([
      {
        id: 1,
        type: "STROM",
        unitId: 5,
        unit: { id: 5, number: "EG links" },
        readings: [
          { value: 1100, readAt: new Date("2026-02-15") },
          { value: 1250, readAt: new Date("2026-03-10") },
        ],
      },
    ]);
    // prevReading (before year start)
    mockReadingFindFirst.mockResolvedValueOnce({ value: 1000, readAt: new Date("2025-12-31") });

    const result = await getConsumption(1, 1, 2026);

    expect(result.units).toHaveLength(1);
    expect(result.units[0].unitId).toBe(5);
    expect(result.units[0].unitNumber).toBe("EG links");
    expect(result.units[0].consumption.STROM[1]).toBe(100); // Feb: 1100 - 1000
    expect(result.units[0].consumption.STROM[2]).toBe(150); // Mar: 1250 - 1100
    expect(result.units[0].consumption.STROM[0]).toBe(0);   // Jan: no reading
  });

  it("clamps negative delta (meter replacement) to 0", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1 });
    mockMeterFindMany.mockResolvedValueOnce([
      {
        id: 2, type: "STROM", unitId: 5, unit: { id: 5, number: "OG" },
        readings: [{ value: 50, readAt: new Date("2026-02-01") }],
      },
    ]);
    mockReadingFindFirst.mockResolvedValueOnce({ value: 9999, readAt: new Date("2025-12-01") });

    const result = await getConsumption(1, 1, 2026);
    expect(result.units[0].consumption.STROM[1]).toBe(0); // clamped
  });

  it("excludes property-wide meters (no unitId)", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1 });
    mockMeterFindMany.mockResolvedValueOnce([]); // Prisma filter { unitId: { not: null } }

    const result = await getConsumption(1, 1, 2026);
    expect(result.units).toHaveLength(0);
  });

  it("throws 404 when property not found for companyId", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce(null);
    await expect(getConsumption(1, 99, 2026)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("attributes delta spanning two months to the newer reading's month", async () => {
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1 });
    mockMeterFindMany.mockResolvedValueOnce([
      {
        id: 3, type: "GAS", unitId: 7, unit: { id: 7, number: "EG rechts" },
        readings: [{ value: 500, readAt: new Date("2026-03-01") }], // no Feb reading
      },
    ]);
    mockReadingFindFirst.mockResolvedValueOnce({ value: 400, readAt: new Date("2026-01-15") });

    const result = await getConsumption(1, 1, 2026);
    expect(result.units[0].consumption.GAS[2]).toBe(100); // Mar gets delta
    expect(result.units[0].consumption.GAS[1]).toBe(0);   // Feb = 0
  });
});
