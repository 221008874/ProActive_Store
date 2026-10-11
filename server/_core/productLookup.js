// Product resolution for the routes that address products from outside the
// app: document id (internal links) or slug (sitemap, share links, QR codes).
//
// A slug miss costs one extra collection read, which is why the id path is
// tried first; slugs are unique in practice (the admin enforces it on save).

export async function findProduct(db, idOrSlug) {
  const value = String(idOrSlug ?? "").trim();
  if (!value) return null;

  const direct = await db.doc(`products_egp/${value}`).get();
  if (direct.exists) return direct;

  const bySlug = await db.collection("products_egp").where("slug", "==", value).limit(1).get();
  return bySlug.empty ? null : bySlug.docs[0];
}

// The product plus its live variants; null when the product is missing or is
// not active (drafts and archived items must never resolve from a link).
export async function findPublicProduct(db, idOrSlug) {
  const snap = await findProduct(db, idOrSlug);
  if (!snap || snap.data().status !== "active") return null;

  const variantsSnap = await db.collection(`products_egp/${snap.id}/variants`).get();
  const variants = variantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { id: snap.id, ...snap.data(), variants };
}
