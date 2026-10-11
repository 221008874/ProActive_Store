// GET /api/product?id=<productId|slug> — full product plus every variant with
// live stock. Short cache: this is the page that must not lie about
// availability, and it is the only catalogue read most sessions need.
//
// Accepts the document id (the app's own links) or the slug (the URLs the
// sitemap and share links advertise).

import { getDb } from "./_core/serverDb.js";
import { findPublicProduct } from "./_core/productLookup.js";

const CACHE = "s-maxage=15, stale-while-revalidate=60";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const id = String(req.query?.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "BAD_ID" });

  try {
    const product = await findPublicProduct(getDb(), id);
    if (!product) return res.status(404).json({ error: "NOT_FOUND" });

    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json(product);
  } catch (error) {
    console.error("product read failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
