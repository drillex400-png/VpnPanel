import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { CONFIG } from "./server/config.js";
import { generalApiLimiter } from "./server/middleware/rateLimit.js";
import { errorHandler } from "./server/middleware/errorHandler.js";
import { authRouter } from "./server/routes/auth.js";
import { serversRouter } from "./server/routes/servers.js";
import { sshRouter } from "./server/routes/ssh.js";
import { aiRouter } from "./server/routes/ai.js";

const app = express();

// Security headers. CSP is relaxed for the Vite dev-injected inline scripts/styles used by
// the SPA shell; tighten further once a strict nonce-based CSP is wired into the build.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: CONFIG.ALLOWED_ORIGINS.length > 0 ? CONFIG.ALLOWED_ORIGINS : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use("/api", generalApiLimiter);

// === API ROUTES ===
app.use("/api/auth", authRouter);
app.use("/api/servers", serversRouter);
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

  app.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`Linux Mobile Cockpit Server running on http://0.0.0.0:${CONFIG.PORT}`);
  });
}

startServer();
