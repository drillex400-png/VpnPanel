import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CONFIG } from "../config.js";
import { DbUser } from "../db.js";

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: DbUser["role"];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function generateToken(user: Pick<DbUser, "id" | "email" | "role">): string {
  const payload: AuthTokenPayload = { userId: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRY as any });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, CONFIG.JWT_SECRET) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Недействительный или истёкший токен" });
  }
}

/** Restricts a route to specific roles. Must run after requireAuth. */
export function requireRole(...roles: DbUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Недостаточно прав для этого действия" });
    }
    next();
  };
}
