import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { asyncHandler, badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { requireWorkspaceRole } from "./access.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const memberships = await db.membership.findMany({
      where: { userId: req.userId! },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        iconUrl: m.workspace.iconUrl,
        role: m.role,
      })),
    );
  }),
);

const createSchema = z.object({ name: z.string().min(1) });

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name } = createSchema.parse(req.body);
    const ws = await db.$transaction(async (tx) => {
      const created = await tx.workspace.create({ data: { name } });
      await tx.membership.create({
        data: { userId: req.userId!, workspaceId: created.id, role: "OWNER" },
      });
      return created;
    });
    res.json({ id: ws.id, name: ws.name, iconUrl: ws.iconUrl, role: "OWNER" });
  }),
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  iconUrl: z.string().url().nullish(),
});

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.id, "OWNER");
    const data = updateSchema.parse(req.body);
    const ws = await db.workspace.update({ where: { id: req.params.id }, data });
    res.json(ws);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.id, "OWNER");
    await db.workspace.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.id, "VIEWER");
    const members = await db.membership.findMany({
      where: { workspaceId: req.params.id },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
      })),
    );
  }),
);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]),
});

router.post(
  "/:id/members",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.id, "OWNER");
    const { email, role } = inviteSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw notFound("No user with that email. Ask them to register first.");
    const existing = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: req.params.id } },
    });
    if (existing) throw conflict("User is already a member");
    const m = await db.membership.create({
      data: { userId: user.id, workspaceId: req.params.id, role },
    });
    res.json({ userId: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: m.role });
  }),
);

const roleSchema = z.object({ role: z.enum(["OWNER", "EDITOR", "VIEWER"]) });

router.patch(
  "/:id/members/:userId",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.id, "OWNER");
    const { role } = roleSchema.parse(req.body);
    if (req.params.userId === req.userId && role !== "OWNER") {
      const owners = await db.membership.count({
        where: { workspaceId: req.params.id, role: "OWNER" },
      });
      if (owners <= 1) throw badRequest("Workspace must have at least one owner");
    }
    const m = await db.membership.update({
      where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } },
      data: { role },
    });
    res.json({ userId: m.userId, role: m.role });
  }),
);

router.delete(
  "/:id/members/:userId",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.id, "OWNER");
    if (req.params.userId === req.userId) {
      const owners = await db.membership.count({
        where: { workspaceId: req.params.id, role: "OWNER" },
      });
      if (owners <= 1) throw badRequest("Cannot remove the last owner");
    }
    await db.membership.delete({
      where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } },
    });
    res.json({ ok: true });
  }),
);

export default router;
