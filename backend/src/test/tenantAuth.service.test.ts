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
import { acceptInvite, loginTenant, refreshTenantToken } from "../services/tenantAuth.service.js";

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

describe("loginTenant — account lockout", () => {
  const baseUser = {
    id: 1,
    tenantId: 2,
    companyId: 3,
    passwordHash: "$2b$10$hash",
    twoFactorEnabled: false,
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  };

  beforeEach(() => vi.clearAllMocks());

  it("rejects login while account is locked", async () => {
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
      ...baseUser,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
    } as any);

    await expect(loginTenant("m@example.de", "pw", 3)).rejects.toThrow("Konto gesperrt");
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("increments failedLoginAttempts on wrong password", async () => {
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({ ...baseUser } as any);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    await expect(loginTenant("m@example.de", "falsch", 3)).rejects.toThrow(
      "E-Mail oder Passwort falsch"
    );
    expect(prisma.tenantUser.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { failedLoginAttempts: 1, lockedUntil: null },
    });
  });

  it("locks the account after the 10th failed attempt", async () => {
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
      ...baseUser,
      failedLoginAttempts: 9,
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    await expect(loginTenant("m@example.de", "falsch", 3)).rejects.toThrow();
    expect(prisma.tenantUser.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { failedLoginAttempts: 10, lockedUntil: expect.any(Date) },
    });
  });

  it("resets the counter on successful login", async () => {
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
      ...baseUser,
      failedLoginAttempts: 4,
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    vi.mocked(prisma.tenantUser.update).mockResolvedValue({} as any);

    const result = await loginTenant("m@example.de", "richtig", 3);
    expect(result.requiresTwoFactor).toBe(false);
    expect(prisma.tenantUser.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });
});

describe("refreshTenantToken — locked account", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects refresh while account is locked", async () => {
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValueOnce({
      id: 1,
      tenantId: 2,
      companyId: 3,
      refreshToken: "some-token",
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
    } as any);

    await expect(refreshTenantToken("some-token")).rejects.toThrow("Konto gesperrt");
    expect(prisma.tenantUser.update).not.toHaveBeenCalled();
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
