import { describe, it, expect, beforeEach } from "vitest";
import { signTenantMfaToken, verifyTenantMfaToken } from "../lib/tenantJwt.js";

describe("Tenant MFA JWT", () => {
  beforeEach(() => {
    process.env.JWT_TENANT_MFA_SECRET = "test-mfa-secret-min32chars-paddingXX";
  });

  it("signs and verifies a valid mfaToken", () => {
    const token = signTenantMfaToken({ tenantUserId: 1, companyId: 2 });
    const payload = verifyTenantMfaToken(token);
    expect(payload.tenantUserId).toBe(1);
    expect(payload.companyId).toBe(2);
    expect(payload.type).toBe("tenant_mfa_pending");
  });

  it("throws when verified with wrong secret", () => {
    const token = signTenantMfaToken({ tenantUserId: 1, companyId: 2 });
    process.env.JWT_TENANT_MFA_SECRET = "wrong-secret-min32chars-paddingXXXX";
    expect(() => verifyTenantMfaToken(token)).toThrow();
  });
});
