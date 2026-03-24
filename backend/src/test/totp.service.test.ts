import { describe, it, expect, vi } from "vitest";
import * as OTPAuth from "otpauth";

// Mock crypto.ts so tests don't need ENCRYPTION_KEY
vi.mock("../lib/crypto.js", () => ({
  encryptString: (s: string) => `enc:${s}`,
  decryptString: (s: string) => s.replace("enc:", ""),
}));

import {
  generateSecret,
  verifyCode,
  generateBackupCodes,
  verifyBackupCode,
} from "../services/totp.service.js";

describe("totp.service", () => {
  it("verifyCode returns true for a valid current code", async () => {
    const secret = generateSecret();
    const encryptedSecret = `enc:${secret}`;
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    const code = totp.generate();
    expect(await verifyCode(encryptedSecret, code)).toBe(true);
  });

  it("verifyCode returns false for wrong code", async () => {
    const secret = generateSecret();
    expect(await verifyCode(`enc:${secret}`, "000000")).toBe(false);
  });

  it("verifyCode returns false for expired code (outside window)", async () => {
    const secret = generateSecret();
    const encryptedSecret = `enc:${secret}`;
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    const pastCode = totp.generate({ timestamp: Date.now() - 10 * 30 * 1000 });
    expect(await verifyCode(encryptedSecret, pastCode)).toBe(false);
  });

  it("verifyBackupCode returns index of matching code", async () => {
    const { plain, hashed } = await generateBackupCodes();
    const idx = await verifyBackupCode(plain[0], hashed);
    expect(idx).toBe(0);
  });

  it("verifyBackupCode returns -1 when code not in hashes (already removed)", async () => {
    const { plain, hashed } = await generateBackupCodes();
    const remaining = hashed.filter((_, i) => i !== 0);
    const idx = await verifyBackupCode(plain[0], remaining);
    expect(idx).toBe(-1);
  });
});
