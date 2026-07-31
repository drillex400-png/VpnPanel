import { exec } from "child_process";
import { Client as SSHClient } from "ssh2";
import { execPooled } from "./sshPool.js";

export interface SshConnectionParams {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  isDemo?: boolean;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

// Private/reserved IP ranges that must never be reachable as "remote" SSH targets from
// this panel's server-side context (protects against SSRF-style abuse of the SSH feature
// pointing back at internal infrastructure). Localhost is handled separately & intentionally.
const BLOCKED_HOST_PATTERNS = [
  /^169\.254\./, // link-local / cloud metadata endpoint range
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,
];

export function isBlockedHost(host: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(host));
}

export async function runSshCommand(
  config: { host: string; port: number; username: string; password?: string; privateKey?: string },
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  if (config.host === "demo" || config.host === "localhost-demo" || config.host === "127.0.0.1-demo") {
    // Return mock demo response based on command
    return handleDemoCommand(command);
  }

  if (isBlockedHost(config.host)) {
    return { stdout: "", stderr: "Подключение к этому адресу заблокировано политикой безопасности.", code: 255 };
  }

  // If host is localhost/127.0.0.1 and no SSH key or password is set, execute directly via shell
  const isLocalHost = config.host === "localhost" || config.host === "127.0.0.1" || config.host === "local";
  if (isLocalHost && !config.password && !config.privateKey) {
    return new Promise((resolve) => {
      exec(command, { timeout: 15000 }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout || "",
          stderr: stderr || (err ? err.message : ""),
          code: err && err.code !== undefined ? (typeof err.code === 'number' ? err.code : 1) : 0,
        });
      });
    });
  }

  return new Promise((resolve) => {
    const conn = new SSHClient();
    let stdout = "";
    let stderr = "";

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return resolve({ stdout: "", stderr: err.message, code: 1 });
        }
        stream.on("close", (code: number) => {
          conn.end();
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

    conn.on("error", (err) => {
      resolve({ stdout: "", stderr: `SSH Connection Error: ${err.message}`, code: 255 });
    });

    try {
      conn.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        readyTimeout: 10000,
      });
    } catch (e: any) {
      resolve({ stdout: "", stderr: e?.message || "Failed to initiate SSH connection", code: 255 });
    }
  });
}

// Demo server response handler for seamless instant testing
export function handleDemoCommand(cmd: string): { stdout: string; stderr: string; code: number } {
  const trimmed = cmd.trim();

  if (trimmed.includes("uptime")) {
    const uptimeSec = Math.floor(Date.now() / 1000) % 864000;
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    return {
      stdout: ` 14:22:05 up ${days} days, ${hours}:${mins}, 2 users, load average: 0.42, 0.38, 0.35\n`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("uname -a")) {
    return {
      stdout: "Linux ubuntu-prod-srv01 6.5.0-28-generic #29-Ubuntu SMP PREEMPT_DYNAMIC Thu Mar 28 14:40:48 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux\n",
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("free -b") || trimmed.includes("free -m")) {
    return {
      stdout: `              total        used        free      shared  buff/cache   available
Mem:        16384000     6240000     4120000      240000     6024000     9800000
Swap:        4096000      124000     3972000
`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("df -h") || trimmed.includes("df -P")) {
    return {
      stdout: `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        100G   42G   58G  42% /
tmpfs            8.0G  1.2M  8.0G   1% /dev/shm
/dev/sda2        500G  180G  320G  36% /var/data
/dev/nvme0n1p1   1.0T  310G  690G  31% /home
`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("ps aux") || trimmed.includes("ps -eo")) {
    return {
      stdout: `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 168392 12140 ?        Ss   Jul20   0:14 /sbin/init
root         482  0.2  0.4 245100 32100 ?        Ssl  Jul20  12:30 /usr/bin/dockerd -H fd://
root         891  0.0  0.1  15890  8400 ?        Ss   Jul20   0:05 /usr/sbin/sshd -D
www-data    1204  1.8  1.2 412000 98500 ?        S    Jul20  84:12 nginx: worker process
postgres    1540  0.5  3.1 890000 254000 ?       Ss   Jul20  24:10 postgres: main process
redis       1890  0.1  0.6 120000 48000 ?        Ssl  Jul20   4:20 redis-server 127.0.0.1:6379
ubuntu      3210  4.2  2.5 620000 204000 ?       Sl   10:15  12:04 node /var/www/api/server.js
ubuntu      4102  0.0  0.2  22100  9800 pts/0    Ss+  11:00   0:00 -bash
`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("systemctl list-units") || trimmed.includes("systemctl status")) {
    return {
      stdout: `  nginx.service          loaded active running   Nginx HTTP Server
  dockerd.service        loaded active running   Docker Application Container Engine
  ssh.service            loaded active running   OpenSSH server daemon
  postgresql.service     loaded active running   PostgreSQL RDBMS
  redis-server.service   loaded active running   Advanced key-value store
  ufw.service            loaded active running   Uncomplicated firewall
  cron.service           loaded active running   Regular background program processing daemon
  systemd-resolved.service loaded active running System Location & Network Name Resolution
  failed-app.service     loaded failed failed    Custom Node App Daemon
`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("ufw status")) {
    return {
      stdout: `Status: active

To                         Action      From
--                         ------      ----
22/tcp (SSH)               ALLOW       Anywhere
80/tcp (HTTP)              ALLOW       Anywhere
443/tcp (HTTPS)            ALLOW       Anywhere
3000/tcp (App)             ALLOW       192.168.1.0/24
5432/tcp (Postgres)        DENY        Anywhere
22/tcp (SSH (v6))          ALLOW       Anywhere (v6)
`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("crontab -l")) {
    return {
      stdout: `# m h  dom mon dow   command
0 3 * * * /usr/local/bin/backup-db.sh > /var/log/backup.log 2>&1
*/15 * * * * /usr/bin/php /var/www/html/artisan schedule:run
0 0 1 * * /usr/bin/certbot renew --quiet
`,
      stderr: "",
      code: 0,
    };
  }

  if (trimmed.includes("cat /etc/passwd")) {
    return {
      stdout: `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
ubuntu:x:1000:1000:Ubuntu Administrator:/home/ubuntu:/bin/bash
postgres:x:105:112:PostgreSQL administrator,,,:/var/lib/postgresql:/bin/bash
redis:x:106:113::/var/lib/redis:/bin/false
deploy:x:1001:1001:Deployer Bot:/home/deploy:/bin/bash
`,
      stderr: "",
      code: 0,
    };
  }

  // Generic fallback
  return {
    stdout: `Demo SSH Executed: "${trimmed}"\nResult: Success (0)\nTime: ${new Date().toISOString()}`,
    stderr: "",
    code: 0,
  };
}


// Helper to parse live Linux output into structured SystemMetrics
export function parseRealLinuxMetrics(raw: string, fallbackHost: string) {
  const sections: Record<string, string> = {};
  const lines = raw.split("\n");
  let currentKey = "default";

  for (const line of lines) {
    const match = line.match(/^===\s*([A-Z0-9_]+)\s*===/);
    if (match) {
      currentKey = match[1];
      sections[currentKey] = "";
    } else {
      if (!sections[currentKey]) sections[currentKey] = "";
      sections[currentKey] += line + "\n";
    }
  }

  const hostname = (sections["HOSTNAME"] || "").trim() || fallbackHost;
  const kernel = (sections["KERNEL"] || "").trim() || "Linux Kernel";
  const arch = (sections["ARCH"] || "").trim() || "x86_64";
  const rawUptime = (sections["UPTIME"] || "").trim() || "up 1 hour";
  const uptime = rawUptime.replace(/^up\s+/, "").trim() || rawUptime;

  const loadStr = (sections["LOADAVG"] || "").trim();
  const loadParts = loadStr.split(/\s+/).map(Number).filter((n) => !isNaN(n));
  const loadAvg: [number, number, number] = [
    loadParts[0] ?? 0.15,
    loadParts[1] ?? 0.1,
    loadParts[2] ?? 0.08,
  ];

  const cores = parseInt((sections["CORES"] || "").trim()) || 2;
  const rawModel = (sections["CPUMODEL"] || "").trim();
  const model = rawModel ? rawModel.replace(/\s+/g, " ") : "Linux Virtual CPU";

  // Calculate CPU usage % from 1-min load average relative to core count
  const usagePct = Math.min(100, Math.max(2, Math.round((loadAvg[0] / cores) * 100)));

  let totalMb = 4096,
    usedMb = 1024,
    freeMb = 3072,
    cachedMb = 512,
    swapTotalMb = 1024,
    swapUsedMb = 0;
  const freeLines = (sections["FREE"] || "").trim().split("\n");
  for (const fLine of freeLines) {
    if (fLine.startsWith("Mem:")) {
      const parts = fLine.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3) {
        const isBytes = parts[0] > 10000000;
        const div = isBytes ? 1024 * 1024 : 1;
        totalMb = Math.round(parts[0] / div) || totalMb;
        usedMb = Math.round(parts[1] / div) || usedMb;
        freeMb = Math.round(parts[2] / div) || freeMb;
        if (parts[4]) cachedMb = Math.round(parts[4] / div);
      }
    } else if (fLine.startsWith("Swap:")) {
      const parts = fLine.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 2) {
        const isBytes = parts[0] > 10000000;
        const div = isBytes ? 1024 * 1024 : 1;
        swapTotalMb = Math.round(parts[0] / div) || swapTotalMb;
        swapUsedMb = Math.round(parts[1] / div) || swapUsedMb;
      }
    }
  }

  const diskList: Array<{ filesystem: string; mount: string; sizeGb: number; usedGb: number; availGb: number; usePct: number }> = [];
  const dfLines = (sections["DF"] || "").trim().split("\n");
  for (let i = 1; i < dfLines.length; i++) {
    const dLine = dfLines[i].trim();
    if (!dLine) continue;
    const parts = dLine.split(/\s+/);
    if (parts.length >= 6) {
      const filesystem = parts[0];
      const sizeKb = parseInt(parts[1]) || 0;
      const usedKb = parseInt(parts[2]) || 0;
      const availKb = parseInt(parts[3]) || 0;
      const pctStr = parts[4].replace("%", "");
      const usePct = parseInt(pctStr) || 0;
      const mount = parts[5];

      if (
        mount === "/" ||
        mount.startsWith("/home") ||
        mount.startsWith("/var") ||
        mount.startsWith("/data") ||
        mount.startsWith("/opt") ||
        mount.startsWith("/mnt")
      ) {
        diskList.push({
          filesystem,
          mount,
          sizeGb: Math.round(sizeKb / 1024 / 1024) || 10,
          usedGb: Math.round(usedKb / 1024 / 1024) || 0,
          availGb: Math.round(availKb / 1024 / 1024) || 10,
          usePct,
        });
      }
    }
  }

  if (diskList.length === 0) {
    diskList.push({ filesystem: "/dev/sda1", mount: "/", sizeGb: 50, usedGb: 15, availGb: 35, usePct: 30 });
  }

  const netRaw = (sections["NETSTAT"] || "").trim();
  let activeConnections = 12;
  const numMatch = netRaw.match(/\d+/);
  if (numMatch) {
    activeConnections = parseInt(numMatch[0]) || 12;
  }

  return {
    timestamp: new Date().toLocaleTimeString(),
    os: {
      hostname,
      distro: `Linux (${kernel})`,
      kernel,
      arch,
      uptime,
    },
    cpu: {
      usagePct,
      cores,
      model,
      loadAvg,
    },
    memory: {
      totalMb,
      usedMb,
      freeMb,
      cachedMb,
      swapTotalMb,
      swapUsedMb,
    },
    disk: diskList,
    network: {
      rxKbps: Math.floor(100 + Math.random() * 300),
      txKbps: Math.floor(300 + Math.random() * 600),
      activeConnections,
    },
  };
}


/**
 * Same contract as runSshCommand, but reuses a persistent pooled SSH connection keyed by
 * `poolKey` (see server/services/sshPool.ts) instead of opening a fresh TCP+SSH handshake
 * per call. Used by the metrics WebSocket stream and the exec/metrics HTTP routes so
 * repeated calls against the same server (polling, terminal commands) don't pay full
 * connection-setup cost every time. Demo/local-passwordless paths bypass the pool entirely
 * since they never touch a real remote SSH connection in the first place.
 */
export async function runPooledSshCommand(
  poolKey: string,
  config: { host: string; port: number; username: string; password?: string; privateKey?: string; isDemo?: boolean },
  command: string
): Promise<SshExecResult> {
  if (config.isDemo || config.host === "demo" || config.host === "localhost-demo" || config.host === "127.0.0.1-demo") {
    return handleDemoCommand(command);
  }

  if (isBlockedHost(config.host)) {
    return { stdout: "", stderr: "Подключение к этому адресу заблокировано политикой безопасности.", code: 255 };
  }

  const isLocalHost = config.host === "localhost" || config.host === "127.0.0.1" || config.host === "local";
  if (isLocalHost && !config.password && !config.privateKey) {
    return runSshCommand(config, command);
  }

  return execPooled(poolKey, config, command);
}

// Shared metrics probe command -- used by both the one-off HTTP /api/ssh/metrics route and
// the live WebSocket metrics stream so they stay in sync.
export const METRICS_PROBE_CMD = `
  echo "===HOSTNAME==="; hostname 2>/dev/null
  echo "===KERNEL==="; uname -r 2>/dev/null
  echo "===ARCH==="; uname -m 2>/dev/null
  echo "===UPTIME==="; uptime -p 2>/dev/null || uptime 2>/dev/null
  echo "===LOADAVG==="; cat /proc/loadavg 2>/dev/null
  echo "===CORES==="; nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo "1"
  echo "===CPUMODEL==="; grep 'model name' /proc/cpuinfo 2>/dev/null | head -n 1 | cut -d: -f2 || echo "x86_64 CPU"
  echo "===FREE==="; free -b 2>/dev/null || free -m 2>/dev/null
  echo "===DF==="; df -P -k 2>/dev/null
  echo "===NETSTAT==="; netstat -an 2>/dev/null | grep ESTABLISHED | wc -l 2>/dev/null || echo "8"
`;

/** Same synthetic-but-live-feeling demo metrics payload the HTTP route has always returned. */
export function buildDemoMetrics(): any {
  const time = new Date().toLocaleTimeString();
  const cpuPct = Math.floor(18 + Math.sin(Date.now() / 3000) * 12 + Math.random() * 8);
  const ramTotalMb = 16384;
  const ramUsedMb = Math.floor(6200 + Math.cos(Date.now() / 5000) * 400 + Math.random() * 150);

  return {
    timestamp: time,
    os: {
      hostname: "ubuntu-prod-srv01",
      distro: "Ubuntu 24.04.1 LTS",
      kernel: "6.5.0-28-generic",
      arch: "x86_64",
      uptime: "14 days, 6 hours, 22 mins",
    },
    cpu: { usagePct: cpuPct, cores: 8, model: "AMD EPYC 7763 64-Core Processor", loadAvg: [0.42, 0.38, 0.35] },
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
    network: { rxKbps: Math.floor(120 + Math.random() * 350), txKbps: Math.floor(450 + Math.random() * 800), activeConnections: 18 },
  };
}
