#!/usr/bin/env node
// Seed script for Firebase emulator
// Fills the emulator with: settings, taxonomy, 27 governorates, 3 categories,
// 2 collections, 6 products with variants (one sold out, one low stock, one draft),
// 5 coupons (valid, expired, used up, below-minimum, disabled)
//
// Uses firebase-admin SDK to bypass security rules (same as server routes)

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Connect to the emulator.
//
// Order matters and this is the whole bug this file used to have. The Admin SDK
// resolves FIRESTORE_EMULATOR_HOST when the Firestore client is CONSTRUCTED, so
// setting it after getFirestore() is too late: the client is already pointing at
// the real project, tries to fetch Application Default Credentials, and dies with
// "Could not load the default credentials" on a machine that has none.
//
// The ESM import statements above are hoisted above this line, but that is fine:
// what matters is that these env vars are set before initializeApp(), not before
// the import.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8399";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "proactive-fashion-demo";

// No credential is supplied on purpose: with the emulator host set, the SDK
// talks to localhost and never asks for a token.
const app = initializeApp({
  projectId: "proactive-fashion-demo",
}, 'seed-script');

const db = getFirestore(app);

console.log("🌱 Seeding Firebase emulator (via Admin SDK)...");

async function seed() {
  const batch = db.batch();
  const now = Date.now();

  // 1. Settings (egp_settings/general)
  console.log("  → Writing settings...");
  batch.set(db.doc("egp_settings/general"), {
    storeName: "ProActive Fashion",
    freeShippingThreshold: 800,
    whatsapp: "01012345678",
    announcement: { ar: "عروض الصيف بدأت!", en: "Summer sale started!" },
    ordersOpen: true,
    minimumOrderAmount: 0,
    currency: "EGP",
    lowStockThreshold: 3,
    highValueThreshold: 3000,
    rateLimits: { perIpHour: 5, perIpDay: 25, perPhoneDay: 3 },
    updatedAt: FieldValue.serverTimestamp()
  });

  // 2. Taxonomy (egp_settings/taxonomy)
  console.log("  → Writing taxonomy...");
  batch.set(db.doc("egp_settings/taxonomy"), {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    colors: [
      { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#121212' },
      { id: 'white', name: { en: 'White', ar: 'أبيض' }, hex: '#FFFFFF' },
      { id: 'beige', name: { en: 'Beige', ar: 'بيج' }, hex: '#F4F2EE' },
      { id: 'navy', name: { en: 'Navy', ar: 'كحلي' }, hex: '#1F4E8C' },
      { id: 'olive', name: { en: 'Olive', ar: 'زيتي' }, hex: '#6B8E23' },
      { id: 'burgundy', name: { en: 'Burgundy', ar: 'عنابي' }, hex: '#800020' },
      { id: 'grey', name: { en: 'Grey', ar: 'رمادي' }, hex: '#8A8780' },
      { id: 'blue', name: { en: 'Blue', ar: 'أزرق' }, hex: '#3A7BD5' }
    ],
    updatedAt: FieldValue.serverTimestamp()
  });

  // 3. 27 Governorates (egp_governorate_costs)
  console.log("  → Writing 27 governorates...");
  const governorates = [
    { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' }, cost: 60, minOrder: 0, active: true },
    { id: 'giza', name: { en: 'Giza', ar: 'الجيزة' }, cost: 55, minOrder: 0, active: true },
    { id: 'alexandria', name: { en: 'Alexandria', ar: 'الإسكندرية' }, cost: 70, minOrder: 0, active: true },
    { id: 'qalyubia', name: { en: 'Qalyubia', ar: 'القليوبية' }, cost: 50, minOrder: 0, active: true },
    { id: 'monufia', name: { en: 'Monufia', ar: 'المنوفية' }, cost: 55, minOrder: 0, active: true },
    { id: 'gharbia', name: { en: 'Gharbia', ar: 'الغربية' }, cost: 60, minOrder: 0, active: true },
    { id: 'dakahlia', name: { en: 'Dakahlia', ar: 'الدقهلية' }, cost: 65, minOrder: 0, active: true },
    { id: 'sharkia', name: { en: 'Sharqia', ar: 'الشرقية' }, cost: 65, minOrder: 0, active: true },
    { id: 'beheira', name: { en: 'Beheira', ar: 'البحيرة' }, cost: 70, minOrder: 0, active: true },
    { id: 'kafr_sheikh', name: { en: 'Kafr El Sheikh', ar: 'كفر الشيخ' }, cost: 70, minOrder: 0, active: true },
    { id: 'damietta', name: { en: 'Damietta', ar: 'دمياط' }, cost: 80, minOrder: 0, active: true },
    { id: 'port_said', name: { en: 'Port Said', ar: 'بورسعيد' }, cost: 80, minOrder: 0, active: true },
    { id: 'ismailia', name: { en: 'Ismailia', ar: 'الإسماعيلية' }, cost: 75, minOrder: 0, active: true },
    { id: 'suez', name: { en: 'Suez', ar: 'السويس' }, cost: 75, minOrder: 0, active: true },
    { id: 'matrouh', name: { en: 'Matrouh', ar: 'مطروح' }, cost: 120, minOrder: 0, active: true },
    { id: 'north_sinai', name: { en: 'North Sinai', ar: 'شمال سيناء' }, cost: 150, minOrder: 0, active: true },
    { id: 'south_sinai', name: { en: 'South Sinai', ar: 'جنوب سيناء' }, cost: 150, minOrder: 0, active: true },
    { id: 'faiyum', name: { en: 'Faiyum', ar: 'الفيوم' }, cost: 70, minOrder: 0, active: true },
    { id: 'beni_suef', name: { en: 'Beni Suef', ar: 'بني سويف' }, cost: 80, minOrder: 0, active: true },
    { id: 'minya', name: { en: 'Minya', ar: 'المنيا' }, cost: 90, minOrder: 0, active: true },
    { id: 'asyut', name: { en: 'Asyut', ar: 'أسيوط' }, cost: 100, minOrder: 0, active: true },
    { id: 'sohag', name: { en: 'Sohag', ar: 'سوهاج' }, cost: 100, minOrder: 0, active: true },
    { id: 'qena', name: { en: 'Qena', ar: 'قنا' }, cost: 100, minOrder: 0, active: true },
    { id: 'luxor', name: { en: 'Luxor', ar: 'الأقصر' }, cost: 120, minOrder: 0, active: true },
    { id: 'aswan', name: { en: 'Aswan', ar: 'أسوان' }, cost: 130, minOrder: 0, active: true },
    { id: 'red_sea', name: { en: 'Red Sea', ar: 'البحر الأحمر' }, cost: 120, minOrder: 0, active: true },
    { id: 'new_valley', name: { en: 'New Valley', ar: 'الوادي الجديد' }, cost: 150, minOrder: 0, active: true },
  ];

  for (const g of governorates) {
    batch.set(db.doc(`egp_governorate_costs/${g.id}`), {
      name: g.name,
      cost: g.cost,
      minOrder: g.minOrder,
      active: g.active,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // 4. Categories (3 categories)
  console.log("  → Writing 3 categories...");
  const categories = [
    { id: 'dresses', name: { en: 'Dresses', ar: 'فساتين' }, slug: 'dresses', parentId: null, order: 1, active: true, image: null },
    { id: 'tops', name: { en: 'Tops', ar: 'توبات' }, slug: 'tops', parentId: null, order: 2, active: true, image: null },
    { id: 'bottoms', name: { en: 'Bottoms', ar: 'سفلية' }, slug: 'bottoms', parentId: null, order: 3, active: true, image: null },
  ];

  for (const c of categories) {
    batch.set(db.doc(`categories/${c.id}`), {
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      order: c.order,
      active: c.active,
      image: c.image,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // 5. Collections (2 collections)
  console.log("  → Writing 2 collections...");
  const collections = [
    {
      id: 'new-in',
      title: { en: 'New In', ar: 'وصل حديثاً' },
      slug: 'new-in',
      type: 'hero',
      banner: null,
      productIds: [], // will be filled after products created
      order: 1,
      active: true,
      startsAt: null,
      endsAt: null
    },
    {
      id: 'sale',
      title: { en: 'Sale', ar: 'تخفيضات' },
      slug: 'sale',
      type: 'row',
      banner: null,
      productIds: [],
      order: 2,
      active: true,
      startsAt: null,
      endsAt: null
    },
  ];

  for (const c of collections) {
    batch.set(db.doc(`collections/${c.id}`), {
      title: c.title,
      slug: c.slug,
      type: c.type,
      banner: c.banner,
      productIds: c.productIds,
      order: c.order,
      active: c.active,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // 6. Products (6 products with variants)
  console.log("  → Writing 6 products with variants...");
  const products = [
    {
      id: 'prod-001',
      title: { en: 'Floral Summer Dress', ar: 'فستان صيفي أزهار' },
      slug: 'floral-summer-dress',
      price: 500,
      compareAtPrice: 600,
      categoryId: 'dresses',
      status: 'active',
      isNew: true,
      isFeatured: true,
      material: '100% Cotton',
      care: 'Machine wash cold, do not bleach',
      images: [
        { url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800', color: 'red', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800', color: 'blue', isPrimary: false }
      ],
      colors: [
        { id: 'red', name: { en: 'Red', ar: 'أحمر' }, hex: '#E53935' },
        { id: 'blue', name: { en: 'Blue', ar: 'أزرق' }, hex: '#1E88E5' }
      ],
      sizes: ['S', 'M', 'L'],
      variants: {
        red_S: 5, red_M: 3, red_L: 0,  // red L sold out
        blue_S: 10, blue_M: 8, blue_L: 5
      }
    },
    {
      id: 'prod-002',
      title: { en: 'Classic White Blouse', ar: 'بلوزة بيضاء كلاسيكية' },
      slug: 'classic-white-blouse',
      price: 350,
      compareAtPrice: null,
      categoryId: 'tops',
      status: 'active',
      isNew: false,
      isFeatured: false,
      material: 'Silk blend',
      care: 'Dry clean only',
      images: [
        { url: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=800', color: 'white', isPrimary: true }
      ],
      colors: [
        { id: 'white', name: { en: 'White', ar: 'أبيض' }, hex: '#FFFFFF' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      variants: {
        white_XS: 2, white_S: 1, white_M: 0, white_L: 0, white_XL: 0  // low stock XS/S, sold out M/L/XL
      }
    },
    {
      id: 'prod-003',
      title: { en: 'Slim Fit Jeans', ar: 'جينز ضيق' },
      slug: 'slim-fit-jeans',
      price: 450,
      compareAtPrice: 550,
      categoryId: 'bottoms',
      status: 'active',
      isNew: false,
      isFeatured: true,
      material: '98% Cotton, 2% Elastane',
      care: 'Machine wash cold, tumble dry low',
      images: [
        { url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800', color: 'blue', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800', color: 'black', isPrimary: false }
      ],
      colors: [
        { id: 'blue', name: { en: 'Blue', ar: 'أزرق' }, hex: '#1E88E5' },
        { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#121212' }
      ],
      sizes: ['28', '30', '32', '34', '36'],
      variants: {
        blue_28: 15, blue_30: 20, blue_32: 10, blue_34: 5, blue_36: 0,
        black_28: 10, black_30: 15, black_32: 8, black_34: 3, black_36: 0
      }
    },
    {
      id: 'prod-004',
      title: { en: 'Evening Gown', ar: 'فستان سهرة' },
      slug: 'evening-gown',
      price: 1200,
      compareAtPrice: 1500,
      categoryId: 'dresses',
      status: 'active',
      isNew: false,
      isFeatured: true,
      material: 'Chiffon',
      care: 'Dry clean only',
      images: [
        { url: 'https://images.unsplash.com/photo-1566174053879-3d99b911b2f4?w=800', color: 'burgundy', isPrimary: true }
      ],
      colors: [
        { id: 'burgundy', name: { en: 'Burgundy', ar: 'عنابي' }, hex: '#800020' }
      ],
      sizes: ['XS', 'S', 'M', 'L'],
      variants: {
        burgundy_XS: 3, burgundy_S: 2, burgundy_M: 1, burgundy_L: 0  // low stock
      }
    },
    {
      id: 'prod-005',
      title: { en: 'Draft Product (Not Published)', ar: 'منتج مسودة (غير منشور)' },
      slug: 'draft-product',
      price: 200,
      compareAtPrice: null,
      categoryId: 'tops',
      status: 'draft',
      isNew: false,
      isFeatured: false,
      material: 'Cotton',
      care: 'Machine wash',
      images: [],
      colors: [
        { id: 'grey', name: { en: 'Grey', ar: 'رمادي' }, hex: '#8A8780' }
      ],
      sizes: ['S', 'M', 'L'],
      variants: {
        grey_S: 10, grey_M: 10, grey_L: 10
      }
    },
    {
      id: 'prod-006',
      title: { en: 'Sold Out T-Shirt', ar: 'تيشيرت نفذت كميته' },
      slug: 'sold-out-tshirt',
      price: 150,
      compareAtPrice: null,
      categoryId: 'tops',
      status: 'active',
      isNew: false,
      isFeatured: false,
      material: '100% Cotton',
      care: 'Machine wash',
      images: [
        { url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', color: 'black', isPrimary: true }
      ],
      colors: [
        { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#121212' }
      ],
      sizes: ['S', 'M', 'L', 'XL'],
      variants: {
        black_S: 0, black_M: 0, black_L: 0, black_XL: 0  // completely sold out
      }
    }
  ];

  const productIds = [];

  for (const p of products) {
    const productRef = db.doc(`products_egp/${p.id}`);
    productIds.push(p.id);

    // Main product document
    const variantColors = Object.keys(p.variants).map(k => k.split('_')[0]);
    const variantSizes = Object.keys(p.variants).map(k => k.split('_')[1]);
    const uniqueColors = [...new Set(variantColors)];
    const uniqueSizes = [...new Set(variantSizes)];

    const totalStock = Object.values(p.variants).reduce((sum, v) => sum + v, 0);

    batch.set(productRef, {
      title: p.title,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      categoryId: p.categoryId,
      status: p.status,
      isNew: p.isNew,
      isFeatured: p.isFeatured,
      material: p.material,
      care: p.care,
      images: p.images,
      colors: p.colors,
      sizes: p.sizes,
      totalStock: totalStock,
      availableColors: uniqueColors.filter(c => Object.keys(p.variants).some(k => k.startsWith(c + '_') && p.variants[k] > 0)),
      availableSizes: uniqueSizes.filter(s => Object.keys(p.variants).some(k => k.endsWith('_' + s) && p.variants[k] > 0)),
      discountPct: p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0,
      soldCount: 0,
      searchText: `${p.title.en} ${p.title.ar} ${p.tags?.join(' ') || ''}`.toLowerCase(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Variants subcollection
    for (const [variantKey, stock] of Object.entries(p.variants)) {
      const [colorId, size] = variantKey.split('_');
      const color = p.colors.find(c => c.id === colorId);
      const variantRef = db.doc(`products_egp/${p.id}/variants/${colorId}_${size}`);

      batch.set(variantRef, {
        colorId,
        color: color?.name?.en || colorId,
        size,
        stock,
        priceOverride: null,
        active: stock > 0,
        sku: `${p.id}-${colorId}_${size}`.toUpperCase(),
        image: p.images.find(img => img.color === colorId)?.url || null
      });
    }
  }

  // Update collections with product IDs
  collections[0].productIds = [products[0].id, products[1].id, products[3].id]; // new-in
  collections[1].productIds = [products[0].id, products[2].id]; // sale

  for (const c of collections) {
    batch.set(db.doc(`collections/${c.id}`), {
      title: c.title,
      slug: c.slug,
      type: c.type,
      banner: c.banner,
      productIds: c.productIds,
      order: c.order,
      active: c.active,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // 7. Coupons (6 coupons)
  console.log("  → Writing 6 coupons...");
  const coupons = [
    { code: 'WELCOME10', type: 'percent', value: 10, minOrder: 0, maxUses: 1, usedCount: 0, expiresAt: null, active: true, createdAt: FieldValue.serverTimestamp() },
    { code: 'SUMMER20', type: 'percent', value: 20, minOrder: 500, maxUses: 100, usedCount: 0, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), active: true, createdAt: FieldValue.serverTimestamp() },
    { code: 'EXPIRED5', type: 'fixed', value: 50, minOrder: 0, maxUses: 50, usedCount: 50, expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), active: true, createdAt: FieldValue.serverTimestamp() },
    { code: 'USEDUP100', type: 'fixed', value: 100, minOrder: 200, maxUses: 10, usedCount: 10, expiresAt: null, active: true, createdAt: FieldValue.serverTimestamp() },
    { code: 'BELOWMIN50', type: 'fixed', value: 50, minOrder: 1000, maxUses: 1, usedCount: 0, expiresAt: null, active: true, createdAt: FieldValue.serverTimestamp() },
    { code: 'DISABLED20', type: 'percent', value: 20, minOrder: 0, maxUses: 1, usedCount: 0, expiresAt: null, active: false, createdAt: FieldValue.serverTimestamp() }
  ];

  for (const c of coupons) {
    batch.set(db.doc(`egp_coupons/${c.code}`), {
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt,
      active: c.active,
      createdAt: c.createdAt
    });
  }

  // 8. Catalog dirty flag (so first visitor triggers rebuild)
  console.log("  → Writing catalog dirty flag...");
  batch.set(db.doc("egp_settings/catalog"), {
    dirty: true,
    dirtyAt: Date.now(),
    version: 0
  }, { merge: true });

  // Commit all
  console.log("  → Committing batch...");
  await batch.commit();
  console.log("✅ Seed complete!");
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});