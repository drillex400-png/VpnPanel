import express from "express";
import path from "path";
import http from "http";
import helmet from "helmet";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { CONFIG } from "./server/config.js";
import { generalApiLimiter } from "./server/middleware/rateLimit.js";
import { errorHandler } from "./server/middleware/errorHandler.js";
import { authRouter } from "./server/routes/auth.js";
import { serversRouter } from "./server/routes/servers.js";
import { usersRouter } from "./server/routes/users.js";
import { sshRouter } from "./server/routes/ssh.js";
import { aiRouter } from "./server/routes/ai.js";
import { attachMetricsWebSocket } from "./server/services/wsMetrics.js";

const app = express();

// Security headers. In dev, Vite's HMR client needs inline scripts/eval and a websocket
// connection back to itself, so CSP stays relaxed there. In production the app is a
// pre-built static SPA bundle (no inline scripts, no eval) served same-origin, so we apply
// a real CSP -- only Google Fonts (loaded from index.html) need explicit allow-listing.
const isProd = CONFIG.NODE_ENV === "production";
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "wss:", "ws:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    // Reflecting any Origin with credentials:true lets any malicious site an authenticated
    // user visits make authenticated cross-origin requests to this API (e.g. run SSH
    // commands on their servers). Frontend and backend are served same-origin here, so cross-
    // origin API access is only needed for explicitly configured external consumers. Default
    // to permissive only in dev for local tooling convenience; production requires an
    // explicit ALLOWED_ORIGINS allow-list, denying cross-origin requests otherwise.
    origin: CONFIG.ALLOWED_ORIGINS.length > 0 ? CONFIG.ALLOWED_ORIGINS : !isProd,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use("/api", generalApiLimiter);

// === API ROUTES ===
app.use("/api/auth", authRouter);
app.use("/api/servers", serversRouter);
app.use("/api/users", usersRouter);
app.use("/api/ssh", sshRouter);
app.use("/api/ai", aiRouter);

// Centralized error handler (must be registered after all routes)
app.use(errorHandler);

// Start Express & Vite Middleware setup
async function startServer() {
  // Vite middleware for dev
  if (CONFIG.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Use a raw http.Server (instead of app.listen's implicit one) so the WebSocket metrics
  // stream can attach to the same listener and share the port with the HTTP/Vite traffic.
  const httpServer = http.createServer(app);
  attachMetricsWebSocket(httpServer);

  httpServer.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`Linux Mobile Cockpit Server running on http://0.0.0.0:${CONFIG.PORT}`);
    console.log(`Live metrics WebSocket available at ws://0.0.0.0:${CONFIG.PORT}/ws/metrics/:serverId`);
  });
}

startServer();
