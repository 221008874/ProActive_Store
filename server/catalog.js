// GET /api/catalog — the whole active catalogue in a handful of document
// reads, cached at the CDN.
//
// The storefront used to read every product document per visit, which burns
// the entire free daily Firestore quota at a few hundred visits. This route
// reads only the snapshot shards and lets the CDN absorb the traffic; the
// freshness cost (card-level stock) is bounded by the cache TTL and every
// money/stock decision still reads live documents.

import { getDb } from "./_core/serverDb.js";
import { readSnapshot } from "./_core/catalogCore.js";

const CACHE = "s-maxage=300, stale-while-revalidate=600";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const snapshot = await readSnapshot(getDb());
    if (!snapshot) {
      // No build yet: tell the client to fall back to direct reads rather
      // than pretending the store is empty.
      return res.status(503).json({ error: "SNAPSHOT_NOT_BUILT" });
    }

    const etag = `"catalog-${snapshot.version}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", CACHE);
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error("catalog read failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
