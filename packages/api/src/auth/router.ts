import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { env } from "../env.js";
import { asyncHandler, badRequest, conflict, notFound, unauthorized } from "../lib/errors.js";
import { signSession } from "../lib/jwt.js";
import { requireAuth } from "./middleware.js";

const router = Router();

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.PUBLIC_ORIGIN.startsWith("https://"),
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, name } = registerSchema.parse(req.body);
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw conflict("Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, passwordHash },
      });
      const workspace = await tx.workspace.create({
        data: { name: `${name}'s workspace` },
      });
      await tx.membership.create({
        data: { userId: created.id, workspaceId: workspace.id, role: "OWNER" },
      });
      return created;
    });

    res.cookie("session", signSession({ userId: user.id }), cookieOpts);
    res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl });
  }),
);

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw unauthorized("Invalid credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid credentials");
    res.cookie("session", signSession({ userId: user.id }), cookieOpts);
    res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie("session", { path: "/" });
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (!user) throw unauthorized();
    res.json(user);
  }),
);

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().nullish(),
});

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateMeSchema.parse(req.body);
    const user = await db.user.update({
      where: { id: req.userId! },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    res.json(user);
  }),
);

const changePasswordSchema = z.object({
  current: z.string(),
  next: z.string().min(8),
});

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { current, next } = changePasswordSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw notFound("User");
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) throw badRequest("Current password is incorrect");
    const passwordHash = await bcrypt.hash(next, 10);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  }),
);

export default router;
