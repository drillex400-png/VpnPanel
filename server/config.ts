import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const SECRETS_FILE = path.join(process.cwd(), ".server-secrets.json");

interface PersistedSecrets {
  jwtSecret: string;
  encryptionKey: string; // 32-byte hex
}

/**
 * Loads secrets from environment variables. If not present, falls back to a
 * locally persisted file so the app keeps working across restarts in dev/self-hosted
 * setups. In production you SHOULD set JWT_SECRET and ENCRYPTION_KEY explicitly via
 * environment variables (e.g. in your process manager / container secrets) --
 * the auto-generated file is a convenience fallback, not a production security posture.
 */
function loadOrCreateSecrets(): PersistedSecrets {
  const envJwt = process.env.JWT_SECRET;
  const envEnc = process.env.ENCRYPTION_KEY;

  if (envJwt && envEnc) {
    if (!/^[0-9a-f]{64}$/i.test(envEnc)) {
      throw new Error(
        "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return { jwtSecret: envJwt, encryptionKey: envEnc };
  }

  // In production, refuse to auto-generate/persist secrets to a local file: on ephemeral
  // hosting (containers, free-tier PaaS like Render) that file is wiped on every
  // redeploy/restart, silently invalidating all active sessions AND making every previously
  // encrypted SSH credential permanently undecryptable. Fail fast at boot instead so this is
  // caught immediately during deployment, not discovered later as "why did all my saved
  // servers break after a redeploy".
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[FATAL] JWT_SECRET and ENCRYPTION_KEY must both be set as real environment variables in production " +
        "(NODE_ENV=production). Auto-generated/file-persisted secrets are disabled in production because " +
        "they don't survive redeploys/restarts on most hosting platforms, which would invalidate all " +
        "sessions and make all encrypted SSH credentials unrecoverable. Generate them with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"  (JWT_SECRET)\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"  (ENCRYPTION_KEY)\n" +
        "and set them in your platform's environment variable settings."
    );
  }

  // Try to load previously generated local secrets (dev/self-hosted convenience only)
  if (fs.existsSync(SECRETS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SECRETS_FILE, "utf-8"));
      if (raw.jwtSecret && raw.encryptionKey) {
        return raw;
      }
    } catch {
      // fall through to regeneration
    }
  }

  const generated: PersistedSecrets = {
    jwtSecret: envJwt || crypto.randomBytes(48).toString("hex"),
    encryptionKey: envEnc || crypto.randomBytes(32).toString("hex"),
  };

  fs.writeFileSync(SECRETS_FILE, JSON.stringify(generated, null, 2), { mode: 0o600 });
  console.warn(
    "[SECURITY] JWT_SECRET / ENCRYPTION_KEY were not set via environment variables.\n" +
      `[SECURITY] Auto-generated secrets have been persisted to ${SECRETS_FILE} (mode 600).\n` +
      "[SECURITY] For production, set JWT_SECRET and ENCRYPTION_KEY as real environment variables and keep them out of the filesystem/version control."
  );

  return generated;
}

const secrets = loadOrCreateSecrets();

export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: secrets.jwtSecret,
  ENCRYPTION_KEY: Buffer.from(secrets.encryptionKey, "hex"),
  JWT_EXPIRY: process.env.JWT_EXPIRY || "12h",
  DB_FILE: path.join(process.cwd(), "data", "db.json"),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  // Direct localhost command execution (bypassing SSH) is a powerful, dangerous feature --
  // OFF by default everywhere, including dev. See server/services/sshService.ts for details.
  ALLOW_LOCAL_EXEC: process.env.ALLOW_LOCAL_EXEC === "true",
};
