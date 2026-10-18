import type { Role } from "@prisma/client";
import { db } from "../db.js";
import { forbidden, notFound } from "../lib/errors.js";

const rank: Record<Role, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

export async function requireWorkspaceRole(userId: string, workspaceId: string, min: Role) {
  const m = await db.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!m) throw notFound("Workspace");
  if (rank[m.role] < rank[min]) throw forbidden(`Requires ${min}`);
  return m;
}

export async function requirePageAccess(userId: string, pageId: string, min: Role) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, workspaceId: true },
  });
  if (!page) throw notFound("Page");
  await requireWorkspaceRole(userId, page.workspaceId, min);
  return page;
}
