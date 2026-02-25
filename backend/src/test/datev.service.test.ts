import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatDatevDate,
  formatDecimalGerman,
  buildBelegfeld1,
  generateExport,
} from "../services/datev.service.js";

// Mock all DB dependencies for generateExport tests
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    companyAccountingSettings: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    categoryAccountMapping: {
      findMany: vi.fn(),
    },
    datevExportLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/audit.service.js", () => ({
  createAuditLog: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";

describe("formatDatevDate", () => {
  it("returns DDMM format", () => {
    expect(formatDatevDate(new Date("2026-03-15T12:00:00Z"))).toBe("1503");
  });

  it("pads single digits", () => {
    expect(formatDatevDate(new Date("2026-01-05T12:00:00Z"))).toBe("0501");
  });
});

describe("formatDecimalGerman", () => {
  it("uses comma separator", () => {
    expect(formatDecimalGerman(1234.56)).toBe("1234,56");
  });

  it("uses absolute value for negative amounts", () => {
    expect(formatDecimalGerman(-500)).toBe("500,00");
  });
});

describe("buildBelegfeld1", () => {
  it("pads to TX + 9 digits", () => {
    expect(buildBelegfeld1(42)).toBe("TX000000042");
  });

  it("result is max 12 chars", () => {
    expect(buildBelegfeld1(123456789012).length).toBeLessThanOrEqual(12);
  });
});

describe("generateExport", () => {
  const validSettings = {
    id: 1,
    companyId: 1,
    beraternummer: 12345,
    mandantennummer: 67890,
    kontenrahmen: "SKR03" as const,
    defaultBankAccount: "1810",
    defaultIncomeAccount: "8400",
    defaultExpenseAccount: "4900",
    fiscalYearStart: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.companyAccountingSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(validSettings);
    (prisma.categoryAccountMapping.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.datevExportLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("throws AppError(404) when no transactions found", async () => {
    (prisma.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await expect(generateExport(1, new Date("2026-01-01"), new Date("2026-01-31"))).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("buffer starts with UTF-8 BOM bytes", async () => {
    (prisma.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 1,
      date: new Date("2026-01-15T12:00:00Z"),
      description: "Miete Januar",
      type: "EINNAHME",
      amount: 1200,
      category: "Miete",
      companyId: 1,
      bankAccountId: null,
      propertyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const { buffer } = await generateExport(1, new Date("2026-01-01"), new Date("2026-01-31"));
    // UTF-8 BOM = 0xEF 0xBB 0xBF
    expect(buffer[0]).toBe(0xEF);
    expect(buffer[1]).toBe(0xBB);
    expect(buffer[2]).toBe(0xBF);
  });

  it("data rows use H for EINNAHME and S for AUSGABE", async () => {
    (prisma.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, date: new Date("2026-01-15T12:00:00Z"), description: "Miete", type: "EINNAHME", amount: 1200, category: "Miete", companyId: 1, bankAccountId: null, propertyId: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, date: new Date("2026-01-20T12:00:00Z"), description: "Kosten", type: "AUSGABE", amount: 200, category: "Reparatur", companyId: 1, bankAccountId: null, propertyId: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const { buffer } = await generateExport(1, new Date("2026-01-01"), new Date("2026-01-31"));
    const csv = buffer.toString("utf8").slice(3); // skip BOM
    const lines = csv.split("\r\n").filter(l => l.length > 0);
    const dataLines = lines.slice(2); // skip header + column header
    // First field is amount, second field is S/H indicator
    expect(dataLines[0].split(";")[1]).toBe("H");
    expect(dataLines[1].split(";")[1]).toBe("S");
  });

  it("uses CRLF line endings", async () => {
    (prisma.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, date: new Date("2026-01-15T12:00:00Z"), description: "Test", type: "EINNAHME", amount: 100, category: "Miete", companyId: 1, bankAccountId: null, propertyId: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const { buffer } = await generateExport(1, new Date("2026-01-01"), new Date("2026-01-31"));
    const csv = buffer.toString("utf8");
    expect(csv).toContain("\r\n");
  });
});
