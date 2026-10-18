import type { Request } from "express";
import { db } from "../db.js";
import { env } from "../env.js";
import { HttpError } from "../lib/errors.js";

export const HA_EMAIL_DOMAIN = "homeassistant.local";

interface HaIdentity {
  id: string;
  username: string;
  displayName: string;
}

// Home Assistant identity (id + names, so renames re-sync) -> Notionish user id
const cache = new Map<string, string>();

const haAuthError = (msg: string) => new HttpError(401, msg, "HA_AUTH");

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function isFromSupervisor(req: Request): boolean {
  const ip = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  return ip === env.HA_SUPERVISOR_IP;
}

function identify(req: Request): HaIdentity {
  if (env.NODE_ENV === "development" && env.DEV_HA_USER) {
    return { id: `dev-${env.DEV_HA_USER}`, username: env.DEV_HA_USER, displayName: env.DEV_HA_USER };
  }
  if (!isFromSupervisor(req)) throw haAuthError("Requests must come through Home Assistant ingress");

  const id = header(req, "x-remote-user-id");
  if (!id) throw haAuthError("Home Assistant did not provide a user");
  const username = header(req, "x-remote-user-name") ?? id;
  return { id, username, displayName: header(req, "x-remote-user-display-name") ?? username };
}

export function emailForUsername(username: string): string {
  return `${username.toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@${HA_EMAIL_DOMAIN}`;
}

/**
 * Resolves the Notionish user for a request proxied by Home Assistant ingress.
 * The Supervisor adds X-Remote-User-* headers after Home Assistant has
 * authenticated the browser; users are created on first visit and kept in sync
 * with their Home Assistant name.
 */
export async function resolveIngressUser(req: Request): Promise<string> {
  const ha = identify(req);
  const cacheKey = `${ha.id}\n${ha.username}\n${ha.displayName}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const email = emailForUsername(ha.username);
  const existing = await db.user.findUnique({ where: { haUserId: ha.id } });

  let userId: string;
  if (existing) {
    if (existing.name !== ha.displayName || existing.email !== email) {
      await db.user.update({ where: { id: existing.id }, data: { name: ha.displayName, email } });
    }
    userId = existing.id;
  } else {
    userId = await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { haUserId: ha.id, email, name: ha.displayName } });
      const workspace = await tx.workspace.create({ data: { name: `${ha.displayName}'s workspace` } });
      await tx.membership.create({
        data: { userId: created.id, workspaceId: workspace.id, role: "OWNER" },
      });
      return created.id;
    });
  }

  cache.set(cacheKey, userId);
  return userId;
}
