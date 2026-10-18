import express from "express";
import path from "node:path";
import { env } from "./env.js";
import { errorHandler } from "./lib/errors.js";
import authRouter from "./auth/router.js";
import workspacesRouter from "./workspaces/router.js";
import pagesRouter from "./pages/router.js";
import blocksRouter from "./blocks/router.js";
import assetsRouter from "./assets/router.js";
import searchRouter from "./search/router.js";
import utilRouter from "./util/bookmark.js";

const app = express();

app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

if (env.WEB_DIST) {
  const webDist = path.resolve(env.WEB_DIST);
  app.use(
    express.static(webDist, {
      setHeaders: (res, file) => {
        res.setHeader(
          "Cache-Control",
          file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-store",
        );
      },
    }),
  );
}

app.use("/auth", authRouter);
app.use("/workspaces", workspacesRouter);
app.use(pagesRouter);
app.use(blocksRouter);
app.use(assetsRouter);
app.use(searchRouter);
app.use(utilRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`api listening on :${env.PORT}`);
});
