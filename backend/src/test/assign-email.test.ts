import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    emailMessage: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock document service
vi.mock("../services/document.service.js", () => ({
  createDocument: vi.fn().mockResolvedValue({ id: 99 }),
}));

// Mock env
vi.mock("../config/env.js", () => ({
  env: { UPLOAD_DIR: "/tmp/uploads" },
}));

import { prisma } from "../lib/prisma.js";
import fs from "node:fs/promises";
import { createDocument } from "../services/document.service.js";
import { assignEmail } from "../services/email-message.service.js";

describe("assignEmail", () => {
  const mockMsg = {
    id: 1,
    subject: "Reparatur Hauptstraße",
    bodyText: "Sehr geehrte Damen und Herren...",
    companyId: 42,
    emailAccountId: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.emailMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);
    (prisma.emailMessage.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockMsg, tenantId: 7 });
  });

  it("updates emailMessage and calls createDocument on success", async () => {
    await assignEmail(42, 1, { tenantId: 7, propertyId: 10 });

    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        tenantId: 7,
        propertyId: 10,
        suggestedTenantId: null,
        suggestedPropertyId: null,
      },
    });
    expect(createDocument).toHaveBeenCalledOnce();
    expect(fs.writeFile).toHaveBeenCalledOnce();
  });

  it("throws when message not found", async () => {
    (prisma.emailMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // AppError.message ist der menschenlesbare String, nicht der HTTP-Status
    await expect(assignEmail(42, 999, { tenantId: 7 })).rejects.toThrow("Nachricht nicht gefunden");
  });

  it("unlinks file if createDocument throws", async () => {
    (createDocument as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    await expect(assignEmail(42, 1, { tenantId: 7 })).rejects.toThrow("DB error");
    expect(fs.unlink).toHaveBeenCalledOnce();
  });
});
