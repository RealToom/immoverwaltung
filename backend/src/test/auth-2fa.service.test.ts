import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUserFindUnique, mockRefreshTokenCreate } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockRefreshTokenCreate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: vi.fn() },
    refreshToken: { create: mockRefreshTokenCreate },
  },
}));

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn() },
}));

import { login } from "../services/auth.service.js";

const baseUser = {
  id: 1,
  email: "a@b.com",
  passwordHash: "hash",
  companyId: 10,
  role: "ADMIN",
  failedLoginAttempts: 0,
  lockedUntil: null,
  company: { id: 10 },
  totpEnabled: false,
  totpBypassedByAdmin: false,
  totpSecret: null,
  totpBackupCodes: [],
};

describe("auth.service login - 2FA cases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("totpBypassedByAdmin=true → returns accessToken + refreshToken (normal login)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ ...baseUser, totpBypassedByAdmin: true });
    mockRefreshTokenCreate.mockResolvedValueOnce({});
    const result = await login("a@b.com", "pw");
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
    expect(result).not.toHaveProperty("requiresMfa");
    expect(result).not.toHaveProperty("requiresMfaSetup");
  });

  it("totpEnabled=false, bypass=false → returns requiresMfaSetup + setupToken", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ ...baseUser, totpEnabled: false, totpBypassedByAdmin: false });
    const result = await login("a@b.com", "pw");
    expect(result).toHaveProperty("requiresMfaSetup", true);
    expect(result).toHaveProperty("setupToken");
    expect(result).not.toHaveProperty("accessToken");
  });

  it("totpEnabled=true, bypass=false → returns requiresMfa + mfaToken", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ ...baseUser, totpEnabled: true, totpBypassedByAdmin: false });
    const result = await login("a@b.com", "pw");
    expect(result).toHaveProperty("requiresMfa", true);
    expect(result).toHaveProperty("mfaToken");
    expect(result).not.toHaveProperty("accessToken");
  });
});
