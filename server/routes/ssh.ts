import { Router } from "express";
import { body } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, checkValidation, AppError } from "../middleware/errorHandler.js";
import { sshExecLimiter, sshTestLimiter } from "../middleware/rateLimit.js";
import { runSshCommand, parseRealLinuxMetrics, isBlockedHost } from "../services/sshService.js";
import { resolveServerConnection, DEMO_SERVER_ID } from "./servers.js";
import { audit } from "../services/audit.js";

export const sshRouter = Router();
sshRouter.use(requireAuth);

// Ad-hoc connection test used by the "Add Server" modal BEFORE the profile is saved.
// Credentials here are never persisted -- they exist only for the duration of this request.
sshRouter.post(
  "/test-connection",
  sshTestLimiter,
  [
    body("host").trim().isLength({ min: 1, max: 255 }),
    body("username").trim().isLength({ min: 1, max: 64 }),
    body("port").optional().isInt({ min: 1, max: 65535 }),
  ],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { host, port, username, password, privateKey } = req.body;

    if (host === "demo" || String(host).includes("demo")) {
      return res.json({ success: true, message: "Подключено к демо-серверу (Ubuntu 24.04 LTS)", latencyMs: 12 });
    }

    if (isBlockedHost(host)) {
      throw new AppError("Подключение к этому адресу запрещено политикой безопасности", 400);
    }

    const start = Date.now();
    const result = await runSshCommand(
      { host, port: Number(port) || 22, username, password, privateKey },
      "uname -a && uptime"
    );

    await audit(req, "ssh.test-connection", { serverHost: host, success: result.code === 0 });

    if (result.code === 0) {
      return res.json({ success: true, message: "SSH-аутентификация успешна", output: result.stdout, latencyMs: Date.now() - start });
    }
    res.status(400).json({ success: false, error: result.stderr || "Не удалось подключиться по SSH" });
  })
);

sshRouter.post(
  "/exec",
  sshExecLimiter,
  [body("serverId").isString().isLength({ min: 1 }), body("command").isString().isLength({ min: 1, max: 20000 })],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { serverId, command } = req.body;
    const conn = await resolveServerConnection(serverId, req.user!.userId);
    const result = await runSshCommand(conn, command);
    await audit(req, "ssh.exec", {
      serverId,
      serverHost: conn.host,
      command: command.length > 500 ? command.slice(0, 500) + "…" : command,
      success: result.code === 0,
    });
    res.json(result);
  })
);

sshRouter.post(
  "/metrics",
  [body("serverId").isString().isLength({ min: 1 })],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { serverId } = req.body;
    const conn = await resolveServerConnection(serverId, req.user!.userId);

    if (conn.isDemo || serverId === DEMO_SERVER_ID) {
      const time = new Date().toLocaleTimeString();
      const cpuPct = Math.floor(18 + Math.sin(Date.now() / 3000) * 12 + Math.random() * 8);
      const ramTotalMb = 16384;
      const ramUsedMb = Math.floor(6200 + Math.cos(Date.now() / 5000) * 400 + Math.random() * 150);

      return res.json({
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
      });
    }

    const cmd = `
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

    const result = await runSshCommand(conn, cmd);
    if (result.code !== 0) {
      await audit(req, "ssh.metrics", { serverId, serverHost: conn.host, success: false, detail: result.stderr });
      throw new AppError(result.stderr || "Не удалось получить метрики по SSH", 500);
    }

    const parsedMetrics = parseRealLinuxMetrics(result.stdout, conn.name || conn.host);
    res.json(parsedMetrics);
  })
);
