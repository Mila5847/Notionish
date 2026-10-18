import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { db } from "../db.js";
import { env } from "../env.js";
import { asyncHandler, badRequest, notFound } from "../lib/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { requireWorkspaceRole } from "../workspaces/access.js";

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post(
  "/workspaces/:workspaceId/files",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.userId!, req.params.workspaceId, "EDITOR");
    if (!req.file) throw badRequest("No file uploaded");

    const workspaceDir = path.join(env.UPLOAD_DIR, req.params.workspaceId);
    await fs.mkdir(workspaceDir, { recursive: true });
    const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const relPath = path.join(req.params.workspaceId, safeName);
    const absPath = path.join(env.UPLOAD_DIR, relPath);
    await fs.writeFile(absPath, req.file.buffer);

    const asset = await db.asset.create({
      data: {
        workspaceId: req.params.workspaceId,
        uploaderId: req.userId!,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        path: relPath,
      },
    });
    res.json({
      id: asset.id,
      filename: asset.filename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      // Relative so it resolves under the Home Assistant ingress sub-path too.
      url: `files/${asset.id}`,
    });
  }),
);

router.get(
  "/files/:id",
  asyncHandler(async (req, res) => {
    const asset = await db.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) throw notFound("Asset");
    await requireWorkspaceRole(req.userId!, asset.workspaceId, "VIEWER");
    const absPath = path.join(env.UPLOAD_DIR, asset.path);
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Content-Length", asset.sizeBytes);
    createReadStream(absPath).pipe(res);
  }),
);

export default router;
