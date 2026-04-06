import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenantUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    maintenanceTicket: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    rentPayment: {
      findMany: vi.fn(),
    },
    tenantMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    tenantUpload: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";
import {
  getMe,
  getDocuments,
  signDocument,
  getTickets,
  createTicket,
  getFinances,
  getMessages,
  createMessage,
  updateMe,
} from "../services/tenantPortal.service.js";

const mockTenantUser = { id: 1, tenantId: 10, companyId: 3 };

describe("tenantPortal.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMe", () => {
    it("returns tenant user with tenant data", async () => {
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
        id: 1,
        email: "max@example.de",
        lastLoginAt: null,
        company: { name: "Mustermann Verwaltung GmbH" },
        tenant: {
          id: 10,
          name: "Max Mustermann",
          phone: "+49 171 123",
          moveIn: new Date("2024-01-15"),
          units: [{ id: 1, number: "3 OG", floor: 3, area: 65, rent: 720, type: "WOHNUNG", property: { street: "Hauptstr. 12", zip: "80333", city: "München", name: "Hauptstr." } }],
          contracts: [{ id: 1, monthlyRent: 850, status: "AKTIV", startDate: new Date("2024-01-15"), endDate: null }],
        },
      } as any);

      const result = await getMe(mockTenantUser);

      expect(result.email).toBe("max@example.de");
      expect(result.companyName).toBe("Mustermann Verwaltung GmbH");
      expect(result.tenant.name).toBe("Max Mustermann");
      expect(result.tenant.units).toHaveLength(1);
    });

    it("throws when tenantUser not found", async () => {
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce(null);
      await expect(getMe(mockTenantUser)).rejects.toThrow();
    });
  });

  describe("getDocuments", () => {
    it("returns documents filtered by tenantId and companyId", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValueOnce([
        { id: 1, name: "Mietvertrag.pdf", fileType: "application/pdf", fileSize: "2.4 MB", filePath: "/path/to/file.pdf", requiresSignature: false, signedAt: null, signatureType: null, createdAt: new Date() },
      ] as any);

      const docs = await getDocuments(mockTenantUser);
      expect(docs).toHaveLength(1);
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 10, companyId: 3 },
        })
      );
    });
  });

  describe("signDocument", () => {
    it("marks document as signed with SIMPLE type", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
        id: 5,
        tenantId: 10,
        companyId: 3,
        requiresSignature: true,
        signedAt: null,
        signatureType: "SIMPLE",
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValueOnce({} as any);

      await signDocument(mockTenantUser, 5, "SIMPLE");

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            signedAt: expect.any(Date),
            signedByTenantUserId: 1,
          }),
        })
      );
    });

    it("throws when document not found for this tenant", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(null);
      await expect(signDocument(mockTenantUser, 99, "SIMPLE")).rejects.toThrow();
    });

    it("throws when document already signed", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
        id: 5, tenantId: 10, companyId: 3, requiresSignature: true, signedAt: new Date(),
      } as any);
      await expect(signDocument(mockTenantUser, 5, "SIMPLE")).rejects.toThrow();
    });
  });

  describe("getTickets", () => {
    it("returns maintenance tickets for tenant's units", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        units: [{ id: 1 }, { id: 2 }],
      } as any);
      vi.mocked(prisma.maintenanceTicket.findMany).mockResolvedValueOnce([
        { id: 1, title: "Heizung defekt", status: "OFFEN", category: "HEIZUNG", createdAt: new Date() },
      ] as any);

      const tickets = await getTickets(mockTenantUser);
      expect(tickets).toHaveLength(1);
    });
  });

  describe("createTicket", () => {
    it("creates a maintenance ticket for the tenant's first active unit", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        units: [{ id: 1, propertyId: 5 }],
      } as any);
      vi.mocked(prisma.maintenanceTicket.create).mockResolvedValueOnce({
        id: 99,
        title: "Wasserhahn tropft",
      } as any);

      const ticket = await createTicket(mockTenantUser, {
        title: "Wasserhahn tropft",
        description: "Der Wasserhahn im Bad tropft seit 3 Tagen",
        category: "SANITAER",
      });

      expect(ticket.title).toBe("Wasserhahn tropft");
      expect(prisma.maintenanceTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 3,
            unitId: 1,
            propertyId: 5,
          }),
        })
      );
    });

    it("rejects invalid category", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        units: [{ id: 1, propertyId: 5 }],
      } as any);

      await expect(
        createTicket(mockTenantUser, {
          title: "Irgendwas kaputt",
          description: "Eine längere Beschreibung des Problems hier",
          category: "UNGUELTIG",
        })
      ).rejects.toThrow();
    });
  });

  describe("getFinances", () => {
    it("returns rent payments", async () => {
      vi.mocked(prisma.rentPayment.findMany).mockResolvedValueOnce([
        { id: 1, month: new Date("2026-04-01"), amountDue: 850, amountPaid: 850, status: "PUENKTLICH", dueDate: new Date("2026-04-01"), paidDate: new Date("2026-04-01"), contract: { monthlyRent: 850 } },
      ] as any);

      const result = await getFinances(mockTenantUser);
      expect(result.entries).toHaveLength(1);
      expect(result.monthlyRent).toBe(850);
    });
  });

  describe("getMessages", () => {
    it("returns messages for this tenantUser", async () => {
      vi.mocked(prisma.tenantMessage.updateMany).mockResolvedValueOnce({ count: 0 } as any);
      vi.mocked(prisma.tenantMessage.findMany).mockResolvedValueOnce([
        { id: 1, body: "Hallo!", direction: "ADMIN_TO_TENANT", createdAt: new Date(), readAt: null },
      ] as any);

      const messages = await getMessages(mockTenantUser);
      expect(messages).toHaveLength(1);
    });
  });

  describe("createMessage", () => {
    it("creates a message from tenant to admin", async () => {
      vi.mocked(prisma.tenantMessage.create).mockResolvedValueOnce({
        id: 10,
        body: "Ich habe eine Frage",
        direction: "TENANT_TO_ADMIN",
        createdAt: new Date(),
        readAt: null,
      } as any);

      const msg = await createMessage(mockTenantUser, "Ich habe eine Frage");
      expect(msg.direction).toBe("TENANT_TO_ADMIN");
    });
  });
});
