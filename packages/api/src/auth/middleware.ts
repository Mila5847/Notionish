import type { NextFunction, Request, Response } from "express";
import { resolveIngressUser } from "./homeassistant.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  resolveIngressUser(req).then((userId) => {
    req.userId = userId;
    next();
  }, next);
}
