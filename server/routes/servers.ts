import { Router } from "express";
import { body, param } from "express-validator";
import crypto from "crypto";
import { db, withDb, DbServerProfile } from "../db.js";
import { encryptSecret, decryptSecret } from "../crypto.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, checkValidation, AppError } from "../middleware/errorHandler.js";
import { audit } from "../services/audit.js";

export const serversRouter = Router();

export const DEMO_SERVER_ID = "demo-server-01";

export const DEMO_SERVER_PUBLIC = {
  id: DEMO_SERVER_ID,
  name: "Ubuntu Production (Demo)",
  host: "demo",
  port: 22,
  username: "ubuntu",
  authType: "password" as const,
  color: "emerald",
  isDemo: true,
  tags: ["Production", "Web", "Ubuntu 24.04"],
  hasPassword: true,
  hasPrivateKey: false,
};

function toPublicProfile(p: DbServerProfile) {
  return {
    id: p.id,
    name: p.name,
    host: p.host,
    port: p.port,
    username: p.username,
    authType: p.authType,
    color: p.color,
    tags: p.tags || [],
    isDemo: false,
    lastConnected: p.lastConnected,
    hasPassword: !!p.encPassword,
    hasPrivateKey: !!p.encPrivateKey,
  };
}

serversRouter.use(requireAuth);

serversRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await db.read();
    const mine = db.data.servers.filter((s) => s.ownerId === req.user!.userId);
    res.json([DEMO_SERVER_PUBLIC, ...mine.map(toPublicProfile)]);
  })
);

const upsertValidators = [
  body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Название обязательно (до 100 символов)"),
  body("host").trim().isLength({ min: 1, max: 255 }).withMessage("Хост обязателен"),
  body("port").optional().isInt({ min: 1, max: 65535 }).withMessage("Порт должен быть 1-65535"),
  body("username").trim().isLength({ min: 1, max: 64 }).withMessage("Имя пользователя обязательно"),
  body("authType").isIn(["password", "key"]).withMessage("authType должен быть password или key"),
];

serversRouter.post(
  "/",
  upsertValidators,
  checkValidation,
  asyncHandler(async (req, res) => {
    const { id, name, host, port, username, authType, password, privateKey, color, tags } = req.body;

    if (id === DEMO_SERVER_ID) {
      throw new AppError("Демо-профиль нельзя изменить", 403);
    }

    const result = await withDb((data) => {
      let profile: DbServerProfile;
      const existingIdx = id ? data.servers.findIndex((s) => s.id === id && s.ownerId === req.user!.userId) : -1;

      if (existingIdx >= 0) {
        profile = data.servers[existingIdx];
        profile.name = name;
        profile.host = host;
        profile.port = Number(port) || 22;
        profile.username = username;
        profile.authType = authType;
        profile.color = color;
        profile.tags = tags || [];
        profile.updatedAt = new Date().toISOString();
        if (password) profile.encPassword = encryptSecret(password);
        if (privateKey) profile.encPrivateKey = encryptSecret(privateKey);
        if (authType === "password") profile.encPrivateKey = undefined;
        if (authType === "key") profile.encPassword = undefined;
      } else {
        profile = {
          id: "srv-" + crypto.randomUUID(),
          ownerId: req.user!.userId,
          name,
          host,
          port: Number(port) || 22,
          username,
          authType,
          color,
          tags: tags || [],
          encPassword: password ? encryptSecret(password) : undefined,
          encPrivateKey: privateKey ? encryptSecret(privateKey) : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        data.servers.push(profile);
      }
      return profile;
    });

    await audit(req, "server.save", { serverId: result.id, serverHost: result.host, success: true });
    res.json(toPublicProfile(result));
  })
);

serversRouter.delete(
  "/:id",
  param("id").isString(),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (id === DEMO_SERVER_ID) {
      throw new AppError("Демо-профиль нельзя удалить", 403);
    }
    await withDb((data) => {
      data.servers = data.servers.filter((s) => !(s.id === id && s.ownerId === req.user!.userId));
    });
    await audit(req, "server.delete", { serverId: id, success: true });
    res.json({ success: true });
  })
);

/** Resolves decrypted SSH connection params for a server owned by the given user. */
export async function resolveServerConnection(
  serverId: string,
  userId: string
): Promise<{ host: string; port: number; username: string; password?: string; privateKey?: string; isDemo?: boolean; name: string }> {
  if (serverId === DEMO_SERVER_ID) {
    return { host: "demo", port: 22, username: "ubuntu", isDemo: true, name: DEMO_SERVER_PUBLIC.name };
  }
  await db.read();
  const profile = db.data.servers.find((s) => s.id === serverId && s.ownerId === userId);
  if (!profile) {
    throw new AppError("Профиль сервера не найден", 404);
  }
  return {
    host: profile.host,
    port: profile.port,
    username: profile.username,
    password: profile.encPassword ? decryptSecret(profile.encPassword) : undefined,
    privateKey: profile.encPrivateKey ? decryptSecret(profile.encPrivateKey) : undefined,
    name: profile.name,
  };
}
