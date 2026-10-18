import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest } from "../lib/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { env } from "../env.js";

const router = Router();
router.use(requireAuth);

const previewSchema = z.object({ url: z.string().url() });

function pickMeta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

router.get(
  "/bookmark/preview",
  asyncHandler(async (req, res) => {
    const { url } = previewSchema.parse(req.query);
    const resp = await fetch(url, {
      headers: { "User-Agent": "NotionishBot/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) throw badRequest("Could not fetch URL");
    const html = await resp.text();
    const title =
      pickMeta(html, "og:title") ??
      pickMeta(html, "twitter:title") ??
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
      null;
    const description =
      pickMeta(html, "og:description") ??
      pickMeta(html, "twitter:description") ??
      pickMeta(html, "description");
    const image = pickMeta(html, "og:image") ?? pickMeta(html, "twitter:image");
    const parsed = new URL(url);
    const favicon = `${parsed.origin}/favicon.ico`;
    res.json({ url, title, description, image, favicon });
  }),
);

router.get(
  "/unsplash/search",
  asyncHandler(async (req, res) => {
    if (!env.UNSPLASH_ACCESS_KEY) {
      return res.json({ results: [] });
    }
    const q = (req.query.q as string) || "abstract";
    const resp = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=24`,
      { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } },
    );
    if (!resp.ok) return res.json({ results: [] });
    const data = (await resp.json()) as { results: Array<{ id: string; urls: { regular: string; thumb: string }; user: { name: string } }> };
    res.json({
      results: data.results.map((r) => ({
        id: r.id,
        url: r.urls.regular,
        thumb: r.urls.thumb,
        credit: r.user.name,
      })),
    });
  }),
);

export default router;
