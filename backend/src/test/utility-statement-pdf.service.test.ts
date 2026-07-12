import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateTenantStatementPdf } from "../services/utility-statement-pdf.service.js";

describe("generateTenantStatementPdf", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) {
      try { fs.unlinkSync(f); } catch { /* already gone */ }
    }
  });

  it("writes a real PDF file and returns its size", async () => {
    const outputPath = path.join(os.tmpdir(), `test-statement-${Date.now()}.pdf`);
    tmpFiles.push(outputPath);

    const result = await generateTenantStatementPdf(
      {
        companyName: "Mustermann Hausverwaltung GmbH",
        propertyName: "Residenz Am Park",
        tenantName: "Max Mustermann",
        unitNumber: "4A",
        year: 2025,
        amount: 1540,
        balance: -120.5,
        isRefund: false,
        totalPrepaid: 1419.5,
        area: 72,
        totalArea: 480,
        occupancyDays: 365,
        daysInYear: 365,
        totalCosts: 10266.67,
        categories: [
          { category: "GRUNDSTEUER", label: "Grundsteuer", propertyTotal: 3555.53, tenantShare: 533.33 },
          { category: "HAUSWART", label: "Hauswart", propertyTotal: 5333.34, tenantShare: 800 },
          { category: "HEIZUNG", label: "Heizung", propertyTotal: 1377.8, tenantShare: 206.67 },
        ],
        co2: { landlordPercentage: 60, landlordShare: 480, tenantShare: 320, energyClass: "E" },
        heating: { consumptionBased: true, consumptionSharePercent: 70 },
        vacancyDeduction: 120,
      },
      outputPath
    );

    expect(result.filePath).toBe(outputPath);
    expect(result.fileSizeBytes).toBeGreaterThan(1000);

    const buffer = fs.readFileSync(outputPath);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("handles a statement with no CO2 split and no categories without throwing", async () => {
    const outputPath = path.join(os.tmpdir(), `test-statement-empty-${Date.now()}.pdf`);
    tmpFiles.push(outputPath);

    const result = await generateTenantStatementPdf(
      {
        companyName: "Firma",
        propertyName: "Haus",
        tenantName: "Erika Musterfrau",
        unitNumber: "1B",
        year: 2025,
        amount: 0,
        balance: 0,
        isRefund: true,
        totalPrepaid: 0,
        area: 40,
        totalArea: 40,
        occupancyDays: 200,
        daysInYear: 365,
        totalCosts: 0,
        categories: [],
        co2: null,
        heating: null,
        vacancyDeduction: 0,
      },
      outputPath
    );

    expect(result.fileSizeBytes).toBeGreaterThan(0);
  });
});
