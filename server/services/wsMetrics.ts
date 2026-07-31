import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { CONFIG } from "../config.js";
import type { AuthTokenPayload } from "../middleware/auth.js";
import { resolveServerConnection, DEMO_SERVER_ID } from "../routes/servers.js";
import { runPooledSshCommand, parseRealLinuxMetrics, METRICS_PROBE_CMD, buildDemoMetrics } from "./sshService.js";
import { poolKey } from "./sshPool.js";

const METRICS_INTERVAL_MS = 4000;
const WS_PATH_RE = /^\/ws\/metrics\/([A-Za-z0-9_-]+)$/;

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

    let payload: AuthTokenPayload;
    try {
      payload = jwt.verify(token, CONFIG.JWT_SECRET) as AuthTokenPayload;
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
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

    const stop = () => {
      closed = true;
      clearInterval(timer);
    };
    ws.on("close", stop);
    ws.on("error", stop);
  });

  return wss;
}
