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

export const INITIAL_PROCESSES: ProcessItem[] = [
  { pid: 1204, user: "www-data", cpuPct: 12.4, memPct: 3.8, vsz: "412M", rss: "98.5M", tty: "?", stat: "S", start: "Jul20", time: "84:12", command: "nginx: worker process" },
  { pid: 1540, user: "postgres", cpuPct: 4.8, memPct: 15.6, vsz: "890M", rss: "254M", tty: "?", stat: "Ss", start: "Jul20", time: "24:10", command: "postgres: main process (port 5432)" },
  { pid: 3210, user: "ubuntu", cpuPct: 8.2, memPct: 12.4, vsz: "620M", rss: "204M", tty: "?", stat: "Sl", start: "10:15", time: "12:04", command: "node /var/www/api/dist/server.js" },
  { pid: 482, user: "root", cpuPct: 1.2, memPct: 2.1, vsz: "245M", rss: "32.1M", tty: "?", stat: "Ssl", start: "Jul20", time: "12:30", command: "/usr/bin/dockerd -H fd://" },
  { pid: 1890, user: "redis", cpuPct: 0.8, memPct: 2.9, vsz: "120M", rss: "48M", tty: "?", stat: "Ssl", start: "Jul20", time: "4:20", command: "redis-server 127.0.0.1:6379" },
  { pid: 891, user: "root", cpuPct: 0.1, memPct: 0.5, vsz: "15.8M", rss: "8.4M", tty: "?", stat: "Ss", start: "Jul20", time: "0:05", command: "/usr/sbin/sshd -D" },
  { pid: 512, user: "root", cpuPct: 0.0, memPct: 0.4, vsz: "168M", rss: "12M", tty: "?", stat: "Ss", start: "Jul20", time: "0:14", command: "/sbin/init" },
  { pid: 4102, user: "ubuntu", cpuPct: 0.0, memPct: 0.6, vsz: "22.1M", rss: "9.8M", tty: "pts/0", stat: "Ss+", start: "11:00", time: "0:00", command: "-bash (interactive ssh)" },
];

export const INITIAL_SERVICES: ServiceItem[] = [
  { name: "nginx", unit: "nginx.service", load: "loaded", active: "active", sub: "running", description: "Nginx High Performance HTTP Server" },
  { name: "dockerd", unit: "docker.service", load: "loaded", active: "active", sub: "running", description: "Docker Application Container Engine" },
  { name: "ssh", unit: "ssh.service", load: "loaded", active: "active", sub: "running", description: "OpenSSH Secure Shell Server Daemon" },
  { name: "postgresql", unit: "postgresql.service", load: "loaded", active: "active", sub: "running", description: "PostgreSQL Object-Relational Database System" },
  { name: "redis-server", unit: "redis-server.service", load: "loaded", active: "active", sub: "running", description: "Advanced In-Memory Key-Value Store" },
  { name: "ufw", unit: "ufw.service", load: "loaded", active: "active", sub: "exited", description: "Uncomplicated Firewall Service" },
  { name: "cron", unit: "cron.service", load: "loaded", active: "active", sub: "running", description: "Regular background daemon processing scheduler" },
  { name: "fail2ban", unit: "fail2ban.service", load: "loaded", active: "active", sub: "running", description: "Ban hosts that cause multiple authentication errors" },
  { name: "failed-worker", unit: "failed-worker.service", load: "loaded", active: "failed", sub: "failed", description: "Custom Node Queue Worker Service" },
];

export const INITIAL_FIREWALL_RULES: FirewallRule[] = [
  { id: "rule-1", port: "22", protocol: "tcp", action: "ALLOW", from: "Anywhere", comment: "SSH Management Port" },
  { id: "rule-2", port: "80", protocol: "tcp", action: "ALLOW", from: "Anywhere", comment: "HTTP Web Traffic" },
  { id: "rule-3", port: "443", protocol: "tcp", action: "ALLOW", from: "Anywhere", comment: "HTTPS SSL Web Traffic" },
  { id: "rule-4", port: "3000", protocol: "tcp", action: "ALLOW", from: "192.168.1.0/24", comment: "Internal Web Dashboard" },
  { id: "rule-5", port: "5432", protocol: "tcp", action: "DENY", from: "Anywhere", comment: "Block Public Postgres Port" },
];

export const INITIAL_CRON_JOBS: CronJob[] = [
  { id: "cron-1", schedule: "0 3 * * *", minute: "0", hour: "3", dayMonth: "*", month: "*", dayWeek: "*", command: "/usr/local/bin/backup-db.sh > /var/log/backup.log 2>&1", user: "root", enabled: true },
  { id: "cron-2", schedule: "*/15 * * * *", minute: "*/15", hour: "*", dayMonth: "*", month: "*", dayWeek: "*", command: "/usr/bin/php /var/www/html/artisan schedule:run", user: "www-data", enabled: true },
  { id: "cron-3", schedule: "0 0 1 * *", minute: "0", hour: "0", dayMonth: "1", month: "*", dayWeek: "*", command: "/usr/bin/certbot renew --quiet", user: "root", enabled: true },
];

export const INITIAL_LOGS: LogEntry[] = [
  { id: "log-1", timestamp: "11:28:42", source: "auth.log", level: "CRITICAL", message: "Failed password for invalid user admin from 185.220.101.5 port 52310 ssh2" },
  { id: "log-2", timestamp: "11:28:40", source: "auth.log", level: "WARNING", message: "Failed password for root from 185.220.101.5 port 52308 ssh2" },
  { id: "log-3", timestamp: "11:25:12", source: "syslog", level: "INFO", message: "systemd[1]: Started Nginx High Performance HTTP Server." },
  { id: "log-4", timestamp: "11:20:05", source: "nginx.error", level: "ERROR", message: "connect() to unix:/var/run/php/php8.2-fpm.sock failed (2: No such file or directory) while connecting to upstream" },
  { id: "log-5", timestamp: "11:15:30", source: "journalctl", level: "ERROR", message: "failed-worker.service: Main process exited, code=exited, status=1/FAILURE" },
  { id: "log-6", timestamp: "11:00:00", source: "syslog", level: "INFO", message: "CRON[4210]: (root) CMD (/usr/local/bin/backup-db.sh > /var/log/backup.log 2>&1)" },
];

export const INITIAL_USERS: UserAccount[] = [
  { username: "root", uid: 0, gid: 0, comment: "Superuser / System Owner", homeDir: "/root", shell: "/bin/bash", isSudoer: true },
  { username: "ubuntu", uid: 1000, gid: 1000, comment: "Primary Admin User", homeDir: "/home/ubuntu", shell: "/bin/bash", isSudoer: true },
  { username: "www-data", uid: 33, gid: 33, comment: "Nginx/Web Server Daemon", homeDir: "/var/www", shell: "/usr/sbin/nologin", isSudoer: false },
  { username: "postgres", uid: 105, gid: 112, comment: "PostgreSQL Database Admin", homeDir: "/var/lib/postgresql", shell: "/bin/bash", isSudoer: false },
  { username: "redis", uid: 106, gid: 113, comment: "Redis In-Memory Database", homeDir: "/var/lib/redis", shell: "/bin/false", isSudoer: false },
  { username: "deploy", uid: 1001, gid: 1001, comment: "CI/CD Deployment Bot", homeDir: "/home/deploy", shell: "/bin/bash", isSudoer: true },
];
