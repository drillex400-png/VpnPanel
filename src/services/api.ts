import { SSHConfig, SystemMetrics, ProcessItem, ServiceItem, FileItem, FirewallRule, CronJob, LogEntry, UserAccount } from "../types";
import { getStoredToken } from "../contexts/AuthContext";

// Default Demo Server profile (always available, backend seeds it per-user on setup)
export const DEMO_SERVER_CONFIG: SSHConfig = {
  id: "demo-server-01",
  name: "Ubuntu Production (Demo)",
  host: "demo",
  port: 22,
  username: "ubuntu",
  authType: "password",
  password: "••••••••",
  color: "emerald",
  isDemo: true,
  tags: ["Production", "Web", "Ubuntu 24.04"],
  lastConnected: "Just now",
};

/** Authenticated fetch wrapper. Throws a friendly error on non-2xx responses. */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    // Token expired/invalid — force re-login
    localStorage.removeItem("panelvpn_auth_token");
    window.location.reload();
  }
  return res;
}

async function authFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// === Server Profile management (backend-persisted, credentials encrypted server-side) ===

export async function getSavedServers(): Promise<SSHConfig[]> {
  try {
    return await authFetchJson<SSHConfig[]>("/api/servers");
  } catch (e) {
    return [DEMO_SERVER_CONFIG];
  }
}

export async function saveServerProfile(server: SSHConfig): Promise<SSHConfig[]> {
  // Backend does an upsert on POST / : existing profiles are matched by id in the body.
  // Locally-generated temp ids ("server-...", "temp-test") are omitted so the backend creates a fresh one.
  const isLocalTempId = server.id.startsWith("server-") || server.id === "temp-test";
  const payload = {
    ...(isLocalTempId ? {} : { id: server.id }),
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    authType: server.authType,
    password: server.password,
    privateKey: server.privateKey,
    color: server.color,
    tags: server.tags,
  };
  await authFetchJson("/api/servers", { method: "POST", body: JSON.stringify(payload) });
  return getSavedServers();
}

export async function deleteServerProfile(id: string): Promise<SSHConfig[]> {
  await authFetchJson(`/api/servers/${id}`, { method: "DELETE" });
  return getSavedServers();
}

// === SSH Operations ===

// Ad-hoc test with raw credentials, used from the "New Connection" modal before saving
export async function testSSHConnection(config: SSHConfig): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (config.isDemo || config.host === "demo") {
    return { success: true, message: "Connected to Demo Linux Server (Ubuntu 24.04 LTS)", latencyMs: 14 };
  }
  try {
    const data = await authFetchJson<{ success: boolean; message: string; latencyMs?: number }>(
      "/api/ssh/test-connection",
      {
        method: "POST",
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          privateKey: config.privateKey,
        }),
      }
    );
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to reach server" };
  }
}

function getFallbackMetrics(config: SSHConfig): SystemMetrics {
  const time = new Date().toLocaleTimeString();
  const cpuPct = Math.floor(22 + Math.sin(Date.now() / 2500) * 15 + Math.random() * 6);
  const ramTotalMb = 16384;
  const ramUsedMb = Math.floor(6400 + Math.cos(Date.now() / 4000) * 350 + Math.random() * 200);

  return {
    timestamp: time,
    os: {
      hostname: config.name.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() || "linux-srv-01",
      distro: config.isDemo ? "Ubuntu 24.04.1 LTS (Demo)" : "Linux Remote Host",
      kernel: "6.5.0-28-generic",
      arch: "x86_64",
      uptime: "14 days, 6 hours, 42 mins",
    },
    cpu: {
      usagePct: Math.min(100, Math.max(5, cpuPct)),
      cores: 8,
      model: "AMD EPYC 7763 64-Core Processor",
      loadAvg: [0.42, 0.38, 0.35],
    },
    memory: {
      totalMb: ramTotalMb,
      usedMb: ramUsedMb,
      freeMb: ramTotalMb - ramUsedMb,
      cachedMb: 4120,
      swapTotalMb: 4096,
      swapUsedMb: 124,
    },
    disk: [
      { filesystem: "/dev/sda1", mount: "/", sizeGb: 100, usedGb: 42, availGb: 58, usePct: 42 },
      { filesystem: "/dev/sda2", mount: "/var/data", sizeGb: 500, usedGb: 180, availGb: 320, usePct: 36 },
      { filesystem: "/dev/nvme0n1p1", mount: "/home", sizeGb: 1000, usedGb: 310, availGb: 690, usePct: 31 },
    ],
    network: {
      rxKbps: Math.floor(150 + Math.random() * 400),
      txKbps: Math.floor(400 + Math.random() * 900),
      activeConnections: 24,
    },
  };
}

export async function fetchMetrics(config: SSHConfig): Promise<SystemMetrics> {
  try {
    const res = await authFetch("/api/ssh/metrics", {
      method: "POST",
      body: JSON.stringify({ serverId: config.id }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.cpu && data.memory) return data;
    } else {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error || `SSH metrics request failed (${res.status})`;
      const fallback = getFallbackMetrics(config);
      fallback.connectionError = errMsg;
      return fallback;
    }
  } catch (e: any) {
    const fallback = getFallbackMetrics(config);
    fallback.connectionError = e?.message || "Network request failed";
    return fallback;
  }

  return getFallbackMetrics(config);
}

export async function execCommand(config: SSHConfig, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const res = await authFetch("/api/ssh/exec", {
      method: "POST",
      body: JSON.stringify({ serverId: config.id, command }),
    });
    if (res.ok) return await res.json();
    const errData = await res.json().catch(() => ({}));
    return { stdout: "", stderr: errData.error || `Request failed (${res.status})`, code: 1 };
  } catch (e: any) {
    return { stdout: "", stderr: e?.message || "Network request failed", code: 1 };
  }
}

// Mock initial data arrays for File Manager, Processes, Services, Firewall, Logs, Crontab, Users
export const INITIAL_FILES: FileItem[] = [
  { name: "etc", path: "/etc", isDir: true, size: "4.0 KB", permissions: "drwxr-xr-x", owner: "root", group: "root", modified: "Jul 28 10:14" },
  { name: "var", path: "/var", isDir: true, size: "4.0 KB", permissions: "drwxr-xr-x", owner: "root", group: "root", modified: "Jul 29 14:02" },
  { name: "home", path: "/home", isDir: true, size: "4.0 KB", permissions: "drwxr-xr-x", owner: "root", group: "root", modified: "Jul 30 08:30" },
  { name: "root", path: "/root", isDir: true, size: "4.0 KB", permissions: "drwx------", owner: "root", group: "root", modified: "Jul 30 11:00" },
  { name: "opt", path: "/opt", isDir: true, size: "4.0 KB", permissions: "drwxr-xr-x", owner: "root", group: "root", modified: "Jul 15 16:40" },
  { name: "usr", path: "/usr", isDir: true, size: "4.0 KB", permissions: "drwxr-xr-x", owner: "root", group: "root", modified: "Jul 20 09:12" },
  { name: "nginx.conf", path: "/etc/nginx/nginx.conf", isDir: false, size: "2.4 KB", permissions: "-rw-r--r--", owner: "root", group: "root", modified: "Jul 25 18:22", extension: "conf" },
  { name: "docker-compose.yml", path: "/var/www/app/docker-compose.yml", isDir: false, size: "1.1 KB", permissions: "-rw-r--r--", owner: "ubuntu", group: "ubuntu", modified: "Jul 29 20:15", extension: "yml" },
  { name: ".env", path: "/var/www/app/.env", isDir: false, size: "480 B", permissions: "-rw-------", owner: "ubuntu", group: "ubuntu", modified: "Jul 29 20:16", extension: "env" },
  { name: "syslog", path: "/var/log/syslog", isDir: false, size: "14.2 MB", permissions: "-rw-r-----", owner: "syslog", group: "adm", modified: "Just now", extension: "log" },
];

