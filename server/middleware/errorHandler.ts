import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Wraps an async route handler so rejected promises reach the error handler. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Runs express-validator checks and short-circuits with 400 if any failed. */
export function checkValidation(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Ошибка валидации данных", details: errors.array() });
  }
  next();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("[ERROR]", req.method, req.path, "-", err?.message || err);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json({
    error: err?.message || "Внутренняя ошибка сервера",
  });
}
