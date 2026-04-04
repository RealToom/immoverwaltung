import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("tenant_access_token"),
    verify: vi.fn().mockReturnValue({
      tenantUserId: 1,
      tenantId: 2,
      companyId: 3,
      role: "TENANT",
    }),
  },
}));

import {
  signTenantAccessToken,
  signTenantRefreshToken,
  verifyTenantAccessToken,
  verifyTenantRefreshToken,
} from "../lib/tenantJwt.js";

describe("tenantJwt", () => {
  beforeEach(() => {
    process.env.JWT_TENANT_ACCESS_SECRET = "test-tenant-access-secret";
    process.env.JWT_TENANT_REFRESH_SECRET = "test-tenant-refresh-secret";
  });

  it("signTenantAccessToken returns a token string", () => {
    const token = signTenantAccessToken({ tenantUserId: 1, tenantId: 2, companyId: 3 });
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("signTenantRefreshToken returns a token string", () => {
    const token = signTenantRefreshToken({ tenantUserId: 1, tenantId: 2, companyId: 3 });
    expect(typeof token).toBe("string");
  });

  it("verifyTenantAccessToken returns payload with role TENANT", () => {
    const payload = verifyTenantAccessToken("tenant_access_token");
    expect(payload.role).toBe("TENANT");
    expect(payload.tenantUserId).toBe(1);
    expect(payload.companyId).toBe(3);
  });

  it("verifyTenantRefreshToken returns payload", () => {
    const payload = verifyTenantRefreshToken("refresh_token");
    expect(payload.tenantId).toBe(2);
  });
});
