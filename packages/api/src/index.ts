import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
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

app.use(
  cors({
    origin: env.PUBLIC_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

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
