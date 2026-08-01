import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { CONFIG } from "../config.js";
import type { AuthTokenPayload } from "../middleware/auth.js";
import { resolveServerConnection, DEMO_SERVER_ID } from "../routes/servers.js";
import { runPooledSshCommand, parseRealLinuxMetrics, METRICS_PROBE_CMD, buildDemoMetrics } from "./sshService.js";
import { poolKey } from "./sshPool.js";
import { applyAccurateRates } from "./metricsRateTracker.js";

const METRICS_INTERVAL_MS = 4000;
const WS_PATH_RE = /^\/ws\/metrics\/([A-Za-z0-9_-]+)$/;

// Without any cap, a buggy client (a leaked tab, a reconnect loop that never actually closes
// the old socket) or a malicious one could open an unbounded number of sockets -- each running
// its own 4s SSH-poll interval -- until the process runs out of memory/file descriptors or the
// SSH pool is saturated. These are generous ceilings for legitimate usage (many
// tabs/servers open at once) while still bounding worst-case resource use.
const MAX_TOTAL_CONNECTIONS = 300;
const MAX_CONNECTIONS_PER_USER = 20;

// A client that vanishes without a clean TCP close (laptop lid closed, network drop, mobile
// app backgrounded) never fires the 'close' event on the server side -- the socket would sit
// open (and its metrics-poll interval would keep running) indefinitely. Standard `ws` idiom:
// ping every connection periodically and terminate any that didn't pong back since the last
// ping.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// The WS upgrade path is handled directly on the raw http.Server 'upgrade' event, so it never
// passes through Express routing and isn't covered by generalApiLimiter. A minimal sliding-
// window per-IP counter closes that gap against a handshake-flood.
const UPGRADE_WINDOW_MS = 60 * 1000;
const UPGRADE_MAX_PER_IP = 30;
const upgradeAttempts = new Map<string, number[]>();

function isUpgradeRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (upgradeAttempts.get(ip) || []).filter((t) => now - t < UPGRADE_WINDOW_MS);
  recent.push(now);
  upgradeAttempts.set(ip, recent);
  // Bound the map itself so IPs that only ever connect once don't accumulate forever.
  if (upgradeAttempts.size > 5000) {
    for (const [key, times] of upgradeAttempts) {
      if (times.every((t) => now - t > UPGRADE_WINDOW_MS)) upgradeAttempts.delete(key);
    }
  }
  return recent.length > UPGRADE_MAX_PER_IP;
}

/**
 * Live metrics stream over WebSocket, replacing the previous 4s HTTP poll from the frontend.
 * The backend pushes a fresh metrics snapshot every 4s using a *pooled* SSH connection
 * (server/services/sshPool.ts), so as long as the socket is open there's exactly one live SSH
 * session per server being reused -- not a new handshake per tick like the old poll caused.
 *
 * Auth: browsers can't set custom headers on the WS handshake, so the JWT is passed as a
 * `?token=` query param and verified during the HTTP Upgrade before the socket is accepted.
 */
export function attachMetricsWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Per-user connection accounting for MAX_CONNECTIONS_PER_USER enforcement.
  const connectionsByUser = new Map<string, Set<WebSocket>>();
  let totalConnections = 0;

  server.on("upgrade", (req, socket, head) => {
    let pathname: string;
    let token: string;
    try {
      const url = new URL(req.url || "", "http://localhost");
      pathname = url.pathname;
      token = url.searchParams.get("token") || "";
    } catch {
      socket.destroy();
      return;
    }

    const match = WS_PATH_RE.exec(pathname);
    if (!match) {
      // Not a path we own -- leave the socket alone in case something else handles upgrades.
      return;
    }

    const remoteIp = req.socket.remoteAddress || "unknown";
    if (isUpgradeRateLimited(remoteIp)) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }

    let payload: AuthTokenPayload;
    try {
      payload = jwt.verify(token, CONFIG.JWT_SECRET) as AuthTokenPayload;
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    const userConnections = connectionsByUser.get(payload.userId);
    if (userConnections && userConnections.size >= MAX_CONNECTIONS_PER_USER) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }

    const serverId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { userId: payload.userId, serverId });
    });
  });

  wss.on("connection", (ws: WebSocket, _req, ctx: { userId: string; serverId: string }) => {
    let closed = false;
    let inFlight = false;
    let isAlive = true;

    totalConnections += 1;
    let userSet = connectionsByUser.get(ctx.userId);
    if (!userSet) {
      userSet = new Set();
      connectionsByUser.set(ctx.userId, userSet);
    }
    userSet.add(ws);

    ws.on("pong", () => {
      isAlive = true;
    });

    const tick = async () => {
      if (closed || inFlight || ws.readyState !== WebSocket.OPEN) return;
      inFlight = true;
      try {
        const conn = await resolveServerConnection(ctx.serverId, ctx.userId);

        if (conn.isDemo || ctx.serverId === DEMO_SERVER_ID) {
          ws.send(JSON.stringify(buildDemoMetrics()));
          return;
        }

        const key = poolKey(ctx.userId, ctx.serverId);
        const result = await runPooledSshCommand(key, conn, METRICS_PROBE_CMD);

        if (result.code !== 0) {
          ws.send(JSON.stringify({ error: result.stderr || "Не удалось получить метрики по SSH" }));
          return;
        }

        const parsed = parseRealLinuxMetrics(result.stdout, conn.name || conn.host);
        applyAccurateRates(key, parsed);
        ws.send(JSON.stringify(parsed));
      } catch (e: any) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: e?.message || "Ошибка получения метрик" }));
        }
      } finally {
        inFlight = false;
      }
    };

    tick();
    const timer = setInterval(tick, METRICS_INTERVAL_MS);

    // Ping this socket periodically; if it didn't pong back since the last ping, it's
    // presumed dead (no clean TCP close was ever received) and gets forcibly terminated.
    const heartbeat = setInterval(() => {
      if (!isAlive) {
        heartbeatStop();
        stop();
        ws.terminate();
        return;
      }
      isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore
      }
    }, HEARTBEAT_INTERVAL_MS);
    const heartbeatStop = () => clearInterval(heartbeat);

    const stop = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      heartbeatStop();
      totalConnections = Math.max(0, totalConnections - 1);
      const set = connectionsByUser.get(ctx.userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) connectionsByUser.delete(ctx.userId);
      }
    };
    ws.on("close", stop);
    ws.on("error", stop);
  });

  return wss;
}
