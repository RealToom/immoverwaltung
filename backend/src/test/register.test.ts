import { describe, it, expect, vi, beforeEach } from "vitest";

// Alle vi.mock()-Aufrufe ZUERST — vor allen anderen Imports
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../lib/jwt.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("access_token"),
  signRefreshToken: vi.fn().mockReturnValue("refresh_token"),
}));

// Mock für Email — wird in Task 3 benötigt
vi.mock("../config/email.js", () => ({
  sendMail: vi.fn().mockResolvedValue(true),
  isEmailEnabled: true,
}));

// Imports NACH den vi.mock()-Aufrufen
import { prisma } from "../lib/prisma.js";
import { register } from "../services/auth.service.js";

const mockUser = {
  id: 1,
  name: "Max Mustermann",
  email: "max@example.de",
  role: "ADMIN",
  companyId: 10,
  passwordHash: "hashed_password",
  failedLoginAttempts: 0,
  lockedUntil: null,
  company: { id: 10, name: "Mustermann GmbH", slug: "mustermann-gmbh" },
};

describe("authService.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates company and user, returns tokens", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any);

    const result = await register("Max Mustermann", "max@example.de", "Password1!", "Mustermann GmbH");

    expect(prisma.user.create).toHaveBeenCalledOnce();
    expect(result.accessToken).toBe("access_token");
    expect(result.refreshToken).toBe("refresh_token");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("throws 409 if email already exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

    await expect(
      register("Max Mustermann", "max@example.de", "Password1!", "Mustermann GmbH")
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("sanitizes user — removes passwordHash, failedLoginAttempts, lockedUntil", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any);

    const result = await register("Max Mustermann", "max@example.de", "Password1!", "Mustermann GmbH");

    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("failedLoginAttempts");
    expect(result.user).not.toHaveProperty("lockedUntil");
  });
});
