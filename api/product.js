// GET /api/product?id=<productId> — full product plus every variant with
// live stock. Short cache: this is the page that must not lie about
// availability, and it is the only catalogue read most sessions need.

import { getDb } from "./_core/serverDb.js";

const CACHE = "s-maxage=15, stale-while-revalidate=60";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const id = String(req.query?.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "BAD_ID" });

  try {
    const db = getDb();

    // Document id first (the app's internal links), slug second (the URLs the
    // sitemap and share links advertise). A slug query is a collection read,
    // so it only runs when the id lookup misses.
    let productSnap = await db.doc(`products_egp/${id}`).get();
    if (!productSnap.exists) {
      const bySlug = await db
        .collection("products_egp")
        .where("slug", "==", id)
        .limit(1)
        .get();
      if (!bySlug.empty) productSnap = bySlug.docs[0];
    }

    if (!productSnap.exists || productSnap.data().status !== "active") {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const variantsSnap = await db.collection(`products_egp/${productSnap.id}/variants`).get();
    const variants = variantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json({ id: productSnap.id, ...productSnap.data(), variants });
  } catch (error) {
    console.error("product read failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
