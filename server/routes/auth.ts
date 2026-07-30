import { Router } from "express";
import { body } from "express-validator";
import crypto from "crypto";
import { db, withDb } from "../db.js";
import { hashPassword, verifyPassword } from "../crypto.js";
import { generateToken, requireAuth } from "../middleware/auth.js";
import { asyncHandler, checkValidation, AppError } from "../middleware/errorHandler.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { audit } from "../services/audit.js";

export const authRouter = Router();

// Public: tells the frontend whether an initial admin account still needs to be created.
authRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    await db.read();
    res.json({ setupRequired: db.data.users.length === 0 });
  })
);

const credentialsValidators = [
  body("email").isEmail().withMessage("Введите корректный email").normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("Пароль должен быть не менее 8 символов"),
];

// One-time setup: creates the first admin account. Locked once any user exists.
authRouter.post(
  "/setup",
  authLimiter,
  credentialsValidators,
  checkValidation,
  asyncHandler(async (req, res) => {
    await db.read();
    if (db.data.users.length > 0) {
      throw new AppError("Настройка уже была выполнена. Используйте вход.", 403);
    }
    const { email, password } = req.body;
    const passwordHash = await hashPassword(password);
    const user = {
      id: "user-" + crypto.randomUUID(),
      email,
      passwordHash,
      role: "admin" as const,
      createdAt: new Date().toISOString(),
    };
    await withDb((data) => {
      data.users.push(user);
    });

    const token = generateToken(user);
    await audit(req, "auth.setup", { success: true, detail: email });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  })
);

authRouter.post(
  "/login",
  authLimiter,
  credentialsValidators,
  checkValidation,
  asyncHandler(async (req, res) => {
    await db.read();
    const { email, password } = req.body;
    const user = db.data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());

    if (!user) {
      await audit(req, "auth.login", { success: false, detail: `unknown email: ${email}` });
      throw new AppError("Неверный email или пароль", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await audit(req, "auth.login", { success: false, detail: `bad password for: ${email}` });
      throw new AppError("Неверный email или пароль", 401);
    }

    await withDb((data) => {
      const u = data.users.find((x) => x.id === user.id);
      if (u) u.lastLoginAt = new Date().toISOString();
    });

    const token = generateToken(user);
    await audit(req, "auth.login", { success: true, detail: email });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    await db.read();
    const user = db.data.users.find((u) => u.id === req.user!.userId);
    if (!user) throw new AppError("Пользователь не найден", 404);
    res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
  })
);
