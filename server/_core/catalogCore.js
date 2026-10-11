// Catalog snapshot: build, store and serve a slim copy of the whole active
// catalogue instead of letting every visitor read every product document.
//
//   reads per day = visits × products            (raw documents)
//   reads per day = shards × cache refreshes     (snapshot)
//
// The snapshot is a cache, not a source of truth: prices and stock shown from
// it can lag by the cache TTL, which is why checkout always re-reads live
// documents and placeOrder re-validates everything it charges for.
//
// Freshness has two shapes, because a full rebuild is expensive on the free
// tier (it reads every product AND every variant subcollection):
//
//   full build      products + all variants + reference data. Run by the admin
//                   "publish" route and by the nightly cron.
//   partial build   only the products whose `updatedAt` moved since the last
//                   build, patched into the shards that hold them. Run on the
//                   visitor path when a build is due, behind a cooldown.
//
// The `updatedAt` stamp is what makes the partial build safe: every writer that
// touches stock or catalogue fields (placeOrder, the admin routes) must move
// it, or the change waits for the nightly full build instead.

export const SHARD_SIZE = 150;
export const META_DOC = "catalog_snapshots/meta";
export const FLAG_DOC = "egp_settings/catalog";
export const PRODUCTS_COLLECTION = "products_egp";

// How long the catalogue route waits between rebuild attempts once something
// has marked the snapshot dirty. Vercel's Hobby plan only runs crons once a
// day, so freshness has to come from the read path; the cooldown is what keeps
// that affordable (see refreshSnapshotIfStale for the arithmetic).
export const REBUILD_COOLDOWN_MS = 30 * 60 * 1000;

// Above this many products the shardIndex in meta stops paying for itself (the
// map grows with the catalogue) and a full build is cheaper than reasoning
// about it. 2000 products is far beyond this store's needs.
export const MAX_SHARD_INDEX_PRODUCTS = 2000;

// The shardIndex is rebuilt from the card list on every full build. It maps a
// product id to the shard holding its card, which is what lets a partial build
// touch only the shards that actually changed.

// Arabic-aware fold for search. Applied when a product document carries no
// searchText of its own, so a lint at search time matches what the admin
// typed: "فستان" should find "فُسْتان" and "فساتان".
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function normalizeSearchText(title, tags = []) {
  const parts = [];

  const push = (value) => {
    if (value == null) return;
    if (typeof value === "object") {
      push(value.ar);
      push(value.en);
      return;
    }
    parts.push(String(value));
  };

  push(title);
  for (const tag of Array.isArray(tags) ? tags : []) push(tag);

  return parts
    .join(" ")
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\u0640/g, "") // tatweel
    .replace(/[\u0623\u0625\u0622]/g, "\u0627") // أ إ آ -> ا
    .replace(/\u0649/g, "\u064a") // ى -> ي
    .replace(/\u0629/g, "\u0647") // ة -> ه
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ٠-٩ -> 0-9
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹ -> 0-9
    .replace(/\s+/g, " ")
    .trim();
}

// One field list per variant. The product page needs enough to pick a colour
// and a size, show what is left, and price the line; anything else the admin
// stored on the variant (cost, barcode, notes) stays out of the public cache.
// Only these fields, so a private or internal variant field can never leak into
// a document the CDN serves to every visitor.
export function slimVariant(variant, id) {
  return {
    id,
    colorId: variant.colorId ?? null,
    color: variant.color ?? null,
    size: variant.size ?? null,
    stock: Number(variant.stock ?? 0),
    active: variant.active !== false,
    priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride),
    image: variant.image ?? null
  };
}

// One field list: a card is only as fat as the design system's product grid
// and product page need. Anything not listed here is not part of the public
// catalogue cache.
//
// `variants` are the slimmed variant rows read from the product's `variants`
// subcollection during the build. They are included so the product page can
// render colour/size/stock without reading Firestore at all; the live check
// still happens at checkout, where the money is decided.
export function slimCard(product, id, variants = []) {
  return {
    id,
    title: product.title ?? null,
    slug: product.slug ?? null,
    price: Number(product.price ?? 0),
    compareAtPrice: product.compareAtPrice ?? null,
    discountPct: Number(product.discountPct ?? 0),
    isNew: product.isNew === true,
    gender: product.gender ?? null,
    categoryId: product.categoryId ?? null,
    categoryPath: Array.isArray(product.categoryPath) ? product.categoryPath : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
    images: (product.images ?? []).slice(0, 2).map((img) => ({ url: img?.url ?? null, color: img?.color ?? null })),
    availableColors: Array.isArray(product.availableColors) ? product.availableColors : [],
    availableSizes: Array.isArray(product.availableSizes) ? product.availableSizes : [],
    totalStock: Number(product.totalStock ?? 0),
    soldCount: Number(product.soldCount ?? 0),
    searchText: product.searchText ? String(product.searchText) : normalizeSearchText(product.title, product.tags),
    createdAt: product.createdAt ?? null,
    variants: (Array.isArray(variants) ? variants : []).map((v) => slimVariant(v.data ? v.data() : v, v.id))
  };
}

// Shards are capped so no document approaches Firestore's 1 MiB limit, and
// each carries the version it was built with so a stale CDN copy can never
// be mixed with a newer one.
export function shardProducts(cards, version) {
  const shards = [];
  for (let i = 0; i < cards.length; i += SHARD_SIZE) {
    shards.push({ id: `cards_${shards.length + 1}`, version, products: cards.slice(i, i + SHARD_SIZE) });
  }
  // An empty catalogue still needs one (empty) shard so readers have a
  // deterministic list rather than a magic zero case.
  if (shards.length === 0) shards.push({ id: "cards_1", version, products: [] });
  return shards;
}

// Settings are public: the snapshot is served to everyone, so nothing that
// is not already visible on the storefront may ride along (no counters, no
// rate-limit tuning). minimumOrderAmount is included because the bag shows the
// effective minimum for the chosen governorate and falls back to it.
export function publicSettings(settings = {}) {
  return {
    storeName: settings.storeName ?? null,
    whatsapp: settings.whatsapp ?? null,
    freeShippingThreshold: Number(settings.freeShippingThreshold ?? 0),
    announcement: settings.announcement ?? null,
    ordersOpen: settings.ordersOpen !== false,
    minimumOrderAmount: Number(settings.minimumOrderAmount ?? 0),
    currency: settings.currency ?? "EGP"
  };
}

// Pure part of the build: everything except the database reads/writes.
// Returns the version it stamped, the shard documents to write, and the
// metadata document contents.
export function buildSnapshotData({
  products = [],
  categories = [],
  collections = [],
  taxonomy = {},
  governorates = [],
  settings = {},
  currentVersion = 0,
  previousShardIds = null,
  // productId -> array of variant rows (each { id, ...data }), gathered by
  // collectCatalogData from the variants subcollections.
  variantsByProduct = {},
  now = 0
}) {
  const version = Number(currentVersion ?? 0) + 1;
  const cards = products.map((doc) => slimCard(doc.data(), doc.id, variantsByProduct[doc.id] ?? []));
  const shards = shardProducts(cards, version);

  // productId -> shardId. Only worth keeping while the catalogue is small
  // enough that the map stays negligible next to the shards it points into.
  const shardIndex =
    cards.length <= MAX_SHARD_INDEX_PRODUCTS
      ? Object.fromEntries(cards.map((card, i) => [card.id, shards[Math.floor(i / SHARD_SIZE)].id]))
      : null;

  return {
    version,
    builtAt: now,
    productCount: cards.length,
    shards,
    shardDescriptors: shards.map((s) => ({ id: s.id, count: s.products.length })),
    // The caller passes the shard ids it saw, so writeSnapshot can drop the ones
    // this build no longer needs without listing the collection.
    previousShardIds: Array.isArray(previousShardIds) ? previousShardIds : null,
    shardIndex,
    meta: {
      version,
      builtAt: now,
      productCount: cards.length,
      shardIndex,
      categories,
      collections,
      taxonomy,
      governorates,
      publicSettings: publicSettings(settings)
    }
  };
}

// The database half of the build: shards + meta in one batch, stale shards
// deleted, dirty flag cleared. A batch keeps a half-published store from
// ever being served.
//
// Stale shards are identified from the ids the caller already saw
// (snapshot.previousShardIds), which is what meta carries. Listing the whole
// catalog_snapshots collection instead would cost one read per shard on every
// build; the fallback below keeps older callers (and the unit tests) working.
export async function writeSnapshot(db, snapshot) {
  const batch = db.batch();

  batch.set(db.doc(META_DOC), {
    version: snapshot.version,
    builtAt: snapshot.builtAt,
    productCount: snapshot.productCount,
    shards: snapshot.shardDescriptors,
    meta: snapshot.meta
  });

  for (const shard of snapshot.shards) {
    batch.set(db.doc(`catalog_snapshots/${shard.id}`), shard);
  }

  // Remove shards that no longer exist so readers never serve ghosts.
  const nextIds = new Set(snapshot.shards.map((s) => s.id));
  const previousIds = snapshot.previousShardIds ?? (await db.collection("catalog_snapshots").get())
    .docs
    .filter((doc) => !doc.id.endsWith("meta"))
    .map((doc) => doc.id);
  for (const id of previousIds) {
    if (!nextIds.has(id)) batch.delete(db.doc(`catalog_snapshots/${id}`));
  }

  batch.update(db.doc(FLAG_DOC), {
    dirty: false,
    version: snapshot.version,
    lastBuiltAt: snapshot.builtAt,
    shards: snapshot.shards.length,
    productCount: snapshot.productCount
  });

  await batch.commit();
  return { version: snapshot.version, productCount: snapshot.productCount, shards: snapshot.shards.length };
}

// Reads the whole active catalogue, including each product's variants. Runs on
// the admin "publish" route and the nightly cron, never on a visitor path.
//
// This is the expensive build: every active product plus its variants
// subcollection. For the visitor path use rebuildShardsPartial, which reads
// only what changed.
export async function collectCatalogData(db, { now = Date.now() } = {}) {
  const [productsSnap, categoriesSnap, collectionsSnap, governoratesSnap, settingsSnap, taxonomySnap, catalogSnap] =
    await Promise.all([
      db.collection(PRODUCTS_COLLECTION).where("status", "==", "active").get(),
      db.collection("categories").where("active", "==", true).orderBy("order", "asc").get(),
      db.collection("collections").where("active", "==", true).orderBy("order", "asc").get(),
      db.collection("egp_governorate_costs").where("active", "==", true).get(),
      db.doc("egp_settings/general").get(),
      db.doc("egp_settings/taxonomy").get(),
      db.doc(FLAG_DOC).get()
    ]);

  const productIds = productsSnap.docs.map((doc) => doc.id);

  // Variants are what make the product page and the bag readable without
  // touching Firestore, so the full build has to collect them.
  const variantsByProduct = await collectVariants(db, productIds);

  const flag = catalogSnap.exists ? catalogSnap.data() : {};
  const previousMetaSnap = await db.doc(META_DOC).get();

  return buildSnapshotData({
    products: productsSnap.docs,
    categories: categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    collections: collectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    taxonomy: taxonomySnap.exists ? taxonomySnap.data() : {},
    governorates: governoratesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    settings: settingsSnap.exists ? settingsSnap.data() : {},
    currentVersion: flag.version ?? 0,
    previousShardIds: previousMetaSnap.exists
      ? (previousMetaSnap.data().shards ?? []).map((s) => s.id)
      : null,
    variantsByProduct,
    now
  });
}

// productId -> [{ id, ...data }]. Read concurrently and, when a product has no
// variants subcollection, recorded as empty rather than failing the build: a
// product with no variants is a legitimate legacy product.
export async function collectVariants(db, productIds = []) {
  if (productIds.length === 0) return {};

  const snaps = await Promise.all(
    productIds.map(async (id) => {
      try {
        const snap = await db.collection(`${PRODUCTS_COLLECTION}/${id}/variants`).get();
        return [id, snap.docs.map((d) => ({ id: d.id, ...d.data() }))];
      } catch {
        return [id, []];
      }
    })
  );

  return Object.fromEntries(snaps);
}

// Reads the snapshot for the public catalogue route: meta + shards, nothing
// else. Returns null when nothing has been built yet, so the caller can say
// so instead of serving an empty store.
export async function readSnapshot(db) {
  const metaSnap = await db.doc(META_DOC).get();
  if (!metaSnap.exists) return null;

  const meta = metaSnap.data();
  const shardIds = (meta.shards ?? []).map((s) => s.id);
  if (shardIds.length === 0) return null;

  const shardSnaps = await Promise.all(shardIds.map((id) => db.doc(`catalog_snapshots/${id}`).get()));
  const products = [];
  for (const snap of shardSnaps) {
    // A missing shard means a partial build; serving half a store is worse
    // than an error the CDN can retry.
    if (!snap.exists) return null;
    products.push(...(snap.data().products ?? []));
  }

  return {
    version: meta.version,
    builtAt: meta.builtAt,
    productCount: meta.productCount,
    products,
    categories: meta.meta?.categories ?? [],
    collections: meta.meta?.collections ?? [],
    taxonomy: meta.meta?.taxonomy ?? {},
    governorates: meta.meta?.governorates ?? [],
    settings: meta.meta?.publicSettings ?? {}
  };
}

// ---------------------------------------------------------------------------
// Freshness
//
// Vercel's Hobby plan runs crons once a day, so a 10-minute catalogue rebuild
// loop does not exist. Freshness instead rides on the read path, behind a
// cooldown, and the two build shapes have very different costs:
//
//   full build     products + every variant subcollection. For 150 products at
//                  ~8 variants that is ~1,350 reads. Fine nightly, far too
//                  expensive to run from a visitor request.
//   partial build  only the products whose `updatedAt` moved since the last
//                  build, plus the shards holding them. After a busy day that
//                  is tens of products, not hundreds.
//
// Cost control, in order of importance:
//   1. the dirty flag: when nothing marked the snapshot stale, the route spends
//      exactly one extra read (the flag) and serves the CDN-cached snapshot.
//   2. the cooldown: after an order, the first visitor to miss the CDN pays the
//      partial build; everyone after it is served from cache for 30 minutes.
//   3. the dirty flag is cleared by the build, so a busy hour with 40 orders
//      costs one partial build, not 40.
//
// Worst case per day at a 30-minute cooldown is 48 partial builds; each one is
// bounded by how many products changed in that window, so the daily figure
// tracks order volume rather than catalogue size.
// ---------------------------------------------------------------------------

// Products whose `updatedAt` is newer than the last build. A range query on one
// field needs no composite index, and it is the only query in the freshness
// path - everything else is a document read the shard index already points at.
export async function productsUpdatedSince(db, sinceMs) {
  if (!Number.isFinite(sinceMs) || sinceMs <= 0) {
    const snap = await db.collection(PRODUCTS_COLLECTION).where("status", "==", "active").get();
    return snap.docs;
  }
  const snap = await db
    .collection(PRODUCTS_COLLECTION)
    .where("updatedAt", ">", new Date(sinceMs))
    .get();
  return snap.docs;
}

// Patches only the shards that hold changed products. Returns the build
// summary, or null when a full build is required instead (no shard index yet,
// a product that appeared, or a product whose card is not where the index says
// it is - all structural changes a partial patch cannot express).
export async function rebuildShardsPartial(db, { now = Date.now(), lastBuiltAt = 0 } = {}) {
  const metaSnap = await db.doc(META_DOC).get();
  if (!metaSnap.exists) return null;

  const meta = metaSnap.data();
  const shardIndex = meta.meta?.shardIndex ?? null;
  if (!shardIndex || Object.keys(shardIndex).length === 0) return null;

  const changedDocs = await productsUpdatedSince(db, lastBuiltAt);
  if (changedDocs.length === 0) {
    // Nothing moved: clear the flag so the next visitor does not re-check.
    await db.doc(FLAG_DOC).update({ dirty: false, lastBuiltAt: now });
    return { rebuilt: true, mode: "noop", version: meta.version, productCount: meta.productCount, shards: (meta.shards ?? []).length };
  }

  const changedIds = new Set(changedDocs.map((doc) => doc.id));

  // A product the index has never heard of appeared (or was re-published): the
  // shard layout itself changes, so only a full build can express it.
  const unknownIds = [...changedIds].filter((id) => !shardIndex[id]);
  if (unknownIds.length > 0) return null;

  // A changed product that is no longer active would need its card REMOVED,
  // which a patch (which only rewrites cards in place) cannot express, and a
  // full build filters by status for free. So archive/draft changes fall
  // through to the full build.
  const noLongerActive = changedDocs.filter((doc) => doc.data().status !== "active");
  if (noLongerActive.length > 0) return null;

  // Read the variants for exactly the products that changed.
  const variantsByProduct = await collectVariants(db, [...changedIds]);

  const shardIds = [...new Set([...changedIds].map((id) => shardIndex[id]))];
  const shardSnaps = await Promise.all(shardIds.map((id) => db.doc(`catalog_snapshots/${id}`).get()));

  const batch = db.batch();
  const version = Number(meta.version ?? 0) + 1;
  let patchedProducts = 0;

  for (const shardSnap of shardSnaps) {
    if (!shardSnap.exists) return null; // a shard went missing: full build
    const shard = shardSnap.data();
    const cards = (shard.products ?? []).map((card) => {
      if (!changedIds.has(card.id)) return card;
      const doc = changedDocs.find((d) => d.id === card.id);
      patchedProducts += 1;
      return slimCard(doc.data(), doc.id, variantsByProduct[doc.id] ?? []);
    });

    batch.set(shardSnap.ref, { ...shard, version, products: cards });
  }

  // The snapshot's own metadata has to move in lockstep with the patched
  // shards, or readers would cache one version and serve another.
  batch.set(db.doc(META_DOC), {
    ...meta,
    version,
    builtAt: now,
    meta: { ...meta.meta, version, builtAt: now }
  });

  batch.update(db.doc(FLAG_DOC), {
    dirty: false,
    version,
    lastBuiltAt: now,
    productCount: meta.productCount
  });

  await batch.commit();

  return {
    rebuilt: true,
    mode: "partial",
    version,
    patchedProducts,
    shards: shardSnaps.length,
    productCount: meta.productCount
  };
}

// The entry point the catalogue route calls on a cache miss. Decides whether a
// rebuild is due at all, so the common path (nothing stale) costs one read.
//
// It never throws: a rebuild failure must not take the storefront down, and
// the CDN can retry on the next miss.
export async function refreshSnapshotIfStale(db, { now = Date.now(), cooldownMs = REBUILD_COOLDOWN_MS } = {}) {
  try {
    const flagSnap = await db.doc(FLAG_DOC).get();
    const flag = flagSnap.exists ? flagSnap.data() : {};

    if (flag.dirty !== true) return { rebuilt: false, reason: "not-dirty" };

    const lastBuiltAt = Number(flag.lastBuiltAt ?? 0);
    if (lastBuiltAt > 0 && now - lastBuiltAt < cooldownMs) {
      return { rebuilt: false, reason: "cooldown" };
    }

    // Cheap first: patch what changed. Falls through to a full build when the
    // change is structural (a new product, no index yet).
    const partial = await rebuildShardsPartial(db, { now, lastBuiltAt });
    if (partial) return partial;

    const snapshot = await collectCatalogData(db, { now });
    const result = await writeSnapshot(db, snapshot);
    return { rebuilt: true, mode: "full", ...result };
  } catch (error) {
    console.error("catalog refresh failed:", error);
    return { rebuilt: false, reason: "error" };
  }
}
