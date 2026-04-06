import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantAcceptInviteSchema } from "../schemas/tenantAuth.schema.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenantUser: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

vi.mock("../lib/tenantJwt.js", () => ({
  signTenantAccessToken: vi.fn().mockReturnValue("access_token"),
  signTenantRefreshToken: vi.fn().mockReturnValue("refresh_token"),
  verifyTenantRefreshToken: vi.fn().mockReturnValue({ tenantUserId: 1, tenantId: 2, companyId: 3 }),
}));

vi.mock("../config/env.js", () => ({
  env: { BCRYPT_COST: 10 },
}));

import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { acceptInvite } from "../services/tenantAuth.service.js";

describe("acceptInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when invite token is not found", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce(null);
    await expect(acceptInvite("invalid-token", "Passwort1!")).rejects.toThrow(
      "Ungültiger Einladungslink"
    );
  });

  it("throws when invite token is expired", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      passwordHash: "",
      inviteToken: "tok",
      inviteExpiresAt: new Date(Date.now() - 1000),
    } as any);
    await expect(acceptInvite("tok", "Passwort1!")).rejects.toThrow(
      "Einladungslink ist abgelaufen"
    );
  });

  it("throws when account is already activated (token already used)", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      passwordHash: "$2b$10$existingHash",
      inviteToken: "tok",
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    } as any);
    await expect(acceptInvite("tok", "Passwort1!")).rejects.toThrow(
      "Einladung bereits verwendet"
    );
  });

  it("activates account and returns tokens on valid invite", async () => {
    vi.mocked(prisma.tenantUser.findFirst).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      passwordHash: "",
      inviteToken: "valid-tok",
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    } as any);
    vi.mocked(prisma.tenantUser.update).mockResolvedValueOnce({} as any);

    const result = await acceptInvite("valid-tok", "Passwort1!");
    expect(result.accessToken).toBe("access_token");
    expect(result.refreshToken).toBe("refresh_token");
    expect(prisma.tenantUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteToken: null,
          inviteExpiresAt: null,
        }),
      })
    );
  });
});

describe("tenantAcceptInviteSchema password validation", () => {
  it("rejects password shorter than 10 chars", () => {
    const result = tenantAcceptInviteSchema.safeParse({ token: "tok", password: "Short1!" });
    expect(result.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = tenantAcceptInviteSchema.safeParse({ token: "tok", password: "LangPasswort1" });
    expect(result.success).toBe(false);
  });

  it("accepts strong password", () => {
    const result = tenantAcceptInviteSchema.safeParse({ token: "tok", password: "StarkesPW1!" });
    expect(result.success).toBe(true);
  });
});
