import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { isEncryptionEnabled, encryptFile, decryptFile, getOriginalExt, encryptString, decryptString } from "../lib/crypto.js";

let tmpDir: string;
let testFile: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "immo-test-"));
  testFile = path.join(tmpDir, "test.pdf");
  fs.writeFileSync(testFile, "Dies ist Testinhalt fuer die Verschluesselung");
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
});

describe("isEncryptionEnabled", () => {
  it("gibt true zurueck wenn ENCRYPTION_KEY gesetzt ist", () => {
    expect(isEncryptionEnabled()).toBe(true);
  });
});

describe("encryptFile / decryptFile", () => {
  it("verschluesselt und entschluesselt eine Datei korrekt", () => {
    const originalContent = fs.readFileSync(testFile);

    const encPath = encryptFile(testFile);

    // Original-Datei wurde geloescht, .enc existiert
    expect(fs.existsSync(testFile)).toBe(false);
    expect(fs.existsSync(encPath)).toBe(true);
    expect(encPath).toMatch(/\.enc$/);

    // Entschluesseln liefert den originalen Inhalt zurueck
    const decrypted = decryptFile(encPath);
    expect(decrypted.toString()).toBe(originalContent.toString());
  });
});

describe("getOriginalExt", () => {
  it("extrahiert die originale Dateiendung aus dem .enc-Pfad", () => {
    expect(getOriginalExt("/uploads/abc.pdf.enc")).toBe(".pdf");
    expect(getOriginalExt("/uploads/doc.docx.enc")).toBe(".docx");
    expect(getOriginalExt("/uploads/img.png.enc")).toBe(".png");
  });
});

describe("encryptString / decryptString", () => {
  it("round-trips a string correctly", () => {
    const original = "SuperGeheimesPasswort123!";
    const encrypted = encryptString(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const enc1 = encryptString("test");
    const enc2 = encryptString("test");
    expect(enc1).not.toBe(enc2);
  });
});
