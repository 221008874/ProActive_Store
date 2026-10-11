// Product detail page.
//
// Data logic is unchanged: read the product, read its `variants` subcollection,
// let the shopper choose a colour then a size, and add the chosen variant to the
// cart. All of that lives in utils/variantSelection.js and is unit tested.
//
// Presentation moved to the design system: .pa-pdp, .pa-pdp__block, .pa-acc,
// .pa-sticky plus PriceTag / ColorSwatches / SizePicker / StockHint / QtyStepper.
// The 950 lines of hand-animated inline styles this replaces are gone.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useLocation } from '../context/LocationContext'
import { db } from '../services/firebase'
import { productsCollection } from '../config'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import {
  initialSelection,
  selectColor as pickColor,
  selectSize as pickSize,
  selectionIsComplete,
  colorsOf,
  sizesOf,
  imagesForColor,
  primaryImage
} from '../utils/variantSelection'
import StoreFooter from '../components/StoreFooter'
import { loc } from '../utils/i18n.js'
import { PriceTag, StockHint, SizePicker, ColorSwatches, QtyStepper, thumb } from '../ui'
import { analytics } from '../services/analytics'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { addToCart } = useCart()
  const { currency } = useLocation()

  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedFlavor, setSelectedFlavor] = useState(null)
  // Colour/size selection for the fashion model. Both stay null until the
  // shopper picks, so a migrated product cannot be added by accident.
  const [selection, setSelection] = useState({ colorId: null, size: null })
  const [flash, setFlash] = useState(null)

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  useEffect(() => {
    if (!id) {
      navigate('/home')
      return
    }

    let alive = true

    const fetchProduct = async () => {
      try {
        // Use currency-specific collection
        const collectionName = productsCollection(currency)
        const docRef = doc(db, collectionName, id)

        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()

          // Migrated products carry a variants subcollection; load it so the
          // shopper can pick a colour and size. Unmigrated products keep the
          // old single-variant behaviour untouched.
          let variants = []
          try {
            const variantSnap = await getDocs(collection(db, collectionName, id, 'variants'))
            variants = variantSnap.docs.map((v) => ({ id: v.id, ...v.data() }))
          } catch (variantErr) {
            console.warn('No variants for product', id, variantErr)
          }

          if (!alive) return
          const loaded = { id: docSnap.id, ...data, variants }
          setProduct(loaded)
          if (variants.length > 0) setSelection(initialSelection(loaded))
          // Legacy (pre-migration) products still carry a flat flavour list.
          if (data.flavors?.length > 0) setSelectedFlavor(data.flavors[0])
          analytics.viewItem(loaded)
        } else {
          navigate('/home')
        }
      } catch (err) {
        console.error('Error fetching product:', err)
        navigate('/home')
      }
    }

    if (currency) fetchProduct()
    return () => { alive = false }
  }, [id, navigate, currency])

  if (!product) {
    return (
      <div className="pa-container" style={{ paddingBlock: 48, minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <p className="pa-subtitle" role="status">{L('loadingProductDetails', 'Loading…', 'جاري تحميل تفاصيل المنتج…')}</p>
      </div>
    )
  }

  const hasVariants = Boolean(product?.variants?.length)
  const colors = hasVariants ? colorsOf(product) : []
  const sizes = hasVariants && selection.colorId ? sizesOf(product, selection.colorId) : []
  const variantReady = !hasVariants || selectionIsComplete(product, selection)

  const selected = hasVariants
    ? (product.variants ?? []).find((v) => v.colorId === selection.colorId && v.size === selection.size)
    : null

  // Prefer the variant's own numbers; an unmigrated product keeps flat fields.
  const price = Number(selected?.price ?? product?.price ?? 0)
  const compareAt = Number(selected?.compareAtPrice ?? product?.compareAtPrice ?? 0)
  const stock = Number(selected?.stock ?? product?.stock ?? 0)
  const isOutOfStock = stock <= 0
  const canAddToCart = stock >= quantity && variantReady

  const gallery = hasVariants
    ? imagesForColor(product, selection.colorId)
    : (product.images ?? [])
  const heroImg = primaryImage(product, selection.colorId) ?? product.imageUrl ?? null

  const title = loc(product.title ?? product.name, lang)

  const handleAddToCart = () => {
    if (isOutOfStock || !canAddToCart) return

    // Pass the chosen variant so the cart line is keyed on product + variant
    // and carries that variant's own stock and price.
    const variant = hasVariants ? selected : null

    for (let i = 0; i < quantity; i++) {
      addToCart({ ...product, selectedFlavor, currency }, 1, variant)
    }

    setFlash(L('addedToCart', 'Added to cart', 'تم الإضافة للعربية'))
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <>
      <div className="pa-pdp pa-pdp--desktop">
        <div>
          <div className="pa-pdp__block">
            <div className="pa-card__photo" style={{ aspectRatio: '3 / 4' }}>
              {heroImg && <img src={thumb(heroImg, 800)} alt={title} />}
            </div>
          </div>
          {gallery.length > 1 && (
            <div className="pa-pdp__block" style={{ flexDirection: 'row', overflowX: 'auto' }}>
              {gallery.map((img, i) => (
                <img key={i} src={thumb(img.url, 200)} alt="" width={64} style={{ flex: '0 0 auto', opacity: img.url === heroImg ? 1 : .6 }} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="pa-pdp__block">
            <h1 style={{ fontSize: 22 }}>{title}</h1>
            <PriceTag price={price} compareAtPrice={compareAt} lang={lang} large />
            <StockHint stock={stock} small />
            {!hasVariants && (
              <div className={`pa-error ${isOutOfStock ? '' : 'pa-ok'}`}>
                {isOutOfStock
                  ? L('outOfStock', 'Sold out', 'نفذت الكمية')
                  : L('inStock', `In stock: ${stock}`, `متوفر: ${stock}`)}
              </div>
            )}
          </div>

          {hasVariants && (
            <>
              <div className="pa-pdp__block">
                <div className="pa-pdp__label">
                  {L('selectColor', 'Colour', 'اللون')}
                  {' '}<span>{loc(colors.find((c) => c.id === selection.colorId)?.name, lang)}</span>
                </div>
                <ColorSwatches
                  colors={colors}
                  value={selection.colorId}
                  onChange={(colorId) => {
                    setSelection((s) => pickColor(product, s, colorId))
                    analytics.selectItem(product, colorId, null)
                  }}
                  lang={lang}
                />
              </div>

              {selection.colorId && (
                <div className="pa-pdp__block">
                  <div className="pa-pdp__label">
                    {L('selectSize', 'Size', 'المقاس')}{' '}
                    <span>{selection.size ?? (ar ? 'اختر مقاساً' : 'Pick a size')}</span>
                  </div>
                  <SizePicker
                    sizes={sizes.map((s) => s.size)}
                    value={selection.size}
                    stockBySize={Object.fromEntries(sizes.map((s) => [s.size, s.stock]))}
                    onChange={(size) => {
                      setSelection((s) => pickSize(product, s.colorId, size))
                      analytics.selectItem(product, selection.colorId, size)
                    }}
                  />
                  {hasVariants && !variantReady && (
                    <div className="pa-error">{L('selectSizeFirst', 'Please choose an available size.', 'اختر مقاساً متاحاً.')}</div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="pa-pdp__block">
            <div className="pa-pdp__label">{L('quantity', 'Quantity', 'الكمية')}</div>
            <QtyStepper value={quantity} onChange={setQuantity} min={1} max={Math.max(1, stock)} />
          </div>

          <div className="pa-sticky">
            <button
              type="button"
              className="pa-btn pa-btn--lg"
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              aria-disabled={!canAddToCart}
            >
              {L('addToCart', 'Add to bag', 'ضيف للعربية')}
            </button>
            <button type="button" className="pa-btn pa-btn--outline pa-btn--lg" onClick={() => navigate('/cart')}>
              {L('goToCart', 'Bag', 'العربية')}
            </button>
          </div>

          {product.description && (
            <div className="pa-acc">
              <details>
                <summary>{L('description', 'Description', 'الوصف')}</summary>
                <div className="pa-acc__body">{loc(product.description, lang)}</div>
              </details>
              <details>
                <summary>{L('shippingReturns', 'Shipping & returns', 'الشحن والإرجاع')}</summary>
                <div className="pa-acc__body">
                  {L('shippingHelp', 'Delivery across Egypt. Share or unsubscribe any time.', 'التوصيل لكل محافظات مصر. يمكنك التواصل معانا في أي وقت.')}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {flash && (
        <div className="pa-callout pa-ok" role="status" style={{ position: 'fixed', insetInline: 16, bottom: 88, zIndex: 35 }}>
          {flash}
        </div>
      )}

      <StoreFooter />
    </>
  )
}

