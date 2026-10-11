// Checkout state, shared by the three steps.
//
// The bag, the delivery form and the review screen are one flow: they share the
// cart, the governorate table, the coupon and the address, and only the step
// differs. Keeping that state in one hook means step 3 renders the same numbers
// step 1 computed, and a stock rejection anywhere can send the shopper back to
// the line it names.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { COLLECTIONS } from '../config'
import { getCurrencyConfig } from '../config/currency'
import { defaultGovernorateCosts } from '../config/egypt'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../context/LanguageContext'
import { postJson } from '../services/api'
import { analytics } from '../services/analytics'
import { paymentStatusFor } from '../utils/pricing'
import { classifyCheckoutError, linesForRejection } from '../utils/checkoutErrors'

export const STEPS = { bag: 1, delivery: 2, review: 3 }

// One currency, one product collection.
const PRODUCTS = getCurrencyConfig().collection

// The shopper's address. One shape from the delivery form to the API.
const EMPTY_ADDRESS = {
  name: '', phone: '', email: '', governorate: '',
  city: '', address: '', building: '', notes: '',
  latitude: null, longitude: null
}

export function useCheckout() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const {
    items, totalItems, totalPrice, deliveryInfo, setDeliveryInfo, clearDeliveryInfo,
    appliedCoupon, clearCart, updateQuantity, removeFromCart
  } = useCart()

  const [step, setStep] = useState(STEPS.bag)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  // Governorate documents carry cost, minOrder and active; the delivery step
  // needs all three.
  const [governorateDocs, setGovernorateDocs] = useState({})
  const [loadingGovernorates, setLoadingGovernorates] = useState(true)

  // Live stock and display data for each cart line. A line is a variant, so
  // availability comes from the variant document; the product supplies the rest.
  const [productDetails, setProductDetails] = useState({})
  const [stockErrors, setStockErrors] = useState({})

  const [ordersOpen, setOrdersOpen] = useState(true)
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(0)

  const [address, setAddress] = useState(() => ({ ...EMPTY_ADDRESS, ...(deliveryInfo ?? {}) }))
  const [formErrors, setFormErrors] = useState({})

  // One id per distinct bag: a retry replays the same order instead of placing
  // a twin, and editing the bag starts a new one.
  const clientOrderIdRef = useRef(null)
  const getClientOrderId = () => {
    if (!clientOrderIdRef.current) {
      clientOrderIdRef.current = crypto?.randomUUID
        ? crypto.randomUUID()
        : `co_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
    return clientOrderIdRef.current
  }
  const resetClientOrderId = () => { clientOrderIdRef.current = null }

  /* ------------------------------ load ------------------------------- */

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingGovernorates(true)
      try {
        const snap = await getDocs(collection(db, COLLECTIONS.governorateCosts))
        const docs = {}
        snap.docs.forEach((d) => { docs[d.id] = d.data() ?? {} })
        if (alive) setGovernorateDocs(docs)
      } catch (e) {
        console.error('Error loading governorate costs:', e)
        // Fall back to the built-in table so checkout is still usable against a
        // project whose governorates were never seeded.
        if (alive) setGovernorateDocs(defaultGovernorateCosts().reduce((acc, g) => {
          acc[g.id] = { name: { ar: g.nameAr, en: g.name }, cost: g.cost, minOrder: 0, active: true }
          return acc
        }, {}))
      } finally {
        if (alive) setLoadingGovernorates(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.settings, 'general'))
        const data = snap.exists() ? snap.data() : {}
        if (!alive) return
        setMinimumOrderAmount(Number(data.minimumOrderAmount ?? 0))
        // The owner's kill switch; the server refuses orders while it is off,
        // so surfacing it here only saves a round trip.
        setOrdersOpen(data.ordersOpen !== false)
      } catch (e) {
        console.error('Error loading store settings:', e)
        if (alive) { setMinimumOrderAmount(0); setOrdersOpen(true) }
      }
    })()
    return () => { alive = false }
  }, [])

  // Re-read every line's live stock whenever the bag changes, so a shopper who
  // left the tab open sees the truth before paying, not after.
  useEffect(() => {
    let alive = true
    if (items.length === 0) { setProductDetails({}); setStockErrors({}); return }

    ;(async () => {
      const details = {}
      const errors = {}
      await Promise.all(items.map(async (item) => {
        try {
          const productId = item.productId ?? String(item.id).split(':')[0]
          const variantId = item.variantId ?? (item.id.includes(':') ? item.id.split(':')[1] : null)

          const productSnap = await getDoc(doc(db, PRODUCTS, productId))
          if (!productSnap.exists()) {
            errors[item.id] = { type: 'UNAVAILABLE', available: 0, message: t('productNotAvailable') || 'Product no longer available' }
            return
          }

          const variantSnap = variantId
            ? await getDoc(doc(db, COLLECTIONS.productsCollection, productId, 'variants', variantId))
            : null
          const available = variantSnap?.exists()
            ? Number(variantSnap.data().stock ?? 0)
            : Number(productSnap.data().stock ?? 0)

          details[item.id] = { ...productSnap.data(), stock: available }

          if (available < item.quantity) {
            errors[item.id] = {
              type: 'INSUFFICIENT_STOCK', available, requested: item.quantity,
              message: t('onlyAvailable', { count: available }) || `Only ${available} available`
            }
          }
        } catch (err) {
          console.error('Error fetching product:', err)
        }
      }))
      if (!alive) return
      setProductDetails(details)
      setStockErrors(errors)
    })()
    return () => { alive = false }
  }, [items, t])

  /* ----------------------------- derived ----------------------------- */

  const selectedGovernorate = address.governorate || ''

  // The governorate's own minimum wins; the global setting is the fallback for
  // documents written before the min moved onto the governorate.
  // A stable identity for the table: its sorted ids plus the selected row's
  // own minimum. Enough to know when the minimum could have changed without
  // depending on an object that is new on every state update, which would make
  // the memo below recompute forever.
  const governorKey = Object.keys(governorateDocs ?? {}).sort().join(',')

  const effectiveMinimum = useMemo(() => {
    if (!selectedGovernorate) return 0
    const fromGovernorate = Number(governorateDocs[selectedGovernorate]?.minOrder ?? 0)
    return fromGovernorate > 0 ? fromGovernorate : minimumOrderAmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGovernorate, governorKey, minimumOrderAmount])

  const shipping = useMemo(() => {
    const gov = governorateDocs[selectedGovernorate]
    const cost = Number(gov?.cost ?? 0)
    if (!gov || gov.active === false) {
      return { cost: null, available: false, reason: 'governorateUnavailable' }
    }
    return { cost, available: true }
  }, [selectedGovernorate, governorateDocs])

  const invalidLines = Object.keys(stockErrors)
  const belowMinimum = effectiveMinimum > 0 && totalPrice < effectiveMinimum

  const canPlaceOrder =
    ordersOpen &&
    invalidLines.length === 0 &&
    !belowMinimum &&
    shipping.available &&
    isAddressComplete(address) &&
    !processing

  /* ----------------------------- actions ----------------------------- */

  const setField = useCallback((name, value) => {
    setAddress((prev) => ({ ...prev, [name]: value }))
    setFormErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const [showMap, setShowMap] = useState(false)

  const chooseGovernorate = useCallback((governorateId) => {
    setField('governorate', governorateId)
    // Picking a governorate is the first moment a precise delivery address
    // matters, so this is where the map and its permission prompt appear.
    setShowMap(true)
  }, [setField])

  // A complete address is remembered on the cart context, so leaving the page
  // and coming back does not retype it.
  useEffect(() => {
    if (isAddressComplete(address)) setDeliveryInfo(address)
  }, [address, setDeliveryInfo])

  const placeOrder = useCallback(async () => {
    if (!canPlaceOrder) return
    setProcessing(true)
    setError(null)

    analytics.beginCheckout(
      items.map((i) => ({ id: i.id, productId: i.productId, variantId: i.variantId, price: i.price, quantity: i.quantity, title: i.title, color: i.color, size: i.size })),
      totalPrice + (shipping.cost ?? 0)
    )

    try {
      const result = await postJson('/placeOrder', {
        cart: items.map((item) => ({
          productId: item.productId ?? String(item.id).split(':')[0],
          variantId: item.variantId ?? (item.id.includes(':') ? item.id.split(':')[1] : null),
          qty: item.quantity
        })),
        customer: { name: address.name, phone: address.phone, email: address.email || null },
        address: {
          governorateId: address.governorate,
          governorate: governorateDocs[address.governorate]?.name ?? address.governorate,
          city: address.city || null,
          street: address.address,
          building: address.building || null,
          notes: address.notes || null,
          lat: address.latitude ?? null,
          lng: address.longitude ?? null
        },
        couponCode: appliedCoupon?.code ?? null,
        clientOrderId: getClientOrderId(),
        source: 'web'
      })

      if (appliedCoupon) sessionStorage.setItem(`coupon_${appliedCoupon.code}_used`, 'true')

      const orderData = {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        status: 'pending',
        paymentStatus: paymentStatusFor('cod'),
        totalPrice: result.total,
        subtotal: result.subtotal,
        discount: result.discount,
        shippingCost: result.shippingCost,
        items: (result.items ?? []).map((item) => ({
          id: `${item.productId}:${item.variantId}`,
          productId: item.productId,
          variantId: item.variantId,
          name: item.title,
          title: item.title,
          unitPrice: item.unitPrice,
          price: item.unitPrice,
          quantity: item.qty,
          qty: item.qty,
          color: item.color,
          size: item.size,
          image: item.image ?? null
        })),
        customerName: result.customer?.name ?? address.name,
        customerEmail: result.customer?.email ?? null,
        customerPhone: result.customer?.phone ?? address.phone,
        address: {
          governorate: governorateDocs[address.governorate]?.name ?? address.governorate,
          city: address.city, street: address.address,
          building: address.building, notes: address.notes,
          lat: address.latitude, lng: address.longitude
        },
        coupon: result.coupon ?? (appliedCoupon ? { code: appliedCoupon.code, type: appliedCoupon.type, value: appliedCoupon.value } : null)
      }

      resetClientOrderId()
      clearCart()
      clearDeliveryInfo()

      analytics.purchase({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        totalPrice: result.total,
        items: result.items ?? []
      })

      // Router state for the immediate render, sessionStorage for a reload or a
      // link opened from the confirmation email.
      try { sessionStorage.setItem('lastOrder', JSON.stringify(orderData)) } catch { /* private mode */ }
      navigate('/order-success', { state: { orderId: result.orderId, orderData } })
      return { ok: true }
    } catch (e) {
      const rejection = classifyCheckoutError(e)

      // A stock rejection names the line that changed: mark that row so the
      // shopper sees exactly what to fix instead of a generic failure.
      if (rejection.code === 'OUT_OF_STOCK' || rejection.code === 'UNAVAILABLE') {
        const named = linesForRejection(rejection, items)
        if (named.length > 0) {
          setStockErrors((prev) => {
            const next = { ...prev }
            for (const id of named) {
              next[id] = {
                type: rejection.code, available: 0, requested: 1,
                message: rejection.code === 'OUT_OF_STOCK'
                  ? (t('outOfStockNow') || 'No longer available in that quantity')
                  : (t('productNotAvailable') || 'Product no longer available')
              }
            }
            return next
          })
        }
      }

      setError(rejection)
      // Fixable rejections belong where the shopper can act on them.
      if (rejection.step) setStep(rejection.step)
      setProcessing(false)
      return { ok: false, rejection }
    }
  }, [
    canPlaceOrder, items, address, governorateDocs, appliedCoupon, t, totalPrice, shipping.cost,
    clearCart, clearDeliveryInfo, navigate
  ])

  const dismissError = useCallback(() => setError(null), [])

  return {
    step, setStep, STEPS,
    items, totalItems, totalPrice,
    updateQuantity, removeFromCart,
    governorateDocs, loadingGovernorates,
    productDetails, stockErrors, setStockErrors,
    invalidLines, belowMinimum, effectiveMinimum,
    shipping, ordersOpen, minimumOrderAmount,
    address, setAddress, setField, chooseGovernorate, showMap,
    formErrors, setFormErrors,
    error, setError, dismissError,
    processing, placeOrder, canPlaceOrder
  }
}

function isAddressComplete(a) {
  return Boolean(a.name && a.phone && a.governorate && a.address)
}

export { EMPTY_ADDRESS }
