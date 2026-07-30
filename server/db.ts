import fs from "fs";
import path from "path";
import { JSONFilePreset } from "lowdb/node";
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

fs.mkdirSync(path.dirname(CONFIG.DB_FILE), { recursive: true });

export const db = await JSONFilePreset<DbSchema>(CONFIG.DB_FILE, defaultData);

export async function withDb<T>(fn: (data: DbSchema) => T): Promise<T> {
  await db.read();
  const result = fn(db.data);
  await db.write();
  return result;
}

// Cap audit log growth to keep the JSON file bounded.
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
