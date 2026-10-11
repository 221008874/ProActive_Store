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
  BottomSheet, Button, Checkbox, ColorDot, EmptyState, Field, IconBack, IconBag, IconChevron,
  IconFilter, Select, SkeletonGrid, ProductCard, loc, formatEGP
} from '../ui'
import { useCatalog, filterProducts, findVariant, SORTERS } from '../hooks/useCatalog'
import { fetchCategories } from '../services/catalog'
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

// Sizes and colours are derived from the catalogue rather than hard-coded, so a
// store that only stocks M and L does not offer XS.
function useFacets(products) {
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
    return {
      sizes: [...sizes].sort((a, b) => {
        const ia = SIZE_ORDER.indexOf(a)
        const ib = SIZE_ORDER.indexOf(b)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      }),
      colors: [...colors.values()].sort((a, b) => loc(a.name, 'en').localeCompare(loc(b.name, 'en'))),
      maxPrice
    }
  }, [products])
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

  return (
    <div className="pa-shop">
      {/* Header row: back, category name + count, search, bag */}
      <div className="pa-shop__head">
        <Link to="/home" className="pa-icon-btn" aria-label={L('back', 'Back', 'رجوع')}><IconBack /></Link>
        <div className="pa-shop__title">
          <h1>{title}</h1>
          <span className="pa-subtitle">{L('nItems', '{n} items', '{n} عنصر').replace('{n}', ordered.length)}</span>
        </div>
        <Link to="/cart" className="pa-icon-btn" aria-label={L('cart', 'Bag', 'العربية')}>
          <IconBag />
        </Link>
      </div>

      {/* Filter / sort bar, then the active chips */}
      <div className="pa-toolbar">
        <button type="button" className="pa-btn pa-btn--outline pa-btn--compact" onClick={() => setSheetOpen(true)}>
          <IconFilter width={18} height={18} />
          {L('filter', 'Filter', 'تصفية')}{count > 0 ? ` · ${count}` : ''}
        </button>
        <label className="pa-btn pa-btn--outline pa-btn--compact" style={{ gap: 6 }}>
          <span className="pa-subtitle" style={{ fontWeight: 700 }}>{L('sort', 'Sort', 'ترتيب')}:</span>
          <Select
            id="shop-sort"
            value={filters.sort}
            onChange={(e) => patchFilters({ sort: e.target.value })}
            aria-label={L('sort', 'Sort', 'ترتيب')}
            style={{ border: 0, height: 40, paddingInlineEnd: 26, width: 'auto', background: 'transparent' }}
          >
            {SORTS.map((s) => <option key={s} value={s}>{L(`sort_${s}`, SORT_LABELS[s][lang], SORT_LABELS[s][lang])}</option>)}
          </Select>
          <IconChevron dir="down" width={14} height={14} />
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

      {/* Desktop: the filters stay open as a sidebar instead of a sheet. */}
      <div className="pa-layout-shop">
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

        <div>
          {loading && <SkeletonGrid count={8} />}

          {!loading && error && (
            <div className="pa-empty" role="alert">
              <div className="pa-empty__title" style={{ color: 'var(--pa-sale)' }}>{L('loadFailed', 'Could not load products', 'تحميل المنتجات فشل')}</div>
              <p className="pa-empty__body">{L('checkConnection', 'Check your connection and try again.', 'راجع الاتصال وجرب تاني.')}</p>
            </div>
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
            <div style={{ padding: '24px var(--pa-gutter) 48px', display: 'flex', justifyContent: 'center' }}>
              <Button variant="outline" onClick={() => setVisible((v) => v + 24)}>
                {L('loadMore', 'Load more', 'عرض المزيد')} · {ordered.length - visible} {L('remaining', 'left', 'متبقي')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {sheetOpen && (
        <BottomSheet
          title={L('filterSort', 'Filter and sort', 'تصفية وترتيب')}
          onClose={() => setSheetOpen(false)}
          footer={
            <Button block onClick={() => setSheetOpen(false)}>
              {L('showNItems', 'Show {n} items', 'عرض {n} منتج').replace('{n}', ordered.length)}
            </Button>
          }
        >
          <FilterPanel
            filters={filters}
            facets={facets}
            lang={lang}
            L={L}
            onPatch={patchFilters}
            onClear={() => write(new URLSearchParams())}
            resultCount={ordered.length}
            onApply={() => setSheetOpen(false)}
          />
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

/** The filter body, shared by the sheet (phone) and the sidebar (desktop). */
function FilterPanel({ filters, facets, lang, L, onPatch, onClear, resultCount, onApply }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <div className="pa-group-title">{L('sortBy', 'Sort by', 'ترتيب حسب')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

      <section>
        <div className="pa-group-title">{L('price', 'Price', 'السعر')}</div>
        {/* Two range inputs, not a custom slider: they are keyboard operable,
            screen-reader labelled and need no JS to drag. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field id="f-min" type="range" min={0} max={facets.maxPrice} step={10}
            label={`${L('from', 'From', 'من')} · ${formatEGP(price, lang)}`}
            value={price}
            onChange={(e) => { setPrice(Number(e.target.value)); }}
            onMouseUp={commitPrice}
            onTouchEnd={commitPrice}
            onKeyUp={commitPrice}
            style={{ padding: 0, height: 24, border: 0 }}
          />
          <Field id="f-max" type="range" min={0} max={facets.maxPrice} step={10}
            label={`${L('to', 'To', 'إلى')} · ${formatEGP(maxPrice, lang)}`}
            value={maxPrice}
            onChange={(e) => { setMaxPrice(Number(e.target.value)); }}
            onMouseUp={commitPrice}
            onTouchEnd={commitPrice}
            onKeyUp={commitPrice}
            style={{ padding: 0, height: 24, border: 0 }}
          />
        </div>
      </section>

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
