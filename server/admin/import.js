// POST /api/admin/import — CSV import of products, variants and stock.
//
// Fashion catalogues have hundreds of colour/size lines; typing a stock grid
// per product does not scale. Template columns (header required):
//
//   productSlug,titleEn,titleAr,category,price,compareAt,color,size,stock,imageUrl
//
// Rows with the same productSlug merge into one product; each distinct
// colour/size becomes a variant (id `<colorId>_<size>`). Stock is set to the
// absolute imported value, and every change writes a stock_movements row so
// the audit trail survives the import.
//
// One product = one write batch, so a 500-row file cannot trip the per-batch
// limit, and a failure names the row it died on.

import { FieldValue } from "../_core/firebaseAdmin.js";
import { getDb } from "../_core/serverDb.js";
import { requireAdmin } from "../_core/authz.js";
import { applyCors, handlePreflight } from "../_core/cors.js";
import { parseCsv } from "../_core/csv.js";

const REQUIRED = ["productslug", "size", "stock"];

// The header may arrive in any case (productSlug, productslug, PRODUCTSLUG);
// rows are normalised onto the camelCase names the rest of the route reads.
const COLUMN_ALIASES = {
  productslug: "productSlug",
  titleen: "titleEn",
  titlear: "titleAr",
  category: "category",
  price: "price",
  compareat: "compareAt",
  color: "color",
  size: "size",
  stock: "stock",
  imageurl: "imageUrl"
};

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const alias = COLUMN_ALIASES[String(key).toLowerCase()];
    if (alias) out[alias] = value;
  }
  return out;
}

export { normalizeRow };

/**
 * Validate a parsed CSV row's money columns.
 *
 * Returns `{ ok: true, price, compareAtPrice }`, or `{ ok: false, error }` for
 * the row that must be refused. A blank, zero, negative, non-numeric or
 * infinite price is a BAD_PRICE; a compare-at that is not above the price is a
 * BAD_COMPARE. The import forces `status: "active"` on every row it writes, so a
 * bad price here becomes a live, buyable, free product - which is why this check
 * is at the row boundary rather than at write time.
 */
export function validateRowPricing(row) {
  const price = Number(row?.price);

  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "BAD_PRICE" };
  }

  const compareAt = row?.compareAt ? Number(row.compareAt) : null;

  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt <= price)) {
    return { ok: false, error: "BAD_COMPARE" };
  }

  return { ok: true, price, compareAtPrice: compareAt };
}

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  if (!csv.trim()) return res.status(400).json({ error: "BAD_CSV" });

  let rows;
  try {
    rows = parseCsv(csv);
  } catch (error) {
    return res.status(400).json({ error: `BAD_CSV:${error.message}` });
  }

  if (rows.length === 0) return res.status(400).json({ error: "BAD_CSV:empty" });

  const header = Object.keys(rows[0]).map((k) => k.toLowerCase());
  for (const column of REQUIRED) {
    if (!header.includes(column)) {
      return res.status(400).json({ error: `BAD_CSV:missing-${column}` });
    }
  }

  const records = rows.map(normalizeRow);

  // Group rows by product so each product's variants land in one batch.
  const products = new Map();
  for (const [index, row] of records.entries()) {
    const slug = String(row.productSlug ?? "").trim();
    if (!slug) return res.status(400).json({ error: `BAD_ROW:${index + 2}` });

    if (!products.has(slug)) {
      // A price is validated here exactly as the admin editor validates it, and
      // exactly as checkout will later depend on: a finite number above zero.
      // `Number(row.price ?? 0)` used to turn a blank, negative or non-numeric
      // cell into 0 or NaN, and the row below forced status "active" - so a
      // fat-fingered CSV produced a live, buyable, free product, and NaN made
      // every checkout comparison silently pass.
      const priced = validateRowPricing(row);
      if (!priced.ok) {
        return res.status(400).json({ error: `${priced.error}:${index + 2}` });
      }

      products.set(slug, {
        slug,
        title: {
          ar: String(row.titleAr ?? "").trim(),
          en: String(row.titleEn ?? slug).trim()
        },
        categoryId: String(row.category ?? "").trim() || null,
        price: priced.price,
        compareAtPrice: priced.compareAtPrice,
        images: row.imageUrl ? [{ url: String(row.imageUrl).trim(), color: null, isPrimary: true }] : [],
        variants: []
      });
    }

    const product = products.get(slug);
    const color = String(row.color ?? "default").trim() || "default";
    const size = String(row.size ?? "ONE").trim() || "ONE";
    const stock = Math.max(0, Math.floor(Number(row.stock ?? 0)));

    if (!Number.isFinite(stock)) {
      return res.status(400).json({ error: `BAD_ROW:${index + 2}` });
    }

    product.variants.push({
      variantId: `${colorId(color)}_${size}`,
      colorId: colorId(color),
      color,
      size,
      stock
    });
  }

  try {
    const db = getDb();
    const now = Date.now();
    let productsWritten = 0;
    let variantsWritten = 0;
    let stockMoves = 0;

    for (const product of products.values()) {
      const existing = await db.collection("products_egp").where("slug", "==", product.slug).limit(1).get();
      const productRef = existing.empty
        ? db.collection("products_egp").doc()
        : existing.docs[0].ref;

      const variantsBefore = new Map();
      if (!existing.empty) {
        const current = await productRef.collection("variants").get();
        current.docs.forEach((doc) => variantsBefore.set(doc.id, Number(doc.data().stock ?? 0)));
      }

      // Merge into the existing product when the slug matches, so an import
      // of one column does not blank the rest of the catalogue entry.
      const data = {
        slug: product.slug,
        price: product.price,
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      };
      if (product.title.ar || product.title.en) data.title = product.title;
      if (product.categoryId) data.categoryId = product.categoryId;
      if (product.compareAtPrice != null) data.compareAtPrice = product.compareAtPrice;
      if (product.images.length) data.images = product.images;

      const batch = db.batch();
      batch.set(productRef, existing.empty ? { ...data, createdAt: FieldValue.serverTimestamp() } : data, {
        merge: true
      });

      for (const variant of product.variants) {
        const variantRef = productRef.collection("variants").doc(variant.variantId);
        batch.set(
          variantRef,
          {
            colorId: variant.colorId,
            color: variant.color,
            size: variant.size,
            stock: variant.stock,
            active: true
          },
          { merge: true }
        );
        variantsWritten += 1;

        const before = variantsBefore.get(variant.variantId);
        if (before !== variant.stock) {
          batch.set(db.collection("stock_movements").doc(), {
            productId: productRef.id,
            variantId: variant.variantId,
            delta: variant.stock - (before ?? 0),
            reason: "import",
            by: auth.uid,
            at: now
          });
          stockMoves += 1;
        }
      }

      await batch.commit();
      productsWritten += 1;
    }

    // The snapshot's stock cards are wrong after an import.
    await db.doc("egp_settings/catalog").set({ dirty: true, dirtyAt: now }, { merge: true });

    console.log(
      `csv import by ${auth.email ?? auth.uid}: ${productsWritten} product(s), ${variantsWritten} variant(s), ${stockMoves} stock move(s)`
    );
    return res.status(200).json({ ok: true, products: productsWritten, variants: variantsWritten, stockMoves });
  } catch (error) {
    console.error("csv import failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// Stable, Firestore-safe variant ids: a colour name may arrive as
// "Wine Red", "wine-red" or "wine_red" and must not create three variants.
function colorId(color) {
  return String(color)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}
