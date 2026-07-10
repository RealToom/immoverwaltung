import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDocumentFindFirst } = vi.hoisted(() => ({ mockDocumentFindFirst: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({
  prisma: { document: { findFirst: mockDocumentFindFirst } },
}));

import { downloadDocument } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service downloadDocument", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the document when it belongs to the authenticated tenant", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce({ id: 5, tenantId: 10, companyId: 1, filePath: "/some/path.pdf" });

    const doc = await downloadDocument(tenantUser, 5);

    expect(mockDocumentFindFirst).toHaveBeenCalledWith({
      where: { id: 5, tenantId: 10, companyId: 1 },
    });
    expect(doc.id).toBe(5);
  });

  it("throws NotFoundError when the document belongs to another tenant", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null); // filtered out by the tenantId/companyId where-clause

    await expect(downloadDocument(tenantUser, 999)).rejects.toThrow("nicht gefunden");
  });
});
