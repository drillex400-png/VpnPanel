import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";

function keyByUserOrIp(req: Request): string {
  return req.user?.userId || ipKeyGenerator(req.ip || "unknown");
}

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "unknown"),
  message: { error: "Слишком много попыток входа. Повторите через минуту." },
});

export const sshExecLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Превышен лимит запросов к SSH. Подождите немного." },
});

export const sshTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Слишком много попыток подключения. Подождите немного." },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Превышен лимит запросов к ИИ-ассистенту. Подождите немного." },
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
});
