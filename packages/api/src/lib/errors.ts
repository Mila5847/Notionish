import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, "BAD_REQUEST");
export const unauthorized = (msg = "Unauthorized") => new HttpError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Forbidden") => new HttpError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found") => new HttpError(404, msg, "NOT_FOUND");
export const conflict = (msg: string) => new HttpError(409, msg, "CONFLICT");

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "VALIDATION", issues: err.issues });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code ?? "ERROR", message: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "INTERNAL", message: "Internal server error" });
}
