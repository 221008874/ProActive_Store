// Catalog snapshot: build, store and serve a slim copy of the whole active
// catalogue instead of letting every visitor read every product document.
//
//   reads per day = visits × products            (raw documents)
//   reads per day = shards × cache refreshes     (snapshot)
//
// The snapshot is a cache, not a source of truth: prices and stock shown from
// it can lag by the cache TTL, which is why the product page and checkout
// always read live documents and placeOrder re-validates.

export const SHARD_SIZE = 150;
export const META_DOC = "catalog_snapshots/meta";

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

// One field list: a card is only as fat as the design system's product grid
// needs. Anything not listed here is not part of the public catalogue cache.
export function slimCard(product, id) {
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
    createdAt: product.createdAt ?? null
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
// rate-limit tuning).
export function publicSettings(settings = {}) {
  return {
    storeName: settings.storeName ?? null,
    whatsapp: settings.whatsapp ?? null,
    freeShippingThreshold: Number(settings.freeShippingThreshold ?? 0),
    announcement: settings.announcement ?? null,
    ordersOpen: settings.ordersOpen !== false,
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
  now = 0
}) {
  const version = Number(currentVersion ?? 0) + 1;
  const cards = products.map((doc) => slimCard(doc.data(), doc.id));
  const shards = shardProducts(cards, version);

  return {
    version,
    builtAt: now,
    productCount: cards.length,
    shards,
    shardDescriptors: shards.map((s) => ({ id: s.id, count: s.products.length })),
    meta: {
      version,
      builtAt: now,
      productCount: cards.length,
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
  const existing = await db.collection("catalog_snapshots").get();
  existing.docs.forEach((doc) => {
    if (!nextIds.has(doc.id)) batch.delete(doc.ref);
  });

  batch.update(db.doc("egp_settings/catalog"), {
    dirty: false,
    version: snapshot.version,
    lastBuiltAt: snapshot.builtAt,
    shards: snapshot.shards.length,
    productCount: snapshot.productCount
  });

  await batch.commit();
  return { version: snapshot.version, productCount: snapshot.productCount, shards: snapshot.shards.length };
}

// Reads the whole active catalogue. Runs on a schedule (or on "Publish
// changes"), never on a visitor path.
export async function collectCatalogData(db) {
  const [productsSnap, categoriesSnap, collectionsSnap, governoratesSnap, settingsSnap, taxonomySnap, catalogSnap] =
    await Promise.all([
      db.collection("products_egp").where("status", "==", "active").get(),
      db.collection("categories").where("active", "==", true).orderBy("order", "asc").get(),
      db.collection("collections").where("active", "==", true).orderBy("order", "asc").get(),
      db.collection("egp_governorate_costs").where("active", "==", true).get(),
      db.doc("egp_settings/general").get(),
      db.doc("egp_settings/taxonomy").get(),
      db.doc("egp_settings/catalog").get()
    ]);

  return buildSnapshotData({
    products: productsSnap.docs,
    categories: categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    collections: collectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    taxonomy: taxonomySnap.exists ? taxonomySnap.data() : {},
    governorates: governoratesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    settings: settingsSnap.exists ? settingsSnap.data() : {},
    currentVersion: catalogSnap.exists ? catalogSnap.data().version : 0,
    now: Date.now()
  });
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
