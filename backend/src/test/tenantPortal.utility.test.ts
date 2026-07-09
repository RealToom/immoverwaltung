import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTenantFindUnique, mockMeterFindMany, mockMeterFindFirst, mockMeterReadingCreate, mockContractFindFirst } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockMeterFindMany: vi.fn(),
  mockMeterFindFirst: vi.fn(),
  mockMeterReadingCreate: vi.fn(),
  mockContractFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenant: { findUnique: mockTenantFindUnique },
    meter: { findMany: mockMeterFindMany, findFirst: mockMeterFindFirst },
    meterReading: { create: mockMeterReadingCreate },
    contract: { findFirst: mockContractFindFirst },
  },
}));

import { getOwnMeters, addOwnMeterReading } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service utility/meters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getOwnMeters only queries meters attached to the tenant's own units", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ units: [{ id: 5 }, { id: 6 }] });
    mockMeterFindMany.mockResolvedValueOnce([]);

    await getOwnMeters(tenantUser);

    expect(mockMeterFindMany).toHaveBeenCalledWith({
      where: { companyId: 1, unitId: { in: [5, 6] } },
      include: { readings: { orderBy: { readAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
  });

  it("addOwnMeterReading rejects a meter that isn't on one of the tenant's own units", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ units: [{ id: 5 }] });
    mockMeterFindFirst.mockResolvedValueOnce(null); // meter 99 belongs to unit 7, filtered out by unitId: { in: [5] }

    await expect(
      addOwnMeterReading(tenantUser, 99, { value: 100, readAt: "2026-01-01T00:00:00.000Z" })
    ).rejects.toThrow("nicht gefunden");

    expect(mockMeterReadingCreate).not.toHaveBeenCalled();
  });
});
