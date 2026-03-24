import crypto from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import { encryptString, decryptString } from "../lib/crypto.js";

export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  return new OTPAuth.Secret({ buffer: bytes }).base32;
}

export async function generateQrCodeUri(
  encryptedSecret: string,
  email: string,
  issuer = "ImmoVerwalt",
): Promise<string> {
  const secret = decryptString(encryptedSecret);
  const totp = new OTPAuth.TOTP({
    issuer,
    label: email,
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
  });
  const uri = totp.toString();
  return QRCode.toDataURL(uri);
}

export async function verifyCode(encryptedSecret: string, code: string): Promise<boolean> {
  const secret = decryptString(encryptedSecret);
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

const BACKUP_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomBackupCode(): string {
  const part = (n: number) =>
    Array.from({ length: n }, () =>
      BACKUP_CODE_CHARS[crypto.randomInt(BACKUP_CODE_CHARS.length)],
    ).join("");
  return `${part(4)}-${part(4)}`;
}

export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: 8 }, randomBackupCode);
  const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashed };
}

export async function verifyBackupCode(plain: string, hashes: string[]): Promise<number> {
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(plain, hashes[i])) return i;
  }
  return -1;
}
