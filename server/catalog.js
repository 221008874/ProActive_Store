// GET /api/catalog — the whole active catalogue in a handful of document
// reads, cached at the CDN.
//
// The storefront used to read every product document per visit, which burns
// the entire free daily Firestore quota at a few hundred visits. This route
// reads only the snapshot shards and lets the CDN absorb the traffic; the
// freshness cost (card-level stock) can lag by the rebuild cooldown, and every
// money/stock decision still reads live documents at checkout.
//
// It also keeps the snapshot fresh. Vercel's Hobby plan only runs crons once a
// day, so the rebuild loop lives here: a CDN miss checks the dirty flag (one
// read) and, when a rebuild is due, patches the changed products into the
// shards they already live in. See refreshSnapshotIfStale for the cost maths.

import { getDb } from "./_core/serverDb.js";
import { readSnapshot, refreshSnapshotIfStale } from "./_core/catalogCore.js";

const CACHE = "s-maxage=300, stale-while-revalidate=600";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const db = getDb();

    // Only reached on a CDN miss, so this is the natural place to spend a read
    // on freshness. It never throws: a failed rebuild still serves the last
    // good snapshot below.
    await refreshSnapshotIfStale(db);

    const snapshot = await readSnapshot(db);
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
