import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { asyncHandler } from "../lib/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { requirePageAccess } from "../workspaces/access.js";

const router = Router();
router.use(requireAuth);

const blockInputSchema = z.object({
  id: z.string(),
  type: z.string(),
  content: z.any(),
  textContent: z.string().default(""),
  position: z.string(),
  parentBlockId: z.string().nullish(),
});

const bulkSchema = z.object({
  blocks: z.array(blockInputSchema),
});

router.put(
  "/pages/:id/blocks",
  asyncHandler(async (req, res) => {
    await requirePageAccess(req.userId!, req.params.id, "EDITOR");
    const { blocks } = bulkSchema.parse(req.body);

    await db.$transaction(async (tx) => {
      const existing = await tx.block.findMany({
        where: { pageId: req.params.id },
        select: { id: true },
      });
      const incomingIds = new Set(blocks.map((b) => b.id));
      const toDelete = existing.filter((b) => !incomingIds.has(b.id)).map((b) => b.id);
      if (toDelete.length) {
        await tx.block.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const b of blocks) {
        await tx.block.upsert({
          where: { id: b.id },
          update: {
            type: b.type,
            content: b.content ?? {},
            textContent: b.textContent,
            position: b.position,
            parentBlockId: b.parentBlockId ?? null,
          },
          create: {
            id: b.id,
            pageId: req.params.id,
            type: b.type,
            content: b.content ?? {},
            textContent: b.textContent,
            position: b.position,
            parentBlockId: b.parentBlockId ?? null,
          },
        });
      }
      await tx.page.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
    });

    res.json({ ok: true });
  }),
);

export default router;
