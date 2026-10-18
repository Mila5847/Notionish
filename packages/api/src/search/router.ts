import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { asyncHandler } from "../lib/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { requireWorkspaceRole } from "../workspaces/access.js";

const router = Router();
router.use(requireAuth);

const querySchema = z.object({ q: z.string().min(1) });

router.get(
  "/workspaces/:workspaceId/search",
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.workspaceId, "VIEWER");
    const { q } = querySchema.parse(req.query);
    const like = `%${q}%`;

    const pages = await db.page.findMany({
      where: {
        workspaceId: req.params.workspaceId,
        archivedAt: null,
        title: { contains: q },
      },
      select: { id: true, title: true, icon: true, parentPageId: true, updatedAt: true },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    const blocks = await db.block.findMany({
      where: {
        page: { workspaceId: req.params.workspaceId, archivedAt: null },
        textContent: { contains: q },
      },
      select: {
        id: true,
        pageId: true,
        textContent: true,
        page: { select: { title: true, icon: true } },
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    void like;
    res.json({ pages, blocks });
  }),
);

export default router;
