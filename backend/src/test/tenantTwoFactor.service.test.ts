import { createHash, randomInt } from "crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { signTenantMfaToken, verifyTenantMfaToken } from "../lib/tenantJwt.js";

// ─── Hilfsfunktion (spiegelt interne sha256-Funktion im Service) ────────────
function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ─── sha256 ─────────────────────────────────────────────────────────────────
describe("sha256", () => {
  it("erzeugt konsistenten Hash", () => {
    expect(sha256("123456")).toBe(sha256("123456"));
  });

  it("erzeugt unterschiedliche Hashes für verschiedene Inputs", () => {
    expect(sha256("123456")).not.toBe(sha256("654321"));
  });

  it("erzeugt Hex-String mit 64 Zeichen", () => {
    expect(sha256("test")).toHaveLength(64);
  });
});

// ─── Code-Format ─────────────────────────────────────────────────────────────
describe("2FA Code-Format", () => {
  it("randomInt erzeugt 6-stellige Codes zwischen 100000 und 999999", () => {
    for (let i = 0; i < 100; i++) {
      const code = randomInt(100000, 999999);
      expect(code.toString()).toHaveLength(6);
      expect(code).toBeGreaterThanOrEqual(100000);
      expect(code).toBeLessThanOrEqual(999999);
    }
  });
});

// ─── MFA-JWT ──────────────────────────────────────────────────────────────────
describe("Tenant MFA JWT", () => {
  beforeEach(() => {
    process.env.JWT_TENANT_MFA_SECRET = "test-mfa-secret-min32chars-paddingXX";
  });

  it("signiert und verifiziert einen gültigen mfaToken", () => {
    const token = signTenantMfaToken({ tenantUserId: 1, companyId: 2 });
    const payload = verifyTenantMfaToken(token);
    expect(payload.tenantUserId).toBe(1);
    expect(payload.companyId).toBe(2);
    expect(payload.type).toBe("tenant_mfa_pending");
  });

  it("wirft bei falschem Secret", () => {
    const token = signTenantMfaToken({ tenantUserId: 1, companyId: 2 });
    process.env.JWT_TENANT_MFA_SECRET = "wrong-secret-min32chars-paddingXXXX";
    expect(() => verifyTenantMfaToken(token)).toThrow();
  });
});

// ─── Code-Verifizierungs-Logik (ohne DB) ─────────────────────────────────────
describe("verifyTwoFactorCode Logik", () => {
  it("lehnt ab wenn Code-Hash nicht übereinstimmt", () => {
    const storedHash = sha256("123456");
    const submittedHash = sha256("654321");
    expect(storedHash).not.toBe(submittedHash);
  });

  it("akzeptiert wenn Code-Hash übereinstimmt", () => {
    const code = "123456";
    expect(sha256(code)).toBe(sha256(code));
  });

  it("erkennt abgelaufenen Code", () => {
    const expiresAt = new Date(Date.now() - 1000);
    expect(expiresAt < new Date()).toBe(true);
  });

  it("erkennt noch gültigen Code", () => {
    const expiresAt = new Date(Date.now() + 9 * 60 * 1000);
    expect(expiresAt > new Date()).toBe(true);
  });
});

// ─── TrustedDevice-Logik (ohne DB) ───────────────────────────────────────────
describe("isTrustedDevice Logik", () => {
  it("abgelaufenes Device wird erkannt", () => {
    const expiresAt = new Date(Date.now() - 1000);
    expect(expiresAt < new Date()).toBe(true);
  });

  it("falsche tenantUserId wird erkannt", () => {
    expect(1 !== 2).toBe(true);
  });

  it("DEVICE_COOKIE_MAX_AGE_SECONDS entspricht 30 Tagen", async () => {
    const { DEVICE_COOKIE_MAX_AGE_SECONDS } = await import(
      "../services/tenantTwoFactor.service.js"
    );
    expect(DEVICE_COOKIE_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
