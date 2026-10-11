// GET /sitemap.xml — product and category URLs for crawlers.
//
// Built from the same snapshot the storefront reads, so it costs a handful of
// document reads and is cached at the CDN for an hour.

import { getDb } from "./_core/serverDb.js";
import { readSnapshot } from "./_core/catalogCore.js";

function baseUrl(req) {
  return (process.env.SITE_URL ?? `https://${req.headers?.host ?? "localhost"}`).replace(/\/+$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const snapshot = await readSnapshot(getDb());
    if (!snapshot) {
      return res.status(503).json({ error: "SNAPSHOT_NOT_BUILT" });
    }

    const base = baseUrl(req);
    const urls = [];

    urls.push({ loc: `${base}/`, changefreq: "daily", priority: "1.0" });

    // Products are addressable by slug (/product/<slug>) or id; slug is the
    // canonical shareable form. Category URLs are deliberately absent: the
    // storefront has no /category route yet, and advertising a URL that
    // soft-404s is worse for crawlers than not listing it.
    for (const product of snapshot.products ?? []) {
      const path = product.slug ?? product.id;
      urls.push({ loc: `${base}/product/${path}`, changefreq: "daily", priority: "0.7" });
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  )
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
    return res.status(200).send(body);
  } catch (error) {
    console.error("sitemap build failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
