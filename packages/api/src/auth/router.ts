import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { asyncHandler, unauthorized } from "../lib/errors.js";
import { requireAuth } from "./middleware.js";

// Identity comes from Home Assistant; there is no local login.
const router = Router();
router.use(requireAuth);

const userSelect = { id: true, email: true, name: true, avatarUrl: true } as const;

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await db.user.findUnique({ where: { id: req.userId! }, select: userSelect });
    if (!user) throw unauthorized();
    res.json(user);
  }),
);

const updateMeSchema = z.object({
  avatarUrl: z.string().url().nullish(),
});

router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const data = updateMeSchema.parse(req.body);
    const user = await db.user.update({ where: { id: req.userId! }, data, select: userSelect });
    res.json(user);
  }),
);

export default router;
