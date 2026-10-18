import type { NextFunction, Request, Response } from "express";
import { verifySession } from "../lib/jwt.js";
import { unauthorized } from "../lib/errors.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.session as string | undefined;
  if (!token) return next(unauthorized());
  try {
    const { userId } = verifySession(token);
    req.userId = userId;
    next();
  } catch {
    next(unauthorized("Invalid session"));
  }
}
