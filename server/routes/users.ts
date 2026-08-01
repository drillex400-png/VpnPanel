import { Router } from "express";
import { body, param } from "express-validator";
import crypto from "crypto";
import { db, withDb, DbUser } from "../db.js";
import { hashPassword } from "../crypto.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler, checkValidation, AppError } from "../middleware/errorHandler.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { audit } from "../services/audit.js";

/**
 * Team/user management -- admin-only. This is what makes the `role` field on DbUser
 * (admin/operator/viewer, already enforced by requireRole on servers/ssh routes) actually
 * usable: previously there was NO way to create any account other than the very first
 * admin via POST /api/auth/setup, so "operator"/"viewer" existed only as unused schema
 * values. This gives an admin a way to add teammates with a restricted role.
 *
 * Team members share visibility into the same server profiles (see servers.ts, which was
 * scoped per-owner before and is now workspace-wide) -- that's the only model that makes
 * "operator"/"viewer" meaningful: they need to see and act on the SAME servers the admin
 * manages, not their own private empty list.
 */
export const usersRouter = Router();
usersRouter.use(requireAuth);

function toPublicUser(u: DbUser) {
  return { id: u.id, email: u.email, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
}

// List all team members. Admin-only -- an operator/viewer doesn't need to enumerate
// teammates, and email addresses are the closest thing to PII this app stores.
usersRouter.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await db.read();
    res.json(db.data.users.map(toPublicUser));
  })
);

const createValidators = [
  body("email").isEmail().withMessage("Введите корректный email").normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("Пароль должен быть не менее 8 символов"),
  body("role").isIn(["admin", "operator", "viewer"]).withMessage("Роль должна быть admin, operator или viewer"),
];

// Admin creates a teammate account directly (no email/SMTP configured in this project,
// so this is a direct-create flow, not an email invite link).
usersRouter.post(
  "/",
  authLimiter,
  requireRole("admin"),
  createValidators,
  checkValidation,
  asyncHandler(async (req, res) => {
    await db.read();
    const { email, password, role } = req.body;
    if (db.data.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      throw new AppError("Пользователь с таким email уже существует", 409);
    }
    const passwordHash = await hashPassword(password);
    const user: DbUser = {
      id: "user-" + crypto.randomUUID(),
      email,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    await withDb((data) => {
      data.users.push(user);
    });
    await audit(req, "user.create", { success: true, detail: `${email} (${role})` });
    res.json(toPublicUser(user));
  })
);

// Change a teammate's role. Admin-only, and an admin cannot demote themselves --
// prevents an admin from accidentally locking themselves (and everyone else) out of
// admin-only actions with no other admin left to fix it.
usersRouter.patch(
  "/:id/role",
  requireRole("admin"),
  [param("id").isString(), body("role").isIn(["admin", "operator", "viewer"])],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (id === req.user!.userId && role !== "admin") {
      throw new AppError("Нельзя понизить собственную роль администратора", 400);
    }

    await db.read();
    const target = db.data.users.find((u) => u.id === id);
    if (!target) throw new AppError("Пользователь не найден", 404);

    if (target.role === "admin" && role !== "admin") {
      const otherAdmins = db.data.users.filter((u) => u.role === "admin" && u.id !== id);
      if (otherAdmins.length === 0) {
        throw new AppError("Нельзя понизить последнего администратора команды", 400);
      }
    }

    const updated = await withDb((data) => {
      const u = data.users.find((x) => x.id === id)!;
      u.role = role;
      return u;
    });

    await audit(req, "user.role_change", { success: true, detail: `${updated.email} -> ${role}` });
    res.json(toPublicUser(updated));
  })
);

// Remove a teammate. Admin-only; cannot delete yourself or the last remaining admin.
usersRouter.delete(
  "/:id",
  requireRole("admin"),
  [param("id").isString()],
  checkValidation,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (id === req.user!.userId) {
      throw new AppError("Нельзя удалить собственную учётную запись", 400);
    }

    await db.read();
    const target = db.data.users.find((u) => u.id === id);
    if (!target) throw new AppError("Пользователь не найден", 404);

    if (target.role === "admin") {
      const otherAdmins = db.data.users.filter((u) => u.role === "admin" && u.id !== id);
      if (otherAdmins.length === 0) {
        throw new AppError("Нельзя удалить последнего администратора команды", 400);
      }
    }

    await withDb((data) => {
      data.users = data.users.filter((u) => u.id !== id);
    });
    await audit(req, "user.delete", { success: true, detail: target.email });
    res.json({ success: true });
  })
);
