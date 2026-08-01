import { Router } from "express";
import { body } from "express-validator";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler, checkValidation, AppError } from "../middleware/errorHandler.js";
import { sshExecLimiter, sshTestLimiter } from "../middleware/rateLimit.js";
import {
  runSshCommand,
  runPooledSshCommand,
  parseRealLinuxMetrics,
  isBlockedHostAsync,
  METRICS_PROBE_CMD,
  buildDemoMetrics,
} from "../services/sshService.js";
import { poolKey } from "../services/sshPool.js";
import { applyAccurateRates } from "../services/metricsRateTracker.js";
import { resolveServerConnection, DEMO_SERVER_ID } from "./servers.js";
import { audit } from "../services/audit.js";

export const sshRouter = Router();
sshRouter.use(requireAuth);

// Ad-hoc connection test used by the "Add Server" modal BEFORE the profile is saved.
// Credentials here are never persisted -- they exist only for the duration of this request.
sshRouter.post(
  "/test-connection",
  requireRole("admin", "operator"),
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

    if (await isBlockedHostAsync(host)) {
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
  requireRole("admin", "operator"),
  sshExecLimiter,
  [body("serverId").isString().isLength({ min: 1 }), body("command").isString().isLength({ min: 1, max: 20000 })],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { serverId, command } = req.body;
    const conn = await resolveServerConnection(serverId, req.user!.userId);
    // Pooled connection: repeated exec calls against the same server reuse one live SSH
    // session instead of paying a fresh TCP+SSH handshake every time.
    const result = await runPooledSshCommand(poolKey(req.user!.userId, serverId), conn, command);
    await audit(req, "ssh.exec", {
      serverId,
      serverHost: conn.host,
      command: command.length > 500 ? command.slice(0, 500) + "…" : command,
      success: result.code === 0,
    });
    res.json(result);
  })
);

// One-off metrics fetch -- kept for initial fast paint before the live WebSocket
// (/ws/metrics/:serverId) takes over. See server/services/wsMetrics.ts for the streaming path.
sshRouter.post(
  "/metrics",
  [body("serverId").isString().isLength({ min: 1 })],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { serverId } = req.body;
    const conn = await resolveServerConnection(serverId, req.user!.userId);

    if (conn.isDemo || serverId === DEMO_SERVER_ID) {
      return res.json(buildDemoMetrics());
    }

    const result = await runPooledSshCommand(poolKey(req.user!.userId, serverId), conn, METRICS_PROBE_CMD);
    if (result.code !== 0) {
      await audit(req, "ssh.metrics", { serverId, serverHost: conn.host, success: false, detail: result.stderr });
      throw new AppError(result.stderr || "Не удалось получить метрики по SSH", 500);
    }

    const parsedMetrics = parseRealLinuxMetrics(result.stdout, conn.name || conn.host);
    applyAccurateRates(poolKey(req.user!.userId, serverId), parsedMetrics);
    res.json(parsedMetrics);
  })
);
