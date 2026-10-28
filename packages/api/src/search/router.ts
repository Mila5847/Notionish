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
    // SQLite's LIKE folds only ASCII, so Cyrillic is matched here, case-insensitively.
    const needle = q.toLocaleLowerCase();
    const matches = (text: string) => text.toLocaleLowerCase().includes(needle);

    const pages = (
      await db.page.findMany({
        where: { workspaceId: req.params.workspaceId, archivedAt: null },
        select: { id: true, title: true, icon: true, parentPageId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      })
    )
      .filter((p) => matches(p.title))
      .slice(0, 20);

    const blocks = (
      await db.block.findMany({
        where: { page: { workspaceId: req.params.workspaceId, archivedAt: null } },
        select: {
          id: true,
          pageId: true,
          textContent: true,
          page: { select: { title: true, icon: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    )
      .filter((b) => matches(b.textContent))
      .slice(0, 20);

    res.json({ pages, blocks });
  }),
);

export default router;
