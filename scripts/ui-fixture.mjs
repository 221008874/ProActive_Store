// Fixture catalogue for the UI screenshot harness.
//
// The real catalogue lives in Firestore and is served as a snapshot by
// /api/catalog (server/_core/catalogCore.js). Reproducing a layout bug needs a
// catalogue that actually has products, colours and sizes, so this file builds
// the same snapshot shape offline: exactly the fields slimCard() emits, so a
// screenshot taken against the fixture exercises the same render paths as the
// production snapshot.
//
// Used only by scripts/ui-shots.mjs. Not shipped, not imported by the app.

// The design's placeholder tints stand in for photography: the harness must not
// depend on the network to prove a layout.
const TINTS = ['#E3D5D9', '#D9E1DA', '#D5DBE6', '#EADFC9', '#DCD6E4', '#E8DCCB'];

const COLORS = [
  { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#1A1A1A' },
  { id: 'white', name: { en: 'White', ar: 'أبيض' }, hex: '#F5F3EF' },
  { id: 'beige', name: { en: 'Beige', ar: 'بيج' }, hex: '#D9CBB6' },
  { id: 'olive', name: { en: 'Olive', ar: 'زيتي' }, hex: '#5E6046' },
  { id: 'burgundy', name: { en: 'Burgundy', ar: 'عنابي' }, hex: '#6B2233' },
  { id: 'navy', name: { en: 'Navy', ar: 'كحلي' }, hex: '#26324B' }
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const TITLES = [
  ['Draped midi dress', 'فستان ميدي بانسياب'],
  ['Linen shirt', 'قميص كتان'],
  ['Wide-leg trousers', 'بنطلون واسع'],
  ['Cropped blazer', 'جاكيت قصير'],
  ['Pleated skirt', 'جيبة بليسيه'],
  ['Cotton tee', 'تيشيرت قطن'],
  ['Wrap cardigan', 'كارديغان'],
  ['Denim jacket', 'جاكيت جينز'],
  ['Satin skirt', 'جيبة ساتان'],
  ['Knit pullover', 'سويت شيرت'],
  ['Floral dress', 'فستان وردي'],
  ['Tailored trousers', 'بنطلون مفصّل'],
  ['Silk blouse', 'بلوزة حرير'],
  ['Oversized shirt', 'قميص أوفرسايز'],
  ['Ribbed tank', 'تانك توب'],
  ['Linen co-ord', 'طقم كتان'],
  ['Belted dress', 'فستان بحزام'],
  ['Relaxed chinos', 'بنطلون تشينو']
];

const GENDERS = ['women', 'women', 'women', 'men', 'men', 'kids'];

// Base date so "newest" sorting and createdAt display are deterministic.
const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse('2026-09-01T10:00:00Z');

const colorImages = (tint) => [{ url: `data:image/svg+xml;utf8,${encodeURIComponent(svg(tint))}`, color: 'black' }];

function svg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="600" height="750" fill="${fill}"/></svg>`;
}

export function buildSnapshot({ count = 18, withTaxonomy = true, status = 'active' } = {}) {
  const products = [];

  for (let i = 0; i < count; i++) {
    const [en, ar] = TITLES[i % TITLES.length];
    const price = 349 + ((i * 73) % 9) * 50;
    const discounted = i % 4 === 1;
    const compareAtPrice = discounted ? Math.round(price * 1.25) : null;
    const colors = [COLORS[i % COLORS.length], COLORS[(i + 2) % COLORS.length]];
    const availableSizes = SIZES.filter((_, k) => (k + i) % 5 !== 0);
    const variants = [];
    for (const c of colors) {
      for (const s of availableSizes) {
        variants.push({
          id: `${c.id}_${s}`,
          colorId: c.id,
          size: s,
          sku: `PA-${i}-${c.id}-${s}`,
          stock: (i + s.length) % 7 === 0 ? 0 : 2 + ((i * 3 + s.length) % 9),
          active: true,
          priceOverride: null,
          image: null
        });
      }
    }
    const totalStock = variants.reduce((n, v) => n + v.stock, 0);

    const card = {
      id: `p${String(i + 1).padStart(3, '0')}`,
      title: { en, ar },
      slug: `${en.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i + 1}`,
      price,
      compareAtPrice,
      discountPct: discounted ? 20 : 0,
      isNew: i % 3 === 0,
      gender: GENDERS[i % GENDERS.length],
      categoryId: i % 2 === 0 ? 'women' : 'men',
      categoryPath: i % 2 === 0 ? ['women', 'women-dresses'] : ['men', 'men-shirts'],
      tags: [en.toLowerCase(), GENDERS[i % GENDERS.length]],
      images: colorImages(TINTS[i % TINTS.length]),
      availableColors: colors.map((c) => c.id),
      availableSizes,
      totalStock,
      soldCount: 40 - i,
      searchText: `${en} ${ar} ${TITLES[i % TITLES.length][1]}`.toLowerCase(),
      createdAt: { seconds: Math.floor((BASE - i * 2 * DAY) / 1000) },
      variants,
      colors
    };

    // `status` is deliberately omitted unless asked for: that is what the live
    // documents looked like before the migration, and it is the condition the
    // "0 items" report came from.
    if (status) card.status = status;
    products.push(card);
  }

  const categories = [
    { id: 'women', name: { en: 'Women', ar: 'نساء' }, active: true, order: 1 },
    { id: 'women-dresses', name: { en: 'Dresses', ar: 'فساتين' }, parentId: 'women', active: true, order: 1 },
    { id: 'women-tops', name: { en: 'Tops', ar: 'بلوزات' }, parentId: 'women', active: true, order: 2 },
    { id: 'men', name: { en: 'Men', ar: 'رجالة' }, active: true, order: 2 },
    { id: 'men-shirts', name: { en: 'Shirts', ar: 'قمصان' }, parentId: 'men', active: true, order: 1 },
    { id: 'kids', name: { en: 'Kids', ar: ' أطفال' }, active: true, order: 3 }
  ];

  const collections = [
    {
      id: 'new-season',
      type: 'banner',
      name: { en: 'New season', ar: 'الموسم الجديد' },
      categoryId: 'women',
      banner: `data:image/svg+xml;utf8,${encodeURIComponent(svg('#6B4A3A'))}`,
      active: true,
      order: 1
    },
    {
      id: 'dresses-tile',
      type: 'tile',
      name: { en: 'Dresses', ar: 'فساتين' },
      categoryId: 'women-dresses',
      image: `data:image/svg+xml;utf8,${encodeURIComponent(svg('#D9CBB6'))}`,
      active: true,
      order: 2
    },
    {
      id: 'tops-tile',
      type: 'tile',
      name: { en: 'Tops', ar: 'بلوزات' },
      categoryId: 'women-tops',
      image: `data:image/svg+xml;utf8,${encodeURIComponent(svg('#D9E1DA'))}`,
      active: true,
      order: 3
    }
  ];

  const taxonomy = withTaxonomy
    ? {
      sizes: SIZES,
      colors: COLORS.map(({ id, name, hex }) => ({ id, name, hex }))
    }
    : {};

  return {
    version: 7,
    builtAt: BASE,
    productCount: products.length,
    products,
    categories,
    collections,
    taxonomy,
    governorates: [{ id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' }, minOrder: 500, active: true }],
    settings: {
      storeName: 'ProActive',
      freeShippingThreshold: 800,
      ordersOpen: true,
      minimumOrderAmount: 500,
      currency: 'EGP',
      announcement: null
    }
  };
}

/** The same catalogue as an empty snapshot: what an unmigrated database serves. */
export function buildEmptySnapshot() {
  return {
    version: 1,
    builtAt: BASE,
    productCount: 0,
    products: [],
    categories: [],
    collections: [],
    taxonomy: {},
    governorates: [],
    settings: { ordersOpen: true, minimumOrderAmount: 500, currency: 'EGP', freeShippingThreshold: 800 }
  };
}

export { COLORS, SIZES };