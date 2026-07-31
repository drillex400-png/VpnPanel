import { Client as SSHClient } from "ssh2";

export interface SshConnConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

type PoolStatus = "connecting" | "ready" | "dead";

interface PoolEntry {
  conn: SSHClient;
  status: PoolStatus;
  readyPromise: Promise<SSHClient>;
  lastUsed: number;
  failCount: number;
  lastFailAt: number;
}

// Keyed by `${userId}:${serverId}` -- one live SSH connection reused across exec/metrics
// calls instead of a fresh TCP+SSH handshake per request. Massively cuts latency+load for
// the 4s metrics poll and repeated terminal/file-manager commands.
const pool = new Map<string, PoolEntry>();

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // close connections unused for 5 minutes
const REAP_INTERVAL_MS = 60 * 1000;
const KEEPALIVE_INTERVAL_MS = 30 * 1000; // ssh2 native keepalive heartbeat
const KEEPALIVE_COUNT_MAX = 3;
const MAX_BACKOFF_MS = 30 * 1000;

export function poolKey(userId: string, serverId: string): string {
  return `${userId}:${serverId}`;
}

function backoffDelayMs(failCount: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.max(0, failCount - 1)));
}

/** Returns a ready, pooled SSH connection for this key -- connects or reconnects as needed. */
export function getPooledConnection(key: string, config: SshConnConfig): Promise<SSHClient> {
  const existing = pool.get(key);

  if (existing) {
    if (existing.status === "ready") {
      existing.lastUsed = Date.now();
      return Promise.resolve(existing.conn);
    }
    if (existing.status === "connecting") {
      return existing.readyPromise;
    }
    // status === "dead": respect exponential backoff before allowing a fresh attempt
    const waitMs = backoffDelayMs(existing.failCount) - (Date.now() - existing.lastFailAt);
    if (waitMs > 0) {
      return Promise.reject(
        new Error(`SSH-соединение недавно оборвалось, повтор через ${Math.ceil(waitMs / 1000)}с`)
      );
    }
  }

  const conn = new SSHClient();
  let resolveReady!: (c: SSHClient) => void;
  let rejectReady!: (e: any) => void;
  const readyPromise = new Promise<SSHClient>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const entry: PoolEntry = {
    conn,
    status: "connecting",
    readyPromise,
    lastUsed: Date.now(),
    failCount: existing?.failCount || 0,
    lastFailAt: 0,
  };
  pool.set(key, entry);

  let settled = false;

  conn.on("ready", () => {
    entry.status = "ready";
    entry.failCount = 0;
    entry.lastUsed = Date.now();
    settled = true;
    resolveReady(conn);
  });

  conn.on("error", (err) => {
    entry.status = "dead";
    entry.failCount += 1;
    entry.lastFailAt = Date.now();
    if (!settled) {
      settled = true;
      rejectReady(err);
    }
    if (pool.get(key) === entry) pool.delete(key);
  });

  conn.on("close", () => {
    if (!settled) {
      settled = true;
      rejectReady(new Error("SSH-соединение закрыто до готовности"));
    }
    if (pool.get(key) === entry) pool.delete(key);
  });

  try {
    conn.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
      readyTimeout: 10000,
      keepaliveInterval: KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: KEEPALIVE_COUNT_MAX,
    });
  } catch (e) {
    entry.status = "dead";
    entry.failCount += 1;
    entry.lastFailAt = Date.now();
    pool.delete(key);
    return Promise.reject(e);
  }

  return readyPromise;
}

/** Runs a single command over a pooled connection, opening/reusing it transparently. */
export async function execPooled(key: string, config: SshConnConfig, command: string): Promise<SshExecResult> {
  let conn: SSHClient;
  try {
    conn = await getPooledConnection(key, config);
  } catch (e: any) {
    return { stdout: "", stderr: e?.message || "Не удалось установить SSH-соединение", code: 255 };
  }

  return new Promise<SshExecResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    conn.exec(command, (err, stream) => {
      if (err) {
        // The pooled connection may be stale (e.g. server rebooted) -- drop it so the next
        // call re-connects instead of repeatedly failing against a dead channel.
        closePooledConnection(key);
        return resolve({ stdout: "", stderr: err.message, code: 1 });
      }
      stream.on("close", (code: number) => {
        const entry = pool.get(key);
        if (entry) entry.lastUsed = Date.now();
        resolve({ stdout, stderr, code: code || 0 });
      });
      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    });
  });
}

export function closePooledConnection(key: string): void {
  const entry = pool.get(key);
  if (entry) {
    try {
      entry.conn.end();
    } catch {
      // ignore
    }
    pool.delete(key);
  }
}

export function poolStats() {
  return Array.from(pool.entries()).map(([key, e]) => ({
    key,
    status: e.status,
    idleMs: Date.now() - e.lastUsed,
  }));
}

// Periodically reap connections that have been idle too long.
const reapTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pool) {
    if (entry.status === "ready" && now - entry.lastUsed > IDLE_TIMEOUT_MS) {
      closePooledConnection(key);
    }
  }
}, REAP_INTERVAL_MS);
reapTimer.unref();
