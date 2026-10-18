import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface SessionPayload {
  userId: string;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null || typeof (decoded as any).userId !== "string") {
    throw new Error("Invalid session token");
  }
  return { userId: (decoded as any).userId };
}
