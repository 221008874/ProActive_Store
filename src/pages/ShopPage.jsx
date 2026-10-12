// Shop: browse, filter, sort.
//
// One page serves every listing the store has — the whole catalogue, a category
// (?category=), a gender, a sale listing (?sale=1) and search results (?q=) —
// because they are all the same grid with different defaults, and separate pages
// would each need their own filter state.
//
// Filters live in the URL (utils/filterUrl.js) so a view is shareable and the
// back button undoes a filter. Filtering is client-side over the cached active
// catalogue: the snapshot already carries price, colours, sizes and totalStock,
// so a filter never re-reads Firestore.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useToast } from '../ui/overlays'
import {
  BottomSheet, Button, Checkbox, ColorDot, EmptyState, ErrorState, IconBack, IconBag, IconChevron,
  IconFilter, IconSort, Select, SkeletonGrid, ProductCard, loc, formatEGP
} from '../ui'
import { useCatalog, filterProducts, findVariant, SORTERS } from '../hooks/useCatalog'
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { fetchCategories, fetchTaxonomy } from '../services/catalog'
import {
  filtersFromParams, paramsFromFilters, activeFilterChips, removeChip, SORTS
} from '../utils/filterUrl'

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL']

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

// Sizes and colours are derived from the catalogue merged with taxonomy,
// so a store that only stocks M and L still offers the full vocabulary from taxonomy.
function useFacets(products) {
  const [taxonomy, setTaxonomy] = useState({ sizes: [], colors: [] })

  useEffect(() => {
    fetchTaxonomy().then(setTaxonomy).catch(() => {})
  }, [])

  return useMemo(() => {
    const sizes = new Set()
    const colors = new Map()
    let maxPrice = 0

    for (const p of products) {
      for (const s of p.availableSizes ?? []) sizes.add(s)
      for (const c of p.colors ?? []) {
        if (p.availableColors?.length && !p.availableColors.includes(c.id)) continue
        if (!colors.has(c.id)) colors.set(c.id, c)
      }
      const top = Math.max(Number(p.price) || 0, Number(p.compareAtPrice) || 0)
      if (top > maxPrice) maxPrice = top
    }

    // Merge with taxonomy: taxonomy provides the vocabulary, products provide availability
    const taxonomySizes = taxonomy.sizes ?? []
    const taxonomyColors = taxonomy.colors ?? []

    // Only include taxonomy sizes that have at least some products, OR all if no products have sizes
    const hasProductSizes = sizes.size > 0
    const mergedSizes = hasProductSizes
      ? [...sizes].sort((a, b) => {
          const ia = SIZE_ORDER.indexOf(a)
          const ib = SIZE_ORDER.indexOf(b)
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
      : taxonomySizes

    // Only include taxonomy colors that have at least some products, OR all if no products have colors
    const hasProductColors = colors.size > 0
    const mergedColors = hasProductColors
      ? [...colors.values()].sort((a, b) => loc(a.name, 'en').localeCompare(loc(b.name, 'en')))
      : taxonomyColors

    return {
      sizes: mergedSizes,
      colors: mergedColors,
      maxPrice
    }
  }, [products, taxonomy])
}

export default function ShopPage() {
  const { t, lang } = useLanguage()
  const { addToCart } = useCart()
  const { has, toggle: toggleSave } = useWishlist()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const { products, loading, error } = useCatalog()
  const [categories, setCategories] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)

  // Desktop renders the filters as a sidebar and phones as a sheet. React
  // decides which one exists — never both — so the sheet's controls are not in
  // the page, or the tab order, while it is shut. `sheetOpen && !desktop`
  // covers a window that grows into a desktop while the sheet is up: the
  // sidebar takes over and the sheet goes away with it.
  const desktop = useMediaQuery(DESKTOP_QUERY)

  const L = label(t, lang)
  const filters = useMemo(() => filtersFromParams(params), [params])
  const facets = useFacets(products)

  useEffect(() => {
    let alive = true
    fetchCategories().then((list) => { if (alive) setCategories(list) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const category = categories.find((c) => c.id === filters.categoryId)
  const results = useMemo(() => filterProducts(products, filters), [products, filters])
  const paramKey = params.toString()

  // Pagination resets whenever the query changes, including on a back/forward
  // that did not go through `write`. Adjusting during render (rather than in an
  // effect) keeps this out of the cascading-render trap and re-renders once.
  const [lastKey, setLastKey] = useState(paramKey)
  const [visible, setVisible] = useState(24)
  if (paramKey !== lastKey) {
    setLastKey(paramKey)
    setVisible(24)
  }

  const write = useCallback((next) => {
    setParams(next, { replace: true })
  }, [setParams])

  // Sold-out products sort last and are dimmed, so a shopper scanning the grid
  // meets what they can actually buy first.
  const ordered = useMemo(() => {
    const inStock = results.filter((p) => (p.totalStock ?? 0) > 0)
    const out = results.filter((p) => (p.totalStock ?? 0) <= 0)
    return [...inStock, ...out]
  }, [results])

  const shown = useMemo(() => ordered.slice(0, visible), [ordered, visible])

  const patchFilters = useCallback((patch) => {
    write(paramsFromFilters({ ...filters, ...patch }))
  }, [filters, write])

  const { chips, count } = useMemo(() => activeFilterChips(filters, {
    resolve: {
      category: category ? loc(category.name, lang) : undefined,
      gender: filters.gender ? L(filters.gender === 'women' ? 'women' : filters.gender === 'men' ? 'men' : 'kids', filters.gender, filters.gender) : undefined,
      sale: L('onSaleOnly', 'On sale', 'عليه خصم'),
      stock: L('inStockOnly', 'In stock', 'متاح'),
      from: L('from', 'From', 'من')
    }
  }), [filters, category, lang, L])

  const quickSizes = useMemo(() => {
    const all = new Set()
    for (const p of products) for (const s of p.availableSizes ?? []) all.add(s)
    return [...all].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)).slice(0, 4)
  }, [products])

  const handleQuickAdd = useCallback((product, size) => {
    // Quick add needs a colour too: take the first colour that stocks this size,
    // so the tap lands on a variant that is actually buyable.
    const colorId = (product.availableColors ?? [])[0]
    const variant = colorId ? findVariant(product, colorId, size) : null
    if (!variant || (variant.stock ?? 0) <= 0) {
      toast.show(L('sizeSoldOut', 'That size just sold out', 'المقاس ده خلص'))
      return
    }
    const result = addToCart(product, 1, variant)
    toast.show(result?.success === false
      ? (result.message ?? L('addFailed', 'Could not add', 'متسناش'))
      : L('addedToBag', 'Added to bag', 'تم الإضافة للعربية'), { actionLabel: L('viewBag', 'View bag', 'عرض العربية'), actionHref: '/cart' })
  }, [addToCart, toast, L])

  const title = category ? loc(category.name, lang)
    : filters.sale ? L('sale', 'Sale', 'تخفيضات')
      : filters.q ? `${L('searchResults', 'Results for', 'نتائج')} "${filters.q}"`
        : L('allProducts', 'All products', 'كل المنتجات')

  const itemCount = L('nItems', '{n} items', '{n} عنصر').replace('{n}', ordered.length)
  // Only one of the two sort affordances exists at a time: the toolbar dropdown
  // on desktop, the sheet's chips on a phone. Showing both is what the review
  // caught — a row of sort chips printed above a select that said the same thing.
  const sheetFilters = (
    <FilterPanel
      filters={filters}
      facets={facets}
      lang={lang}
      L={L}
      onPatch={patchFilters}
      onClear={() => write(new URLSearchParams())}
      resultCount={ordered.length}
      onApply={() => setSheetOpen(false)}
      showSort
    />
  )

  return (
    <div className="pa-shop">
      <div className="pa-container">
        {/* Phone-only: back, title + count, bag. The desktop heading below
            replaces the lot of it from 1024px up. */}
        <div className="pa-shop__head">
          <Link to="/home" className="pa-icon-btn" aria-label={L('back', 'Back', 'رجوع')}><IconBack /></Link>
          <div className="pa-shop__heading">
            <h1>{title}</h1>
            <span className="pa-subtitle">{itemCount}</span>
          </div>
          <Link to="/cart" className="pa-icon-btn" aria-label={L('cart', 'Bag', 'العربية')}>
            <IconBag />
          </Link>
        </div>

        {/* Desktop: breadcrumb, then the heading and the item count together. */}
        <div className="pa-shop__intro">
          <nav className="pa-shop__crumbs" aria-label={L('breadcrumb', 'Breadcrumb', 'مسار التصفح')}>
            <Link to="/home">{L('home', 'Home', 'الرئيسية')}</Link>
            <IconChevron dir="end" width={14} height={14} />
            <span aria-current="page">{title}</span>
          </nav>
          <div className="pa-shop__heading">
            <h1>{title}</h1>
            <span className="pa-subtitle">{itemCount}</span>
          </div>
        </div>

      <div className="pa-toolbar">
        {/* Phones open the filters in a sheet; the button carries the count so
            an active filter is visible without opening anything. */}
        <button type="button" className="pa-btn pa-btn--outline pa-btn--compact pa-shop__mobile-only"
          onClick={() => setSheetOpen(true)}>
          <IconFilter width={18} height={18} />
          {L('filter', 'Filter', 'تصفية')}{count > 0 ? ` · ${count}` : ''}
        </button>
        <button type="button" className="pa-btn pa-btn--outline pa-btn--compact pa-shop__mobile-only"
          onClick={() => setSheetOpen(true)}>
          <IconSort width={18} height={18} />
          {L('sort', 'Sort', 'ترتيب')}
        </button>

        {/* Desktop: the only sort control on the page. */}
        <label className="pa-shop__sort">
          <span className="pa-shop__sort-label">{L('sort', 'Sort', 'ترتيب')}</span>
          <Select
            id="shop-sort"
            value={filters.sort}
            onChange={(e) => patchFilters({ sort: e.target.value })}
            aria-label={L('sort', 'Sort', 'ترتيب')}
          >
            {SORTS.map((s) => <option key={s} value={s}>{L(`sort_${s}`, SORT_LABELS[s][lang], SORT_LABELS[s][lang])}</option>)}
          </Select>
        </label>
      </div>

      {chips.length > 0 && (
        <div className="pa-chips">
          {chips.map((c) => (
            <button key={c.key} type="button" className="pa-chip" onClick={() => write(removeChip(params, c))}>
              {c.label}
              <span aria-hidden="true" style={{ fontWeight: 700 }}>×</span>
            </button>
          ))}
          <button type="button" className="pa-chip" onClick={() => write(new URLSearchParams())}
            style={{ fontWeight: 700 }}>
            {L('clearAll', 'Clear all', 'مسح الكل')}
          </button>
        </div>
      )}

      <div className="pa-layout-shop">
        {/* Desktop only. The sheet is the same component, so the two layouts
            cannot drift apart; only one of them is ever mounted. */}
        {desktop && (
          <aside className="pa-sidebar-filters" aria-label={L('filters', 'Filters', 'التصفية')}>
            <FilterPanel
              filters={filters}
              facets={facets}
              lang={lang}
              L={L}
              onPatch={patchFilters}
              onClear={() => write(new URLSearchParams())}
              resultCount={ordered.length}
            />
          </aside>
        )}

        <div className="pa-shop__results">
          {loading && <SkeletonGrid count={8} />}

          {!loading && error && (
            <ErrorState
              title={L('loadFailed', 'Could not load products', 'تحميل المنتجات فشل')}
              body={L('checkConnection', 'Check your connection and try again.', 'راجع الاتصال وجرب تاني.')}
              onRetry={() => window.location.reload()}
              retryLabel={L('retry', 'Try again', 'جرب تاني')}
            />
          )}

          {!loading && !error && ordered.length === 0 && (
            <EmptyState
              title={L('noMatches', 'No items match', 'مفيش منتجات مطابقة')}
              body={L('tryRemoving', 'Try removing a filter or searching for something else.', 'جرب تشيل فلتر أو تدور على حاجة تانية.')}
              actionLabel={L('clearFilters', 'Clear filters', 'شيل الفلاتر')}
              onAction={() => write(new URLSearchParams())}
            />
          )}

          {!loading && ordered.length > 0 && (
            <div className="pa-grid">
              {shown.map((p) => (
                <div key={p.id} className={p.totalStock <= 0 ? 'pa-card--dimmed' : undefined}>
                  <ProductCard
                    product={p}
                    lang={lang}
                    as={Link}
                    href={`/product/${p.id}`}
                    saved={has(p.id)}
                    onSave={() => toggleSave(p.id)}
                    quickSizes={quickSizes}
                    onQuickAdd={handleQuickAdd}
                    labels={{
                      onlyLeft: (n) => L('onlyNLeft', `Only ${n} left`, `باقي ${n} بس`),
                      add: L('add', 'Add', 'إضافة'),
                      size: L('size', 'size', 'مقاس')
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {visible < ordered.length && (
            <div className="pa-shop__more">
              <Button variant="outline" onClick={() => setVisible((v) => v + 24)}>
                {L('loadMore', 'Load more', 'عرض المزيد')} · {ordered.length - visible} {L('remaining', 'left', 'متبقي')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Closed means unmounted: the sheet's controls must not sit in the page
          (and the tab order) while it is shut. */}
      {sheetOpen && !desktop && (
        <BottomSheet
          title={L('filterSort', 'Filter and sort', 'تصفية وترتيب')}
          onClose={() => setSheetOpen(false)}
          footer={
            <Button block onClick={() => setSheetOpen(false)}>
              {L('showNItems', 'Show {n} items', 'عرض {n} منتج').replace('{n}', ordered.length)}
            </Button>
          }
        >
          {sheetFilters}
        </BottomSheet>
      )}
    </div>
  )
}

const SORT_LABELS = {
  newest: { en: 'Newest', ar: 'الأحدث' },
  bestselling: { en: 'Best selling', ar: 'الأكثر مبيعاً' },
  priceAsc: { en: 'Price: low to high', ar: 'السعر: من الأقل' },
  priceDesc: { en: 'Price: high to low', ar: 'السعر: من الأعلى' }
}


/* -------------------------------------------------------------------------- */

/** The filter body, shared by the sheet (phone) and the sidebar (desktop).
 *
 * `showSort` is the one difference between the two placements: a phone reaches
 * sorting through this panel, a desktop through the toolbar dropdown. Rendering
 * the same component in both places is what keeps the two from drifting; the
 * prop is what keeps them from both showing a sort control at once. */
function FilterPanel({ filters, facets, lang, L, onPatch, onClear, resultCount, onApply, showSort = false }) {
  const [price, setPrice] = useState(filters.minPrice ?? 0)
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ?? facets.maxPrice)

  const toggleIn = (key, value) => {
    const current = filters[key] ?? []
    onPatch({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] })
  }

  const commitPrice = () => {
    const min = Math.min(price, maxPrice)
    const max = Math.max(price, maxPrice)
    onPatch({
      minPrice: min > 0 ? min : null,
      maxPrice: max < facets.maxPrice ? max : null
    })
  }

  return (
    <div className="pa-filter-panel">
      {showSort && (
        <section>
          <div className="pa-group-title">{L('sortBy', 'Sort by', 'ترتيب حسب')}</div>
          <div className="pa-filter-panel__chips">
            {SORTS.map((s) => (
              <button key={s} type="button" className="pa-chip"
                aria-pressed={filters.sort === s}
                onClick={() => onPatch({ sort: s })}
                style={filters.sort === s ? { background: 'var(--pa-ink)', color: 'var(--pa-paper)' } : undefined}>
                {L(`sort_${s}`, SORT_LABELS[s][lang], SORT_LABELS[s][lang])}
              </button>
            ))}
          </div>
        </section>
      )}

      {facets.sizes.length > 0 && (
        <section>
          <div className="pa-group-title">{L('size', 'Size', 'المقاس')}</div>
          <div className="pa-sizes">
            {facets.sizes.map((s) => (
              <button key={s} type="button" className="pa-size"
                aria-pressed={filters.sizes.includes(s)}
                onClick={() => toggleIn('sizes', s)}>
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {facets.colors.length > 0 && (
        <section>
          <div className="pa-group-title">{L('color', 'Colour', 'اللون')}</div>
          <div className="pa-swatches">
            {facets.colors.map((c) => (
              <ColorDot key={c.id} color={c} lang={lang}
                selected={filters.colors.includes(c.id)}
                onSelect={() => toggleIn('colors', c.id)} />
            ))}
          </div>
        </section>
      )}

      {facets.maxPrice > 0 && (
        <section>
          <div className="pa-group-title" id="price-slider-label">
            {L('price', 'Price', 'السعر')}
            <span className="pa-price-readout">
              {formatEGP(Math.min(price, maxPrice), lang)} – {formatEGP(Math.max(price, maxPrice), lang)}
            </span>
          </div>
          {/* Dual-handle slider: two overlaid <input type="range"> with filled track.
              --min/--max go on the CONTAINER, not the inputs: they drive the
              ::after filled span, and custom properties do not inherit upwards. */}
          <div
            className="pa-price-slider"
            role="group"
            aria-labelledby="price-slider-label"
            style={{
              '--min': (Math.min(price, maxPrice) / facets.maxPrice) * 100,
              '--max': (Math.max(price, maxPrice) / facets.maxPrice) * 100
            }}
          >
            <input
              id="price-min"
              type="range"
              min={0}
              max={facets.maxPrice}
              step={10}
              value={price}
              onChange={(e) => { setPrice(Math.min(Number(e.target.value), maxPrice)); }}
              onMouseUp={commitPrice}
              onTouchEnd={commitPrice}
              onKeyUp={commitPrice}
              aria-label={L('from', 'From', 'من')}
            />
            <input
              id="price-max"
              type="range"
              min={0}
              max={facets.maxPrice}
              step={10}
              value={maxPrice}
              onChange={(e) => { setMaxPrice(Math.max(Number(e.target.value), price)); }}
              onMouseUp={commitPrice}
              onTouchEnd={commitPrice}
              onKeyUp={commitPrice}
              aria-label={L('to', 'To', 'إلى')}
            />
          </div>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Checkbox id="f-sale" label={L('onSaleOnly', 'On sale only', 'عليه خصم بس')}
          checked={filters.onSale} onChange={(v) => onPatch({ onSale: v })} />
        <Checkbox id="f-stock" label={L('inStockOnly', 'In stock only', 'المتاح بس')}
          checked={filters.inStockOnly} onChange={(v) => onPatch({ inStockOnly: v })} />
      </section>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="outline" onClick={onClear}>{L('clearAll', 'Clear all', 'مسح الكل')}</Button>
        {onApply && <Button onClick={onApply}>{L('showNItems', 'Show {n} items', 'عرض {n} منتج').replace('{n}', resultCount)}</Button>}
      </div>
    </div>
  )
}
