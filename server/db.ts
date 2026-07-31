import { neon } from "@neondatabase/serverless";
import { EncryptedPayload } from "./crypto.js";
import { CONFIG } from "./config.js";

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "operator" | "viewer";
  createdAt: string;
  lastLoginAt?: string;
}

export interface DbServerProfile {
  id: string;
  ownerId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  encPassword?: EncryptedPayload;
  encPrivateKey?: EncryptedPayload;
  color?: string;
  tags?: string[];
  isDemo?: boolean;
  lastConnected?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbAuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  serverId?: string;
  serverHost?: string;
  action: string;
  command?: string;
  success: boolean;
  detail?: string;
  ip?: string;
  timestamp: string;
}

export interface DbSchema {
  users: DbUser[];
  servers: DbServerProfile[];
  auditLogs: DbAuditLogEntry[];
}

const defaultData: DbSchema = { users: [], servers: [], auditLogs: [] };

/**
 * Storage backend.
 *
 * Historically this was a local lowdb JSON file. That broke silently on any host with an
 * ephemeral filesystem (e.g. Render's free web service, which has NO persistent disk) --
 * every redeploy or restart wiped all users, saved server profiles, and audit history with
 * no warning. Now the whole app state lives as a single JSONB blob in a real Postgres row
 * (Neon, accessed over its HTTP driver so it works from any environment, including ones that
 * block raw TCP egress). Every route in the codebase reads via the synchronous `db.data.*`
 * shape and mutates via `withDb(fn)`, matching the previous lowdb-based API exactly --
 * nothing else in the codebase needed to change for this migration.
 *
 * DATABASE_URL must be a Postgres connection string (postgresql://...), e.g. from a free
 * Neon project (neon.tech). Required in production; in dev, an in-memory-only fallback is
 * used (with a console warning) so `npm run dev` still works without a DB configured.
 */

let dbData: DbSchema = structuredClone(defaultData);
let persist: (() => Promise<void>) | null = null;

async function initPostgresBackend(connectionString: string): Promise<void> {
  const sql = neon(connectionString);

  await sql`
    CREATE TABLE IF NOT EXISTS panelvpn_state (
      id INT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const rows = await sql`SELECT data FROM panelvpn_state WHERE id = 1`;
  if (rows.length > 0) {
    dbData = rows[0].data as DbSchema;
    // Guard against a partially-shaped blob (e.g. schema evolved since it was written).
    dbData.users ??= [];
    dbData.servers ??= [];
    dbData.auditLogs ??= [];
  } else {
    await sql`INSERT INTO panelvpn_state (id, data) VALUES (1, ${JSON.stringify(defaultData)}::jsonb)`;
  }

  persist = async () => {
    await sql`
      UPDATE panelvpn_state SET data = ${JSON.stringify(dbData)}::jsonb, updated_at = now() WHERE id = 1
    `;
  };
}

if (CONFIG.DATABASE_URL) {
  await initPostgresBackend(CONFIG.DATABASE_URL);
} else if (CONFIG.NODE_ENV === "production") {
  throw new Error(
    "[FATAL] DATABASE_URL is not set in production. Without it, all users/server profiles/audit " +
      "logs are held only in memory and are lost on every restart or redeploy. Set DATABASE_URL " +
      "to a Postgres connection string (e.g. a free project at https://neon.tech) as an environment " +
      "variable."
  );
} else {
  console.warn(
    "[DB] DATABASE_URL not set -- running with in-memory-only storage (dev mode). " +
      "Data will NOT persist across restarts. Set DATABASE_URL to a Postgres connection string to persist."
  );
}

export const db = {
  get data(): DbSchema {
    return dbData;
  },
  // No-op: kept for API compatibility with the previous lowdb-based call sites that did
  // `await db.read()` before touching `db.data`. There's nothing to "re-read" here since
  // dbData is the live in-memory state for this single Node process (the only writer), not a
  // per-call snapshot of a file on disk that could be stale.
  async read(): Promise<void> {},
};

export async function withDb<T>(fn: (data: DbSchema) => T): Promise<T> {
  const result = fn(dbData);
  if (persist) await persist();
  return result;
}

// Cap audit log growth to keep the stored blob bounded.
const MAX_AUDIT_ENTRIES = 5000;

export async function appendAuditLog(entry: Omit<DbAuditLogEntry, "id" | "timestamp">): Promise<void> {
  await withDb((data) => {
    data.auditLogs.push({
      ...entry,
      id: "audit-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
    });
    if (data.auditLogs.length > MAX_AUDIT_ENTRIES) {
      data.auditLogs.splice(0, data.auditLogs.length - MAX_AUDIT_ENTRIES);
    }
  });
}
