// GET /api/og?id=<productId> — Open Graph + Product JSON-LD for a product.
//
// A pure client-rendered SPA gives empty link previews, and the design leans
// on shared product links (the Share button, coupon QR codes). This route
// answers crawlers with a tiny HTML document carrying og:title, og:image and
// schema.org Product data, instead of the whole app.
//
// Human visitors keep the SPA URL (see ProductDetail's share button); wiring
// bot-only middleware to serve this response for known crawler user agents is
// the next step, and is deliberately not done here so a mistake cannot hide
// the store from shoppers.

import { getDb } from "./_core/serverDb.js";

function baseUrl(req) {
  return (process.env.SITE_URL ?? `https://${req.headers?.host ?? "localhost"}`).replace(/\/+$/, "");
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const id = String(req.query?.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "BAD_ID" });

  try {
    const db = getDb();
    let productSnap = await db.doc(`products_egp/${id}`).get();
    if (!productSnap.exists) {
      const bySlug = await db.collection("products_egp").where("slug", "==", id).limit(1).get();
      if (!bySlug.empty) productSnap = bySlug.docs[0];
    }
    if (!productSnap.exists || productSnap.data().status !== "active") {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const product = productSnap.data();
    const base = baseUrl(req);
    const path = product.slug ?? productSnap.id;

    const title = product.title?.en ?? product.title?.ar ?? "Product";
    const description = String(product.description?.en ?? product.description?.ar ?? "").slice(0, 200);
    const image = product.images?.[0]?.url ?? null;
    const price = Number(product.price ?? 0);

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title,
      description,
      image: image ? [image] : [],
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: "EGP",
        availability: Number(product.totalStock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `${base}/product/${path}`
      }
    };

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${base}/product/${escapeHtml(path)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta property="product:price:amount" content="${price}">
<meta property="product:price:currency" content="EGP">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body></body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
    return res.status(200).send(html);
  } catch (error) {
    console.error("og build failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
