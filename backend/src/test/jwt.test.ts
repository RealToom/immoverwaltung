import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from "../lib/jwt.js";

const payload: TokenPayload = {
  userId: 1,
  companyId: 2,
  role: "ADMIN",
};

describe("signAccessToken / verifyAccessToken", () => {
  it("erzeugt ein verifizierbares Token", () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT-Format: header.payload.signature

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.companyId).toBe(payload.companyId);
    expect(decoded.role).toBe(payload.role);
  });

  it("wirft Fehler bei ungueltigem Token", () => {
    expect(() => verifyAccessToken("ungueltig.token.wert")).toThrow();
  });

  it("wirft Fehler bei leerem Token", () => {
    expect(() => verifyAccessToken("")).toThrow();
  });
});

describe("signRefreshToken / verifyRefreshToken", () => {
  it("erzeugt ein verifizierbares Refresh-Token", () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.companyId).toBe(payload.companyId);
  });

  it("Access- und Refresh-Tokens sind nicht austauschbar", () => {
    const accessToken = signAccessToken(payload);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
