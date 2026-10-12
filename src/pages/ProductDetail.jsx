// Product page.
//
// Phone: gallery, breadcrumb, title, price, colour, size, delivery box,
// accordions, "you may also like", sticky Add to bag.
// Desktop >=1024: two columns — vertical thumbnails + main image on the left,
// the info column on the right, no sticky bar.
//
// Colour and size are the product in this model: a line in the bag is one
// variant, so "Add to bag" stays disabled until BOTH are chosen and the size
// pills carry their own stock. Sold-out sizes stay visible and crossed out
// rather than disappearing, because "would have fitted" is information too.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useToast } from '../ui/overlays'
import { analytics } from '../services/analytics'
import {
  Accordion, Badge, Button, ColorDot, EmptyState, ErrorState, IconHeart, IconShare,
  PriceTag, ProductCard, ProductRail, SizePicker, Skeleton, StockHint, thumb,
  formatEGP, loc
} from '../ui'
import {
  selectColor as pickColor, selectSize as pickSize,
  selectionIsComplete, colorsOf, sizesOf, imagesForColor, primaryImage
} from '../utils/variantSelection'
import { fetchProduct, fetchActiveProducts } from '../services/catalog'
import { getFreeShippingThreshold, getWhatsAppNumber } from '../services/settings'
import { CURRENCY } from '../config/currency'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { addToCart } = useCart()
  const { has, toggle: toggleSave } = useWishlist()
  const toast = useToast()

  const [product, setProduct] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [selection, setSelection] = useState({ colorId: null, size: null })
  const [slide, setSlide] = useState(0)
  const [sheet, setSheet] = useState(false)
  const [related, setRelated] = useState([])
  const [threshold, setThreshold] = useState(CURRENCY.freeShippingThreshold)
  const [whatsAppNumber, setWhatsAppNumber] = useState(null)

  // Fetch WhatsApp number for the "Ask about size" button.
  useEffect(() => {
    getWhatsAppNumber().then(setWhatsAppNumber)
  }, [])

  const L = label(t, lang)
  const saved = product ? has(product.id) : false

  // Navigating from one product to the next keeps the previous product's
  // gallery, selection and quantity on screen until the new one arrives, so
  // reset them. Adjusting during render (rather than in the effect below)
  // keeps this out of the cascading-render trap and re-renders once.
  const [loadedId, setLoadedId] = useState(id)
  if (id !== loadedId) {
    setLoadedId(id)
    setProduct(null)
    setNotFound(false)
    setSelection({ colorId: null, size: null })
    setSlide(0)
    setQuantity(1)
  }

  useEffect(() => {
    let alive = true

    fetchProduct(id)
      .then((p) => { if (!alive) return; p ? (setProduct(p), analytics.viewItem(p)) : setNotFound(true) })
      .catch(() => { if (alive) setNotFound(true) })

    // "You may also like": the same category, everything else. A second read is
    // acceptable here because the catalogue is cached locally.
    fetchActiveProducts()
      .then((list) => {
        if (!alive) return
        const current = list.find((p) => p.id === id)
        setRelated(list
          .filter((p) => p.id !== id && (!current?.categoryId || p.categoryId === current.categoryId))
          .slice(0, 10))
      })
      .catch(() => {})

    getFreeShippingThreshold().then((v) => { if (alive) setThreshold(v) }).catch(() => {})
    return () => { alive = false }
  }, [id])

  const hasVariants = Boolean(product?.variants?.length)
  const colors = hasVariants ? colorsOf(product) : []
  const sizes = hasVariants && selection.colorId ? sizesOf(product, selection.colorId) : []
  const variantReady = !hasVariants || selectionIsComplete(product, selection)

  const selected = hasVariants
    ? (product.variants ?? []).find((v) => v.colorId === selection.colorId && v.size === selection.size)
    : null

  const price = Number(selected?.priceOverride ?? product?.price ?? 0)
  const compareAt = Number(selected?.compareAtPrice ?? product?.compareAtPrice ?? 0)
  const stock = Number(selected?.stock ?? product?.stock ?? 0)
  const inStock = stock > 0

  const gallery = useMemo(() => (
    hasVariants ? imagesForColor(product, selection.colorId) : (product?.images ?? [])
  ), [hasVariants, product, selection.colorId])
  const heroImg = primaryImage(product, selection.colorId) ?? product?.imageUrl ?? null
  const safeSlide = gallery.length ? Math.min(slide, gallery.length - 1) : 0

  const title = product ? loc(product.title ?? product.name, lang) : ''
  const selectedColor = colors.find((c) => c.id === selection.colorId)

  const handleAdd = useCallback(() => {
    if (!inStock || !variantReady) return
    const variant = hasVariants ? selected : null
    const result = addToCart(product, quantity, variant)
    if (result?.success === false) {
      toast.show(result.message ?? L('addFailed', 'Could not add to bag', 'متسناش نضيف'))
      return
    }
    toast.show(L('addedToBag', 'Added to bag', 'تم الإضافة للعربية'), {
      actionLabel: L('viewBag', 'View bag', 'عرض العربية'),
      onAction: () => navigate('/cart')
    })
  }, [addToCart, hasVariants, inStock, L, navigate, product, quantity, selected, toast, variantReady])

  const share = useCallback(async () => {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title, url }); return }
      await navigator.clipboard.writeText(url)
      toast.show(L('linkCopied', 'Link copied', 'تم نسخ الرابط'))
    } catch {
      // A cancelled share sheet is not an error worth a toast.
    }
  }, [title, toast, L])

  if (notFound) {
    return (
      <div className="pa-container" style={{ paddingBlock: 64 }}>
        <EmptyState
          title={L('notFound', 'This product is no longer available', 'المنتج ده مش متاح')}
          body={L('notFoundBody', 'It may have sold out or been archived.', 'يمكن يكون خلص أو اتأرشف.')}
          actionLabel={L('backToShop', 'Back to the shop', 'رجوع للمتجر')}
          to="/shop"
          as={Link}
        />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="pa-container" style={{ paddingBlock: 24, display: 'grid', gap: 24, gridTemplateColumns: '1fr' }}>
        <Skeleton variant="card" height={440} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton variant="line" width="60%" height={22} />
          <Skeleton variant="line" width="35%" />
          <Skeleton variant="line" count={3} width="80%" />
        </div>
      </div>
    )
  }

  const pct = compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0

  return (
    <div className="pa-pdp pa-pdp--desktop">
      {/* ------------------------------- gallery ---------------------------- */}
      <div>
        <div className="pa-pdp__block">
          <div className="pa-card__photo" style={{ aspectRatio: '4 / 5', maxHeight: 440 }}>
            {heroImg && <img src={thumb(heroImg, 1000)} alt={title} width={1000} height={1250} />}
            {pct > 0 && <Badge kind="sale" className="pa-card__badge">-{pct}%</Badge>}
            {/* Swipe hint: the counter is the accessible equivalent of the bars. */}
            {gallery.length > 1 && <span className="pa-pdp__count">{safeSlide + 1} / {gallery.length}</span>}
          </div>
          {gallery.length > 1 && (
            <div className="pa-pdp__thumbs">
              {gallery.map((img, i) => (
                <button
                  key={img.url ?? i}
                  type="button"
                  aria-pressed={i === safeSlide}
                  aria-label={`${L('image', 'Image', 'صورة')} ${i + 1}`}
                  onClick={() => setSlide(i)}
                >
                  <img src={thumb(img.url, 200)} alt="" width={72} height={90} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------- info ------------------------------ */}
      <div>
        <div className="pa-pdp__block">
          <nav className="pa-subtitle" aria-label="Breadcrumb">
            <Link to="/shop">{L('allProducts', 'All products', 'كل المنتجات')}</Link>
            {' / '}
            <span>{title}</span>
          </nav>
          <div className="pa-pdp__head">
            <h1>{title}</h1>
            <div style={{ display: 'flex', gap: 2 }}>
              <button type="button" className="pa-icon-btn" aria-label={L('share', 'Share', 'مشاركة')} onClick={share}>
                <IconShare width={22} height={22} />
              </button>
              <button type="button" className="pa-icon-btn" aria-label={L('save', 'Save', 'حفظ')}
                aria-pressed={saved} onClick={() => toggleSave(product.id)}>
                <IconHeart width={22} height={22} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
          <PriceTag price={price} compareAtPrice={compareAt} lang={lang} large />
          <p className="pa-subtitle" style={{ margin: 0 }}>
            {L('codNotice', 'Cash on delivery.', 'الدفع عند الاستلام.')} {L('freeShippingOver', 'Free shipping over', 'شحن مجاني فوق')}{' '}
            <bdi>{formatEGP(threshold, lang)}</bdi>.
          </p>
        </div>

        {hasVariants ? (
          <>
            <div className="pa-pdp__block">
              <div className="pa-pdp__label">
                {L('color', 'Colour', 'اللون')}
                {selectedColor && <span>: {loc(selectedColor.name, lang)}</span>}
              </div>
              <div className="pa-swatches">
                {colors.map((c) => (
                  <ColorDot key={c.id} color={c} lang={lang}
                    selected={selection.colorId === c.id}
                    onSelect={() => {
                      const next = pickColor(product, selection, c.id)
                      setSelection(next)
                      if (next.colorId) analytics.selectItem(product, loc(next.color?.name, lang) ?? next.colorId, selection.size)
                    }} />
                ))}
              </div>
            </div>

            <div className="pa-pdp__block">
              <div className="pa-pdp__label">
                {L('size', 'Size', 'المقاس')}
                {selection.size && <span>: {selection.size}</span>}
                <Link className="pa-pdp__guide" to="/about">{L('sizeGuide', 'Size guide', 'دليل المقاسات')}</Link>
                <button
                  type="button"
                  className="pa-pdp__guide pa-pdp__guide--whatsapp"
                  onClick={() => {
                    if (!whatsAppNumber) return
                    const message = L('askAboutSizeMessage', 'Hi, I\'d like to ask about the size for {product} in {color} / {size}.', 'مرحباً، عايز أسأل عن مقاس {product} باللون {color} / المقاس {size}.')
                      .replace('{product}', product.title?.en ?? product.title?.ar ?? '')
                      .replace('{color}', selectedColor ? loc(selectedColor.name, lang) : '')
                      .replace('{size}', selection.size ?? '')
                    const url = `https://wa.me/${whatsAppNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`
                    window.open(url, '_blank')
                    analytics.whatsappClick?.('ask_about_size')
                  }}
                  aria-label={L('askAboutSizeAria', 'Ask us about size on WhatsApp', 'اسألنا عن المقاس على واتساب')}
                >
                  <IconWhatsApp width={18} height={18} aria-hidden="true" />
                  {L('askAboutSize', 'Ask about size', 'اسأل على المقاس')}
                </button>
              </div>
              <SizePicker
                sizes={sizes.map((s) => s.size)}
                value={selection.size}
                stockBySize={Object.fromEntries(sizes.map((s) => [s.size, s.stock]))}
                onChange={(size) => {
                  setSelection((s) => pickSize(product, s.colorId, size))
                  const nextColor = pickSize(product, selection, size).colorId
                  if (nextColor && size) analytics.selectItem(product, loc(selection.colorId ? product.colors?.find(c => c.id === selection.colorId)?.name : null, lang) ?? '', size)
                }}
              />
              <StockHint stock={stock} where={selectedColor ? `in ${loc(selectedColor.name, lang)}` : ''} />
              {!variantReady && (
                <div className="pa-error">
                  {L('selectBoth', 'Choose a colour and a size to continue.', 'اختار اللون والمقاس عشان تكمل.')}
                </div>
              )}
            </div>

            <div className="pa-pdp__block">
              <div className="pa-pdp__label">{L('quantity', 'Quantity', 'الكمية')}</div>
              <Stepper value={quantity} onChange={setQuantity} max={Math.max(1, stock)} L={L} />
            </div>
          </>
        ) : (
          <div className="pa-pdp__block">
            <div className={inStock ? 'pa-ok' : 'pa-error'} style={{ fontSize: 13, fontWeight: 700 }}>
              {inStock ? L('inStock', `In stock: ${stock}`, `متوفر: ${stock}`) : L('soldOut', 'Sold out', 'نفذت الكمية')}
            </div>
          </div>
        )}

        {/* Delivery box: the shopper's own governorate, so the number is theirs. */}
        <div className="pa-delivery">
          <span>
            <b>{L('deliverTo', 'Deliver to', 'التوصيل إلى')}</b>{' '}
            <span className="pa-subtitle">{L('chooseAtCheckout', 'chosen at checkout', 'تختاره عند الطلب')}</span>
          </span>
          <Link className="pa-btn pa-btn--outline pa-btn--compact" to="/cart">
            {L('change', 'Change', 'تغيير')}
          </Link>
        </div>

        <Accordion
          openId="desc"
          items={[
            {
              id: 'desc',
              title: L('description', 'Description', 'الوصف'),
              body: product.description
                ? <>{loc(product.description, lang)}</>
                : <span className="pa-subtitle">{L('noDescription', 'No description for this piece yet.', 'مفيش وصف للقطعة دي لسه.')}</span>
            },
            {
              id: 'material',
              title: L('materialCare', 'Material and care', 'الخامة والعناية'),
              body: <>{L('materialBody', 'Follow the care label. Contact us if you need details before ordering.', 'اتبع تعليمات العناية. تواصل معانا لو محتاج تفاصيل قبل الطلب.')}</>
            },
            {
              id: 'shipping',
              title: L('deliveryReturns', 'Delivery and returns', 'التوصيل والإرجاع'),
              body: (
                <>
                  {L('codAll', 'Cash on delivery to all 27 governorates.', 'الدفع عند الاستلام لكل الـ 27 محافظة.')}{' '}
                  {L('freeShippingOver', 'Free shipping over', 'شحن مجاني فوق')} <bdi>{formatEGP(threshold, lang)}</bdi>.
                </>
              )
            }
          ]}
        />

        {related.length > 0 && (
          <section className="pa-section" aria-labelledby="related">
            <div id="related" className="pa-section__head" style={{ paddingInline: 0 }}>
              <h2 className="pa-section__title" style={{ fontSize: 20 }}>{L('youMayLike', 'You may also like', 'يمكن يعجبك كمان')}</h2>
            </div>
            <ProductRail>
              {related.map((p) => (
                <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`}
                  labels={{ soldOut: L('soldOut', 'Sold out', 'نفذت الكمية'), onlyLeft: (n) => L('onlyNLeft', `Only ${n} left`, `باقي ${n} بس`) }} />
              ))}
            </ProductRail>
          </section>
        )}
      </div>

      {/* ------------------------------ sticky bar --------------------------- */}
      <div className="pa-sticky">
        <Button
          variant="outline"
          className="pa-icon-btn--box"
          aria-label={L('save', 'Save', 'حفظ')}
          aria-pressed={saved}
          onClick={() => toggleSave(product.id)}
        >
          <IconHeart width={22} height={22} fill={saved ? 'currentColor' : 'none'} />
        </Button>
        <Button size="lg" onClick={handleAdd} disabled={!inStock || !variantReady}>
          {!inStock ? L('soldOut', 'Sold out', 'نفذت الكمية')
            : !variantReady ? L('selectASize', 'Select a size', 'اختار مقاس')
              : `${L('addToBag', 'Add to bag', 'ضيف للعربية')} · ${formatEGP(price * quantity, lang)}`}
        </Button>
      </div>

      {/* Phone: the desktop two-column info is long, so a Jump-to-bag affordance
          lives in the sheet-free flow via the bag link in the shell. */}
      {sheet && (
        <BottomSheet title={L('sizeGuide', 'Size guide', 'دليل المقاسات')} onClose={() => setSheet(false)}>
          <p className="pa-subtitle">{L('sizeGuideBody', 'Measurements are on each product. Contact us if you are between sizes.', 'القياسات موجودة على كل منتج. تواصل معانا لو انت بين مقاسين.')}</p>
        </BottomSheet>
      )}
    </div>
  )
}

/** Local quantity stepper: 44x40 controls, capped at the variant's stock. */
function Stepper({ value, onChange, max, L }) {
  return (
    <div className="pa-qty">
      <button type="button" aria-label={L('decrease', 'Decrease quantity', 'تقليل الكمية')}
        disabled={value <= 1} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={L('increase', 'Increase quantity', 'زيادة الكمية')}
        disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}
