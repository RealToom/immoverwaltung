import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockContractFindFirst, mockContractFindMany, mockTransactionFindMany, mockTransactionFindFirst } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockTransactionFindMany: vi.fn(),
  mockTransactionFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contract: { findFirst: mockContractFindFirst, findMany: mockContractFindMany },
    transaction: { findMany: mockTransactionFindMany, findFirst: mockTransactionFindFirst },
  },
}));

import { getReceipts, downloadReceipt } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 } as never;

describe("tenantPortal.service Belegeinsicht (§ 259 BGB)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists receipts for the tenant's property/year, only for allocatable costs with a receipt", async () => {
    mockContractFindFirst.mockResolvedValueOnce({ id: 77, propertyId: 3 });
    mockTransactionFindMany.mockResolvedValueOnce([
      {
        id: 100, description: "Gebäudereinigung", amount: -500, date: new Date(2025, 4, 1),
        betrkvCategory: "HAUSREINIGUNG",
        receiptDocument: { id: 900, name: "Rechnung_Reinigung.pdf", fileType: "PDF", fileSize: "12 KB" },
      },
    ]);

    const result = await getReceipts(tenantUser, 2025);

    expect(mockTransactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 1,
          propertyId: 3,
          type: "AUSGABE",
          allocatable: true,
          receiptDocumentId: { not: null },
        }),
      })
    );
    expect(result.year).toBe(2025);
    expect(result.receipts).toHaveLength(1);
    expect(result.receipts[0].document?.id).toBe(900);
  });

  it("downloadReceipt authorizes via the tenant's own property before returning the document", async () => {
    mockContractFindMany.mockResolvedValueOnce([{ propertyId: 3 }]);
    mockTransactionFindFirst.mockResolvedValueOnce({
      receiptDocument: { id: 900, name: "Rechnung.pdf", filePath: "/x.pdf" },
    });

    const doc = await downloadReceipt(tenantUser, 900);

    expect(mockTransactionFindFirst).toHaveBeenCalledWith({
      where: { companyId: 1, receiptDocumentId: 900, allocatable: true, propertyId: { in: [3] } },
      select: { receiptDocument: true },
    });
    expect(doc.id).toBe(900);
  });

  it("downloadReceipt rejects a receipt from a property the tenant never rented", async () => {
    mockContractFindMany.mockResolvedValueOnce([{ propertyId: 3 }]);
    mockTransactionFindFirst.mockResolvedValueOnce(null);

    await expect(downloadReceipt(tenantUser, 999)).rejects.toThrow();
  });
});
