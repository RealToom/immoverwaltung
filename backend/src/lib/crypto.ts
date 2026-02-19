import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_EXT = ".enc";

/**
 * Whether encryption is enabled (ENCRYPTION_KEY is set).
 */
export function isEncryptionEnabled(): boolean {
    return env.ENCRYPTION_KEY.length >= 64; // 32 bytes as hex = 64 chars
}

function getKey(): Buffer {
    if (!isEncryptionEnabled()) {
        throw new Error("ENCRYPTION_KEY ist nicht konfiguriert oder zu kurz (mind. 64 Hex-Zeichen / 32 Bytes)");
    }
    return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

/**
 * Encrypt a file on disk in-place: replaces `filePath` with `filePath.enc`.
 * Returns the new file path.
 * DSGVO Art. 32 - Technische Massnahmen zum Schutz personenbezogener Daten.
 */
export function encryptFile(filePath: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const input = fs.readFileSync(filePath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: [IV (16 bytes)] [AuthTag (16 bytes)] [Encrypted data]
    const outPath = filePath + ENCRYPTED_EXT;
    const outBuffer = Buffer.concat([iv, authTag, encrypted]);
    fs.writeFileSync(outPath, outBuffer);

    // Remove original unencrypted file
    fs.unlinkSync(filePath);

    return outPath;
}

/**
 * Decrypt a .enc file and return a readable Buffer.
 * Does NOT write to disk - the decrypted content is streamed directly to the response.
 */
export function decryptFile(encPath: string): Buffer {
    const key = getKey();
    const data = fs.readFileSync(encPath);

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Get the original file extension from an encrypted path.
 * e.g. "abc.pdf.enc" -> ".pdf"
 */
export function getOriginalExt(encPath: string): string {
    const base = encPath.endsWith(ENCRYPTED_EXT) ? encPath.slice(0, -ENCRYPTED_EXT.length) : encPath;
    return path.extname(base);
}
