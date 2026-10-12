// The store's size and colour vocabulary.
//
// The live source is the `taxonomy` field of egp_settings/taxonomy, carried on
// the catalogue snapshot (see server/_core/catalogCore.js). These are the
// values used when that document is missing or empty — a brand-new database, or
// one whose settings have not been filled in yet.
//
// The reason they exist: the filter panel used to build its facets purely from
// the products it had loaded, so a shop with nothing published showed "Size"
// and "Colour" headings above nothing at all, and a price range of 0 – 0. A
// facet section with no options is a defect; these defaults mean the sections
// have a vocabulary to draw from even when the catalogue is still empty.

/** XS–XXL, the order the size chips are laid out in. */
export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/**
 * The neutral palette from the design board. Named in both languages because
 * the swatch is announced by name to a screen reader, not by hex.
 */
export const DEFAULT_COLORS = [
  { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#1A1A1A' },
  { id: 'white', name: { en: 'White', ar: 'أبيض' }, hex: '#F5F3EF' },
  { id: 'beige', name: { en: 'Beige', ar: 'بيج' }, hex: '#D9CBB6' },
  { id: 'olive', name: { en: 'Olive', ar: 'زيتي' }, hex: '#5E6046' },
  { id: 'burgundy', name: { en: 'Burgundy', ar: 'عنابي' }, hex: '#6B2233' },
  { id: 'navy', name: { en: 'Navy', ar: 'كحلي' }, hex: '#26324B' }
];

/** The whole default taxonomy document. */
export const DEFAULT_TAXONOMY = {
  sizes: DEFAULT_SIZES,
  colors: DEFAULT_COLORS
};

/**
 * Fills in whatever the stored taxonomy is missing, so a partially filled
 * document (sizes but no colours) still yields both.
 */
export function withTaxonomyDefaults(taxonomy) {
  const sizes = Array.isArray(taxonomy?.sizes) && taxonomy.sizes.length ? taxonomy.sizes : DEFAULT_SIZES;
  const colors = Array.isArray(taxonomy?.colors) && taxonomy.colors.length ? taxonomy.colors : DEFAULT_COLORS;
  return { ...taxonomy, sizes, colors };
}