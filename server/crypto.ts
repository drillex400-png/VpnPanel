import crypto from "crypto";
import bcrypt from "bcryptjs";
import { CONFIG } from "./config.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

export interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

/** Encrypts a plaintext secret (e.g. SSH password / private key) using AES-256-GCM. */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, CONFIG.ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

/** Decrypts a payload produced by encryptSecret. Throws if tampered/corrupted. */
export function decryptSecret(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const data = Buffer.from(payload.data, "hex");
  const decipher = crypto.createDecipheriv(ALGO, CONFIG.ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf-8");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
