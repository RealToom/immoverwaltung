import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPropertyFindFirst, mockTransactionFindMany, mockEnergyPassportFindUnique,
  mockUnitFindMany, mockContractFindMany, mockContractFindUnique, mockRentPaymentFindMany,
  mockTransactionDeleteMany, mockTransactionCreate, mockDocumentFindFirst, mockCompanyFindUnique,
} = vi.hoisted(() => ({
  mockPropertyFindFirst: vi.fn(),
  mockTransactionFindMany: vi.fn(),
  mockEnergyPassportFindUnique: vi.fn(),
  mockUnitFindMany: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockRentPaymentFindMany: vi.fn(),
  mockTransactionDeleteMany: vi.fn(),
  mockTransactionCreate: vi.fn(),
  mockDocumentFindFirst: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    property: { findFirst: mockPropertyFindFirst },
    transaction: { findMany: mockTransactionFindMany, deleteMany: mockTransactionDeleteMany, create: mockTransactionCreate },
    energyPassport: { findUnique: mockEnergyPassportFindUnique },
    unit: { findMany: mockUnitFindMany },
    contract: { findMany: mockContractFindMany, findUnique: mockContractFindUnique },
    rentPayment: { findMany: mockRentPaymentFindMany },
    document: { findFirst: mockDocumentFindFirst },
    company: { findUnique: mockCompanyFindUnique },
  },
}));

const { mockCreateDocument, mockDeleteDocument } = vi.hoisted(() => ({
  mockCreateDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
}));
vi.mock("../services/document.service.js", () => ({
  createDocument: mockCreateDocument,
  deleteDocument: mockDeleteDocument,
}));

const { mockGenerateTenantStatementPdf } = vi.hoisted(() => ({
  mockGenerateTenantStatementPdf: vi.fn(),
}));
vi.mock("../services/utility-statement-pdf.service.js", () => ({
  generateTenantStatementPdf: mockGenerateTenantStatementPdf,
}));

import { UtilityBillingService } from "../services/utility-billing.service.js";

// Single contract, full year 2025, no vacancy, no CO2 — mirrors the
// no-vacancy fixture already used for generateStatement's own tests.
function mockNoVacancyFullYearScenario() {
  mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
  mockTransactionFindMany.mockResolvedValueOnce([
    { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
  ]);
  mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
  mockUnitFindMany.mockResolvedValueOnce([
    { id: 5, number: "EG links", area: 50, contracts: [{ startDate: new Date(2025, 0, 1), endDate: null }] },
  ]);
  mockContractFindMany.mockResolvedValueOnce([
    {
      id: 42, tenantId: 7, startDate: new Date(2025, 0, 1), endDate: null,
      unit: { id: 5, number: "EG links", area: 50 },
      tenant: { id: 7, name: "Mustermann" },
    },
  ]);
  mockContractFindUnique.mockResolvedValueOnce({ id: 42, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
  mockRentPaymentFindMany.mockResolvedValueOnce(
    Array.from({ length: 12 }, (_, i) => ({ id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH" }))
  );
  mockCompanyFindUnique.mockResolvedValueOnce({ name: "Testfirma GmbH" });
  // finalizeStatement's own property lookup (separate from generateStatement's internal one)
  mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1, name: "Residenz Am Park" });
}

describe("UtilityBillingService.finalizeStatement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes tenantId on generateStatement's items", async () => {
    // Self-contained: exercises generateStatement() directly (not finalizeStatement),
    // so it only needs the subset of mocks generateStatement itself calls — no property
    // lookup queueing dance needed for a second, finalize-only call.
    mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
    mockTransactionFindMany.mockResolvedValueOnce([
      { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
    ]);
    mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
    mockUnitFindMany.mockResolvedValueOnce([
      { id: 5, number: "EG links", area: 50, contracts: [{ startDate: new Date(2025, 0, 1), endDate: null }] },
    ]);
    mockContractFindMany.mockResolvedValueOnce([
      {
        id: 42, tenantId: 7, startDate: new Date(2025, 0, 1), endDate: null,
        unit: { id: 5, number: "EG links", area: 50 },
        tenant: { id: 7, name: "Mustermann" },
      },
    ]);
    mockContractFindUnique.mockResolvedValueOnce({ id: 42, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
    mockRentPaymentFindMany.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, i) => ({ id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH" }))
    );

    const svc = new UtilityBillingService(1);
    const statement = await svc.generateStatement(1, 2025);
    expect(statement.items[0].tenantId).toBe(7);
  });

  it("creates one document per item and clears any stale vacancy transaction, without persisting a new one when there is no vacancy", async () => {
    mockNoVacancyFullYearScenario();
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no pre-existing document for this tenant/year
    mockGenerateTenantStatementPdf.mockResolvedValueOnce({ filePath: "/fake/path.pdf", fileSizeBytes: 4096 });
    mockCreateDocument.mockResolvedValueOnce({ id: 99 });

    const svc = new UtilityBillingService(1);
    const result = await svc.finalizeStatement(1, 2025);

    expect(mockTransactionDeleteMany).toHaveBeenCalledWith({
      where: {
        propertyId: 1,
        companyId: 1,
        category: "Leerstands-Ausgleich",
        date: { gte: new Date(2025, 0, 1), lte: new Date(2025, 11, 31) },
      },
    });
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(mockDeleteDocument).not.toHaveBeenCalled();
    expect(mockCreateDocument).toHaveBeenCalledWith(1, {
      name: "Nebenkostenabrechnung_2025_Residenz_Am_Park.pdf",
      fileType: "PDF",
      fileSize: "4.0 KB",
      filePath: "/fake/path.pdf",
      tenantId: 7,
      propertyId: 1,
    });

    // The PDF must receive the formal § 556 BGB content: prepayments,
    // distribution key, and property-level totals per category.
    const pdfInput = mockGenerateTenantStatementPdf.mock.calls[0][0];
    expect(pdfInput.totalPrepaid).toBe(1200);
    expect(pdfInput.area).toBe(50);
    expect(pdfInput.totalArea).toBe(50);
    expect(pdfInput.occupancyDays).toBe(365);
    expect(pdfInput.daysInYear).toBe(365);
    expect(pdfInput.totalCosts).toBe(1200);
    expect(pdfInput.categories).toEqual([
      { category: "GRUNDSTEUER", label: "Grundsteuer", propertyTotal: 1200, tenantShare: 1200 },
    ]);

    expect(result).toEqual({
      propertyId: 1,
      year: 2025,
      generatedCount: 1,
      items: expect.any(Array),
    });
    // The finalize response links each item to its generated document so the
    // admin UI can offer direct downloads.
    expect(result.items[0].documentId).toBe(99);
  });

  it("deletes an existing document for the same tenant/year before creating the replacement", async () => {
    mockNoVacancyFullYearScenario();
    mockDocumentFindFirst.mockResolvedValueOnce({ id: 55 });
    mockGenerateTenantStatementPdf.mockResolvedValueOnce({ filePath: "/fake/path2.pdf", fileSizeBytes: 2048 });
    mockCreateDocument.mockResolvedValueOnce({ id: 100 });

    const svc = new UtilityBillingService(1);
    await svc.finalizeStatement(1, 2025);

    expect(mockDeleteDocument).toHaveBeenCalledWith(1, 55);
    expect(mockCreateDocument).toHaveBeenCalled();
  });
});
