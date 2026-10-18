import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { asyncHandler, badRequest, notFound } from "../lib/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { requirePageAccess, requireWorkspaceRole } from "../workspaces/access.js";
import { positionBetween } from "../lib/position.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/pages",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.workspaceId, "VIEWER");
    const pages = await db.page.findMany({
      where: { workspaceId: req.params.workspaceId, archivedAt: null },
      select: {
        id: true,
        parentPageId: true,
        type: true,
        title: true,
        icon: true,
        position: true,
        updatedAt: true,
      },
      orderBy: [{ parentPageId: "asc" }, { position: "asc" }],
    });
    res.json(pages);
  }),
);

router.get(
  "/workspaces/:workspaceId/trash",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.workspaceId, "VIEWER");
    const pages = await db.page.findMany({
      where: { workspaceId: req.params.workspaceId, archivedAt: { not: null } },
      select: { id: true, title: true, icon: true, archivedAt: true },
      orderBy: { archivedAt: "desc" },
    });
    res.json(pages);
  }),
);

router.get(
  "/workspaces/:workspaceId/favorites",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.workspaceId, "VIEWER");
    const favs = await db.favorite.findMany({
      where: {
        userId: req.userId!,
        page: { workspaceId: req.params.workspaceId, archivedAt: null },
      },
      include: {
        page: {
          select: { id: true, title: true, icon: true, type: true, parentPageId: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(favs.map((f) => f.page));
  }),
);

const createSchema = z.object({
  workspaceId: z.string(),
  parentPageId: z.string().nullish(),
  type: z.enum(["PAGE", "FOLDER"]).default("PAGE"),
  title: z.string().default(""),
});

router.post(
  "/pages",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await requireWorkspaceRole(req.userId!, input.workspaceId, "EDITOR");
    if (input.parentPageId) {
      const parent = await db.page.findUnique({ where: { id: input.parentPageId } });
      if (!parent || parent.workspaceId !== input.workspaceId) throw badRequest("Invalid parent page");
    }
    const last = await db.page.findFirst({
      where: {
        workspaceId: input.workspaceId,
        parentPageId: input.parentPageId ?? null,
        archivedAt: null,
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = positionBetween(last?.position ?? null, null);

    const page = await db.$transaction(async (tx) => {
      const created = await tx.page.create({
        data: {
          workspaceId: input.workspaceId,
          parentPageId: input.parentPageId ?? null,
          type: input.type,
          title: input.title,
          position,
          createdById: req.userId!,
        },
      });
      await tx.block.create({
        data: {
          pageId: created.id,
          type: "paragraph",
          content: { type: "paragraph", content: [] },
          textContent: "",
          position: positionBetween(null, null),
        },
      });
      return created;
    });
    res.json(page);
  }),
);

router.get(
  "/pages/:id",
  asyncHandler(async (req, res) => {
    const access = await requirePageAccess(req.userId!, req.params.id, "VIEWER");
    const page = await db.page.findUnique({
      where: { id: access.id },
      include: {
        blocks: { orderBy: { position: "asc" } },
      },
    });
    if (!page) throw notFound("Page");
    res.json(page);
  }),
);

const updateSchema = z.object({
  title: z.string().optional(),
  icon: z.string().nullish(),
  coverUrl: z.string().nullish(),
});

router.patch(
  "/pages/:id",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    const data = updateSchema.parse(req.body);
    const page = await db.page.update({ where: { id: req.params.id }, data });
    res.json(page);
  }),
);

const moveSchema = z.object({
  parentPageId: z.string().nullish(),
  beforePageId: z.string().nullish(),
  afterPageId: z.string().nullish(),
});

router.post(
  "/pages/:id/move",
  asyncHandler(async (req, res) => {
    const page = await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    const input = moveSchema.parse(req.body);
    const newParentId = input.parentPageId ?? null;

    if (newParentId) {
      const parent = await db.page.findUnique({ where: { id: newParentId } });
      if (!parent || parent.workspaceId !== page.workspaceId) throw badRequest("Invalid parent");
      let cursor: string | null = parent.parentPageId;
      while (cursor) {
        if (cursor === page.id) throw badRequest("Cannot move page into its own descendant");
        const next = await db.page.findUnique({
          where: { id: cursor },
          select: { parentPageId: true },
        });
        cursor = next?.parentPageId ?? null;
      }
    }

    let prevPos: string | null = null;
    let nextPos: string | null = null;
    if (input.beforePageId) {
      const b = await db.page.findUnique({ where: { id: input.beforePageId }, select: { position: true } });
      nextPos = b?.position ?? null;
    }
    if (input.afterPageId) {
      const a = await db.page.findUnique({ where: { id: input.afterPageId }, select: { position: true } });
      prevPos = a?.position ?? null;
    }
    if (!input.beforePageId && !input.afterPageId) {
      const last = await db.page.findFirst({
        where: { workspaceId: page.workspaceId, parentPageId: newParentId, archivedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      prevPos = last?.position ?? null;
    }

    const position = positionBetween(prevPos, nextPos);
    const updated = await db.page.update({
      where: { id: page.id },
      data: { parentPageId: newParentId, position },
    });
    res.json(updated);
  }),
);

async function deepDuplicate(pageId: string, workspaceId: string, parentPageId: string | null, position: string, userId: string): Promise<string> {
  const src = await db.page.findUnique({
    where: { id: pageId },
    include: { blocks: true, children: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
  });
  if (!src) throw notFound("Page");
  const copy = await db.page.create({
    data: {
      workspaceId,
      parentPageId,
      type: src.type,
      title: src.title ? `${src.title} (copy)` : "",
      icon: src.icon,
      coverUrl: src.coverUrl,
      position,
      createdById: userId,
    },
  });
  for (const b of src.blocks) {
    await db.block.create({
      data: {
        pageId: copy.id,
        parentBlockId: null,
        type: b.type,
        content: b.content ?? {},
        textContent: b.textContent,
        position: b.position,
      },
    });
  }
  for (const child of src.children) {
    await deepDuplicate(child.id, workspaceId, copy.id, child.position, userId);
  }
  return copy.id;
}

router.post(
  "/pages/:id/duplicate",
  asyncHandler(async (req, res) => {
    const page = await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    const src = await db.page.findUnique({ where: { id: page.id } });
    if (!src) throw notFound("Page");
    const last = await db.page.findFirst({
      where: { workspaceId: page.workspaceId, parentPageId: src.parentPageId, archivedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = positionBetween(last?.position ?? null, null);
    const newId = await deepDuplicate(page.id, page.workspaceId, src.parentPageId, position, req.userId!);
    res.json({ id: newId });
  }),
);

router.post(
  "/pages/:id/archive",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    await db.page.update({ where: { id: req.params.id }, data: { archivedAt: new Date() } });
    res.json({ ok: true });
  }),
);

router.post(
  "/pages/:id/restore",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    await db.page.update({ where: { id: req.params.id }, data: { archivedAt: null } });
    res.json({ ok: true });
  }),
);

router.delete(
  "/pages/:id",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    await db.page.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.post(
  "/pages/:id/favorite",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "VIEWER");
    await db.favorite.upsert({
      where: { userId_pageId: { userId: req.userId!, pageId: req.params.id } },
      update: {},
      create: { userId: req.userId!, pageId: req.params.id },
    });
    res.json({ ok: true });
  }),
);

router.delete(
  "/pages/:id/favorite",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "VIEWER");
    await db.favorite.deleteMany({ where: { userId: req.userId!, pageId: req.params.id } });
    res.json({ ok: true });
  }),
);

export default router;
