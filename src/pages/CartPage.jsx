// src/pages/CartPage.jsx — ProActive Fashion design system refactor.
//
// Logic is untouched (cart, governorate costs, coupons, Leaflet map editor and
// the checkout Firestore transaction all behave exactly as before). Only the
// markup changed: the ~2000 lines of hand-animated inline styles were replaced
// by the design system's BagLine / FreeShippingBar / Summary / Field / .pa-callout.
// src/pages/CartPage.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useLocation } from '../context/LocationContext'
import { db } from '../services/firebase'
import { COLLECTIONS } from '../config'
import { getCurrencyConfig, formatPrice as formatPriceFor } from '../config/currency'
import { getColors } from '../config/themes'
import { EGYPT_GOVERNORATES, defaultGovernorateCosts } from '../config/egypt'
import {
  computeShipping,
  computeTotals,
  paymentStatusFor,
  paymentMethodLabelFor
} from '../utils/pricing'
import { validateDeliveryForm } from '../utils/validation'
import { normalizeCouponCode } from '../utils/coupon'
import { getJson, postJson } from '../services/api'
import { analytics } from '../services/analytics'
import {
  collection,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore'
import { BagLine, FreeShippingBar, Summary, Field } from '../ui'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

// Server rejections, in the shopper's words. Keys are the codes
// /api/placeOrder and /api/coupon/preview answer with; the Arabic strings
// are the ones shown when the translation key is missing.
const CHECKOUT_REJECTIONS = {
  OUT_OF_STOCK: 'أحد المنتجات لم يعد متوفراً بالكمية المطلوبة',
  UNAVAILABLE: 'أحد المنتجات لم يعد متوفراً',
  COUPON_INVALID: 'كود الخصم لم يعد صالحاً',
  BELOW_MIN_ORDER: 'الطلب أقل من الحد الأدنى للمحافظة المختارة',
  GOVERNORATE_UNAVAILABLE: 'التوصيل إلى هذه المحافظة غير متاح حالياً',
  RATE_LIMITED: 'محاولات كثيرة، حاول مرة أخرى بعد عدة دقائق',
  DUPLICATE_SUSPECTED: 'يوجد طبيع مماثل تم تسجيله قبل قليل — راجع طلباتك الأخيرة',
  BLOCKED: 'لا يمكن إتمام هذا الطلب',
  ORDERS_CLOSED: 'الطلب متوقف مؤقتاً، حاول لاحقاً',
  CAPTCHA_FAILED: 'تحقق الأمان فشل، أعد تحميل الصفحة وحاول مجدداً',
  NETWORK_ERROR: 'تعذر الاتصال بالخادم، تحقق من الإنترنت وحاول مجدداً',
  SERVER_ERROR: 'حدث خطأ غير متوقع، حاول مرة أخرى'
}

const COUPON_REJECTIONS = {
  UNKNOWN: 'كود الخصم غير موجود',
  INACTIVE: 'كود الخصم غير مفعل',
  EXPIRED: 'انتهت صلاحية كود الخصم',
  EXHAUSTED: 'تم استخدام كود الخصم بالكامل',
  MIN_ORDER: 'إجمالي السلة أقل من الحد الأدنى لهذا الكود',
  INVALID: 'كود الخصم غير صالح'
}

export default function CartPage() {
  const {
    items,
    totalItems,
    totalPrice,
    removeFromCart,
    updateQuantity,
    clearCart,
    error: cartError,
    deliveryInfo,
    setDeliveryInfo,
    clearDeliveryInfo,
    appliedCoupon: contextAppliedCoupon,
    setAppliedCoupon: contextSetAppliedCoupon
  } = useCart()
  const { t, lang } = useLanguage()
  const { currency } = useLocation()
  const navigate = useNavigate()

  // ============ CURRENCY CONFIGURATION ============
  // Single EGP store - the config lives in config/currency.js.
  const currencyConfig = getCurrencyConfig()

  // ============ MAIN STATES ============
  const [isProcessing, setIsProcessing] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(contextAppliedCoupon)
  const [couponInput, setCouponInput] = useState('')
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  // ============ PAYMENT METHOD STATE ============
  const [paymentMethod, setPaymentMethod] = useState('cod')

  // ============ FULL-SCREEN MAP EDITOR STATES ============
  const [showMapEditor, setShowMapEditor] = useState(false)
  const [mapEditorCenter, setMapEditorCenter] = useState(null)
  const [mapEditorLoading, setMapEditorLoading] = useState(false)
  const [tempLocation, setTempLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  
  const mapRef = useRef(null)
  // Set the first time the governorate picker asks for a location, so the
  // browser prompt is triggered once per page rather than on every change.
  const locationRequested = useRef(false)
  const mapContainerRef = useRef(null)
  const markerRef = useRef(null)

  // ============ MINIMUM ORDER AMOUNT STATE ============
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(0)
  const [ordersOpen, setOrdersOpen] = useState(true)

  // ============ FIXED: Governorate-based shipping states ============
  const [governorateCosts, setGovernorateCosts] = useState({})
  const [selectedGovernorate, setSelectedGovernorate] = useState(deliveryInfo?.governorate || '')
  const [loadingGovernorates, setLoadingGovernorates] = useState(false)

  // ============ DELIVERY FORM STATES ============
  const [formData, setFormData] = useState({
    name: deliveryInfo?.name || '',
    phone: deliveryInfo?.phone || '',
    email: deliveryInfo?.email || '',
    address: deliveryInfo?.address || '',
    city: deliveryInfo?.city || '',
    governorate: deliveryInfo?.governorate || '',
    latitude: deliveryInfo?.latitude || null,
    longitude: deliveryInfo?.longitude || null
  })
  
  const [formErrors, setFormErrors] = useState({})
  const [showDeliveryForm, setShowDeliveryForm] = useState(!deliveryInfo)
  const [mapCenter, setMapCenter] = useState(null)
  const [mapError, setMapError] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)

  // ============ PROACTIVE FASHION: order data model ============
  // The browser no longer writes orders: /api/placeOrder validates prices,
  // stock and coupon against the database in one transaction and returns the
  // receipt payload. These two states are everything the page needs from it.
  const [checkoutError, setCheckoutError] = useState(null)
  const clientOrderIdRef = useRef(null)

  // One id per distinct bag. A double tap or a flaky network replays the
  // SAME order instead of placing a twin; editing the bag starts a new one.
  const getClientOrderId = () => {
    if (!clientOrderIdRef.current) {
      const random = crypto.randomUUID ? crypto.randomUUID() : `co_${Date.now()}_${Math.random().toString(36).slice(2)}`
      clientOrderIdRef.current = random
    }
    return clientOrderIdRef.current
  }

  const resetClientOrderId = () => {
    clientOrderIdRef.current = null
  }

  // ============ PRODUCT & STOCK STATES ============
  const [productDetails, setProductDetails] = useState({})
  const [stockErrors, setStockErrors] = useState({})
  const [updatingItems, setUpdatingItems] = useState(new Set())

  const isMobile = windowWidth < 768

  // ============ FIXED: Sync coupon with context ============
  useEffect(() => {
    if (contextAppliedCoupon) {
      setAppliedCoupon(contextAppliedCoupon)
      setCouponInput(contextAppliedCoupon.code)
    }
  }, [contextAppliedCoupon])

  // ============ Scanned coupons are applied further down, next to the
  // manual coupon apply, because both share previewCoupon. ============

  // ============ FIXED: Load governorate costs from Firestore ============
  // Full documents, not just the cost: the delivery step needs each
  // governorate's minimum order and active flag as well.
  const [governorateDocs, setGovernorateDocs] = useState({})

  useEffect(() => {
    const loadGovernorateCosts = async () => {
      if (currency !== 'EGP') return

      setLoadingGovernorates(true)
      try {
        const costsRef = collection(db, COLLECTIONS.governorateCosts)
        const snapshot = await getDocs(costsRef)
        const costs = {}
        const docs = {}
        snapshot.docs.forEach(doc => {
          const data = doc.data() ?? {}
          costs[doc.id] = Number(data.cost ?? 0)
          docs[doc.id] = data
        })
        setGovernorateCosts(costs)
        setGovernorateDocs(docs)
      } catch (error) {
        console.error('Error loading governorate costs:', error)
        setGovernorateCosts(defaultGovernorateCosts())
        setGovernorateDocs({})
      } finally {
        setLoadingGovernorates(false)
      }
    }

    loadGovernorateCosts()
  }, [currency])

// ============ FIXED: Calculate shipping based on governorate ============
  const shippingDetails = useMemo(
    () =>
      computeShipping({
        currency,
        currencyConfig,
        totalPrice,
        selectedGovernorate,
        governorateCosts,
        lang,
        t
      }),
    [currency, currencyConfig, totalPrice, selectedGovernorate, governorateCosts, lang, t]
  )

  // ============ RESPONSIVE HANDLERS ============
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ============ GEOLOCATION ============
  // Requested on demand, never on mount: the prompt fires when the shopper picks
  // a governorate, which is the first moment a delivery address matters. Browsers
  // only prompt once, so `locationRequested` stops us re-triggering it on every
  // subsequent change (a denied prompt fails silently from then on).
  const requestLocation = useCallback(() => {
    if (locationRequested.current || formData.latitude) return
    locationRequested.current = true

    setMapLoading(true)

    if (!navigator.geolocation) {
      setMapError(true)
      setMapCenter({ lat: 30.0444, lng: 31.2357 })
      setMapLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setMapCenter({ lat: latitude, lng: longitude })
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude
        }))
        setMapError(false)
        setMapLoading(false)
      },
      (error) => {
        // A denial is not a blocker: the shopper can still type an address or
        // pick a point on the map.
        console.warn('Geolocation unavailable:', error)
        setMapError(true)
        setMapCenter({ lat: 30.0444, lng: 31.2357 })
        setMapLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [formData.latitude])


  // ============ FIXED: Load minimum order amount from Firestore ============
  // The order model keeps minOrder on the governorate; the old global
  // setting stays as a fallback for documents written before that move.
  useEffect(() => {
    const loadMinimumOrderAmount = async () => {
      if (currency !== 'EGP') return

      try {
        const settingsRef = doc(db, COLLECTIONS.settings, 'general')
        const settingsSnap = await getDoc(settingsRef)
        const data = settingsSnap.exists() ? settingsSnap.data() : {}
        const minAmount = Number(data.minimumOrderAmount ?? 0)
        setMinimumOrderAmount(minAmount)
        // The owner's kill switch: ordering can be paused without a deploy,
        // and the server refuses orders while it is off.
        setOrdersOpen(data.ordersOpen !== false)
      } catch (error) {
        console.error('Error loading minimum order amount:', error)
        setMinimumOrderAmount(0)
        setOrdersOpen(true)
      }
    }

    loadMinimumOrderAmount()
  }, [currency])

  // The effective minimum for the chosen governorate.
  const effectiveMinimum = useMemo(() => {
    if (currency !== 'EGP' || !selectedGovernorate) return 0
    const fromGovernorate = Number(governorateDocs[selectedGovernorate]?.minOrder ?? 0)
    return fromGovernorate > 0 ? fromGovernorate : minimumOrderAmount
  }, [currency, selectedGovernorate, governorateDocs, minimumOrderAmount])

  // ============ PRODUCT DETAILS FETCH ============
  // A cart line is a VARIANT (productId + variantId), so availability is read
  // from the variant document; the parent product only supplies display data.
  useEffect(() => {
    const fetchProductDetails = async () => {
      const details = {}
      const errors = {}

      await Promise.all(items.map(async (item) => {
        try {
          const productId = item.productId ?? String(item.id).split(':')[0]
          const variantId = item.variantId ?? (item.id.includes(':') ? item.id.split(':')[1] : null)

          const productRef = doc(db, currencyConfig.collection, productId)
          const productSnap = await getDoc(productRef)

          if (!productSnap.exists()) {
            errors[item.id] = {
              type: 'PRODUCT_NOT_FOUND',
              message: t('productNotAvailable') || 'Product no longer available'
            }
            return
          }

          const variantRef = variantId
            ? doc(db, currencyConfig.collection, productId, 'variants', variantId)
            : null
          const variantSnap = variantRef ? await getDoc(variantRef) : null

          const available = variantSnap?.exists()
            ? Number(variantSnap.data().stock ?? 0)
            : Number(productSnap.data().stock ?? 0)

          details[item.id] = { ...productSnap.data(), stock: available }

          if (available < item.quantity) {
            errors[item.id] = {
              type: 'INSUFFICIENT_STOCK',
              available,
              requested: item.quantity,
              message: t('onlyAvailable', { count: available }) || `Only ${available} available`
            }
          }
        } catch (err) {
          console.error('Error fetching product:', err)
        }
      }))

      setProductDetails(details)
      setStockErrors(errors)
    }

    if (items.length > 0) {
      fetchProductDetails()
    }
  }, [items, t, currencyConfig.collection])

  // ============ DERIVED STATE ============
  const hasDeliveryInfo = useMemo(() => {
    // Email is optional in the order model; name, phone, address and the
    // governorate are what pricing needs.
    const baseInfo = deliveryInfo && deliveryInfo.name && deliveryInfo.phone && deliveryInfo.address
    if (currency === 'EGP') {
      return baseInfo && deliveryInfo.governorate
    }
    return baseInfo
  }, [deliveryInfo, currency])

  const canCheckout = useMemo(() => {
    if (!ordersOpen) return false
    if (currency === 'EGP' && effectiveMinimum > 0 && totalPrice < effectiveMinimum) {
      return false
    }
    return Object.keys(stockErrors).length === 0 && hasDeliveryInfo && !isProcessing
  }, [stockErrors, hasDeliveryInfo, isProcessing, currency, effectiveMinimum, totalPrice, ordersOpen])

  // ============ FORM HANDLERS ============
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleGovernorateChange = (e) => {
    const governorateId = e.target.value
    setSelectedGovernorate(governorateId)
    setFormData(prev => ({ ...prev, governorate: governorateId }))
    if (formErrors.governorate) {
      setFormErrors(prev => {
        const next = { ...prev }
        delete next.governorate
        return next
      })
    }
    // Picking a city is the cue to ask for a precise delivery location.
    if (governorateId) requestLocation()
  }

// ============ FORM VALIDATION ============
  const validateForm = useCallback(() => {
    const { errors, isValid } = validateDeliveryForm(formData, { t })
    setFormErrors(errors)
    return isValid
  }, [formData, t])

  const handleSaveDelivery = (e) => {
    e.preventDefault()
    if (validateForm()) {
      setDeliveryInfo(formData)
      setShowDeliveryForm(false)
    }
  }

  // ============ LOCATION SEARCH ============
  // Through /api/geocode, never directly against Nominatim: the public
  // instance's usage policy (1 req/s, identifying User-Agent, no
  // search-as-you-type, caching) is enforced server-side. The search fires
  // from a submit, not from keystrokes.
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const data = await getJson(`/geocode?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchResults(Array.isArray(data.results) ? data.results : [])
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const handleSelectResult = (result) => {
    const newLocation = { lat: result.lat, lng: result.lon }
    setTempLocation(newLocation)
    setMapEditorCenter(newLocation)
    setSearchQuery(result.display_name)
    setSearchResults([])
    
    if (mapRef.current) {
      mapRef.current.setView([newLocation.lat, newLocation.lng], 16)
      if (markerRef.current) {
        markerRef.current.setLatLng([newLocation.lat, newLocation.lng])
      }
    }
  }

  // ============ FIXED: Leaflet map initialization with proper cleanup ============
  useEffect(() => {
    if (!showMapEditor || !mapContainerRef.current) return
    
    const initTimer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
      
const initialCenter = mapEditorCenter || { lat: 30.0444, lng: 31.2357 }
      
      mapRef.current = L.map(mapContainerRef.current).setView(
        [initialCenter.lat, initialCenter.lng],
        15
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapRef.current)

      markerRef.current = L.marker([initialCenter.lat, initialCenter.lng], {
        draggable: true,
        title: t('dragToSetLocation') || 'Drag to set your location'
      }).addTo(mapRef.current)

      markerRef.current.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng()
        setTempLocation({ lat, lng })
      })

      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        }
        setTempLocation({ lat, lng })
      })

      setMapEditorLoading(false)
    }, 100)

    return () => {
      clearTimeout(initTimer)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [showMapEditor, mapEditorCenter, currency, t])

  useEffect(() => {
    if (mapRef.current && markerRef.current && mapEditorCenter) {
      markerRef.current.setLatLng([mapEditorCenter.lat, mapEditorCenter.lng])
      mapRef.current.setView([mapEditorCenter.lat, mapEditorCenter.lng], 16)
    }
  }, [mapEditorCenter])

  // ============ FULL-SCREEN MAP EDITOR HANDLERS ============
  const handleOpenMapEditor = useCallback(() => {
    setMapEditorLoading(true)
    
    const initialCenter = deliveryInfo?.latitude 
      ? { lat: deliveryInfo.latitude, lng: deliveryInfo.longitude }
: mapCenter || { lat: 30.0444, lng: 31.2357 }
      
    setMapEditorCenter(initialCenter)
    setTempLocation(initialCenter)
    setSearchQuery('')
    setSearchResults([])
    setShowMapEditor(true)
    
    document.body.style.overflow = 'hidden'
  }, [deliveryInfo, mapCenter])

  const handleCloseMapEditor = useCallback(() => {
    setShowMapEditor(false)
    document.body.style.overflow = 'unset'
    
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  const handleSaveMapLocation = useCallback(() => {
    if (tempLocation && tempLocation.lat && tempLocation.lng) {
      setFormData(prev => ({
        ...prev,
        latitude: tempLocation.lat,
        longitude: tempLocation.lng
      }))
      handleCloseMapEditor()
    }
  }, [tempLocation, handleCloseMapEditor])

  // ============ COUPON HANDLING ============
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState(null)

  // Preview through the server: the coupon document (and its usage counters)
  // is never sent to the browser, and the answer is computed from the real
  // document. `subtotal` here is the shopper's bag total; the server
  // recomputes everything from the database at order time.
  const previewCoupon = useCallback(async (rawCode, subtotal) => {
    const code = normalizeCouponCode(rawCode).toUpperCase()
    if (!code) return { ok: false, error: t('invalidCoupon') || 'Invalid coupon' }

    const result = await postJson('/coupon/preview', { code, subtotal })
    if (result.valid !== true) {
      const message = COUPON_REJECTIONS[result.reason] ?? t('invalidCoupon') ?? 'Invalid coupon'
      return { ok: false, error: message }
    }

    return {
      ok: true,
      coupon: {
        code: result.code,
        type: result.type,
        value: result.value,
        amount: result.discount,
        currency: 'EGP',
        label: `${currencyConfig.symbol} ${result.discount} ${t('off') || 'off'}`
      }
    }
  }, [currencyConfig.symbol, t])

  const handleApplyCoupon = useCallback(async () => {
    if (!couponInput.trim()) return

    setCouponLoading(true)
    setCouponError(null)

    try {
      const { ok, error, coupon } = await previewCoupon(couponInput, totalPrice)
      if (!ok) {
        setCouponError(error)
        return
      }

      setAppliedCoupon(coupon)
      contextSetAppliedCoupon(coupon)
      setCouponInput(coupon.code)
    } catch (error) {
      console.error('Coupon preview error:', error)
      setCouponError(t('couponError') || 'Error, please try again')
    } finally {
      setCouponLoading(false)
    }
  }, [couponInput, previewCoupon, totalPrice, contextSetAppliedCoupon, t])

  // ============ FIXED: Handle scanned coupon from QR ============
  // Same server preview as the manual apply: the coupon document is never
  // read by the browser, and the answer is the live one. Lives here, after
  // previewCoupon, because both share it.
  useEffect(() => {
    const handleScannedCoupon = async () => {
      const prefillCode = sessionStorage.getItem('prefillCouponCode')
      const autoApplyData = sessionStorage.getItem('autoApplyCoupon')

      if (!prefillCode && !autoApplyData) return

      if (prefillCode) {
        setCouponInput(prefillCode)
        sessionStorage.removeItem('prefillCouponCode')
      }

      if (autoApplyData) {
        try {
          const couponData = JSON.parse(autoApplyData)

          const { ok, error, coupon } = await previewCoupon(couponData.code, totalPrice)
          if (ok) {
            setAppliedCoupon(coupon)
            contextSetAppliedCoupon(coupon)
            setCouponInput(coupon.code)
          } else {
            setCouponError(error)
          }
        } catch (error) {
          console.error('Error auto-applying scanned coupon:', error)
          setCouponError(t('couponError') || 'Error, please try again')
        } finally {
          sessionStorage.removeItem('autoApplyCoupon')
        }
      }
    }

    handleScannedCoupon()
  }, [contextSetAppliedCoupon, previewCoupon, t, totalPrice])

  const { discountAmount, shippingCost, finalPrice } = computeTotals({
    totalPrice,
    couponAmount: appliedCoupon ? appliedCoupon.amount : 0,
    shippingCost: shippingDetails.cost
  })

  // ============ FIXED: Checkout with proper error handling ============
  // The browser states intent; /api/placeOrder decides money, stock and the
  // coupon against the database in one transaction.
  const handleCheckout = useCallback(async () => {
    if (!canCheckout || Object.keys(stockErrors).length > 0) {
      setCheckoutError(t('resolveStockIssues') || 'Resolve the stock issues first')
      return
    }

    if (!ordersOpen) {
      setCheckoutError(t('orderingPaused') || 'Ordering is paused at the moment. Please try again later.')
      return
    }

    setIsProcessing(true)
    setCheckoutError(null)

    analytics.beginCheckout(items.map((i) => ({ id: i.id, productId: i.productId, variantId: i.variantId, price: i.price, quantity: i.quantity, title: i.title, color: i.color, size: i.size })), finalPrice)

    try {
      const result = await postJson('/placeOrder', {
        cart: items.map((item) => ({
          productId: item.productId ?? String(item.id).split(':')[0],
          variantId: item.variantId ?? (item.id.includes(':') ? item.id.split(':')[1] : null),
          qty: item.quantity
        })),
        customer: {
          name: deliveryInfo.name,
          phone: deliveryInfo.phone,
          email: deliveryInfo.email || null
        },
        address: {
          governorateId: deliveryInfo.governorate,
          governorate: governorateDocs[deliveryInfo.governorate]?.name ?? deliveryInfo.governorate,
          city: deliveryInfo.city || null,
          street: deliveryInfo.address,
          building: deliveryInfo.building || null,
          notes: deliveryInfo.notes || null,
          lat: deliveryInfo.latitude ?? null,
          lng: deliveryInfo.longitude ?? null
        },
        couponCode: appliedCoupon?.code ?? null,
        clientOrderId: getClientOrderId(),
        source: 'web'
      })

      // A retry of the same bag may legitimately return the order that was
      // already placed - the idempotency claim. That is a success, not a
      // duplicate to reject.
      if (appliedCoupon) {
        sessionStorage.setItem(`coupon_${appliedCoupon.code}_used`, 'true')
      }

      const titleOf = (title) =>
        title && typeof title === 'object' ? title.en ?? title.ar : title ?? ''

      const orderData = {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        status: 'pending',
        paymentStatus: paymentStatusFor(paymentMethod),
        totalPrice: result.total,
        subtotal: result.subtotal,
        discount: result.discount,
        shippingCost: result.shippingCost,
        currency: currencyConfig.code,
        paymentMethod: paymentMethodLabelFor(paymentMethod, t),
        items: (result.items ?? []).map((item) => ({
          id: `${item.productId}:${item.variantId}`,
          name: titleOf(item.title),
          price: item.unitPrice,
          quantity: item.qty,
          color: item.color,
          size: item.size
        })),
        customerName: result.customer?.name ?? deliveryInfo.name,
        customerEmail: result.customer?.email ?? null,
        customerPhone: result.customer?.phone ?? deliveryInfo.phone,
        governorate: governorateDocs[deliveryInfo.governorate]?.name?.en ?? deliveryInfo.governorate
      }

      resetClientOrderId()
      clearCart()
      clearDeliveryInfo()

      analytics.purchase({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        totalPrice: result.total,
        items: (result.items ?? []).map((item) => ({ variantId: `${item.productId}:${item.variantId}`, productId: item.productId, unitPrice: item.unitPrice, qty: item.qty, title: item.title, color: item.color, size: item.size }))
      })

      navigate('/order-success', { state: { orderId: result.orderId, orderData } })
    } catch (error) {
      console.error('Checkout error:', error)
      setCheckoutError(CHECKOUT_REJECTIONS[error.code] ?? t('checkoutFailed') ?? 'Checkout failed')

      // The bag must be marked rather than silently retried: the server named
      // the product that can no longer be bought at the requested quantity.
      if (error.code === 'OUT_OF_STOCK' && error.detail) {
        const [productId] = String(error.detail).split(':')
        setStockErrors((prev) => {
          const next = { ...prev }
          for (const item of items) {
            const lineProductId = item.productId ?? String(item.id).split(':')[0]
            if (lineProductId === productId) {
              next[item.id] = {
                type: 'OUT_OF_STOCK',
                available: 0,
                requested: item.quantity,
                message: t('outOfStockNow') || 'لم يعد متوفراً بالكمية المطلوبة'
              }
            }
          }
          return next
        })
      }
      setIsProcessing(false)
    }
  }, [
    canCheckout,
    ordersOpen,
    items,
    deliveryInfo,
    appliedCoupon,
    finalPrice,
    paymentMethod,
    stockErrors,
    t,
    governorateDocs,
    currencyConfig,
    clearCart,
    clearDeliveryInfo,
    navigate
  ])

  const handleQuantityUpdate = useCallback(async (item, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(item.id)
      return
    }

    const product = productDetails[item.id]
    const availableStock = product?.stock || 0

    setUpdatingItems(prev => new Set(prev).add(item.id))
    
    try {
      await updateQuantity(item.id, newQuantity, availableStock)

      if (availableStock > 0 && newQuantity > availableStock) {
        setStockErrors(prev => ({
          ...prev,
          [item.id]: {
            type: 'INSUFFICIENT_STOCK',
            available: availableStock,
            requested: newQuantity,
            message: t('onlyAvailable', { count: availableStock })
          }
        }))
      } else {
        setStockErrors(prev => {
          const next = { ...prev }
          delete next[item.id]
          return next
        })
      }
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [productDetails, updateQuantity, removeFromCart, t])

// ============ COLOR SCHEME ============

  const formatPrice = useCallback((price) => formatPriceFor(price), [])

  // Still inline-styled: the Leaflet editor is a full-screen modal, not a design-system block.
  const { theme } = useTheme()
  const c = getColors(theme)


  // ============ BANNERS (design-system markup) ============
  const MinimumOrderBanner = () => {
    if (currency !== 'EGP' || effectiveMinimum <= 0 || totalPrice >= effectiveMinimum) return null

    const remaining = effectiveMinimum - totalPrice

    return (
      <div className="pa-callout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <b>{t('minimumOrderRequired') || 'Minimum Order Required'}</b>
          <span>{t('minimumOrderAmountIs') || 'Minimum order amount is'} <bdi>{formatPrice(effectiveMinimum)}</bdi></span>
          <span className="pa-subtitle">
            {t('addMoreToProceed') || 'Add'} <bdi>{formatPrice(remaining)}</bdi> {t('moreToCheckout') || 'more to proceed with checkout'}
          </span>
        </div>
      </div>
    )
  }

  const CartErrorBanner = () => {
    if (!cartError && Object.keys(stockErrors).length === 0) return null

    return (
      <div className="pa-callout pa-callout--error">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>{t('stockIssuesDetected')}</b>
          {Object.entries(stockErrors).map(([id, error]) => (
            <span key={id}>• {items.find((i) => i.id === id)?.name}: {error.message}</span>
          ))}
          <div>
            <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => setStockErrors({})}>
              {t('dismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Server-side checkout rejections (out of stock, coupon invalid, rate
  // limited, ordering paused...). Previously an alert() that vanished before
  // it could be read; now a callout that stays on the page.
  const CheckoutErrorBanner = () => {
    if (!checkoutError) return null

    return (
      <div className="pa-callout pa-callout--error">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>{t('orderNotCompleted') || 'لم يتم إتمام الطلب'}</b>
          <span>{checkoutError}</span>
          <div>
            <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => setCheckoutError(null)}>
              {t('dismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // The kill switch: the owner can pause ordering from egp_settings/general
  // without a deploy, and the server enforces it too.
  const OrderingPausedBanner = () => {
    if (ordersOpen) return null
    return (
      <div className="pa-callout">
        <b>{t('orderingPaused') || 'الطلب متوقف مؤقتاً'}</b>{' '}
        <span className="pa-subtitle">{t('orderingPausedHint') || 'نعتذر، الشراء متاح قريباً'}</span>
      </div>
    )
  }
  // ============ MAP EDITOR MODAL COMPONENT ============
  const MapEditorModal = () => {
    if (!showMapEditor) return null

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: c.background,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeInMap 0.3s ease-out'
      }}>
        <div style={{
          padding: '1rem 1.5rem',
          background: c.card,
          borderBottomWidth: '2px',
          borderBottomStyle: 'solid',
          borderBottomColor: c.border,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: `0 4px 12px ${c.overlay}`
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: c.textDark,
              fontSize: '1.5rem',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              🗺️ {t('selectLocation') || 'Select Location'}
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              color: c.textMuted,
              fontSize: '0.85rem',
              fontWeight: '600'
            }}>
              {t('dragMarkerOrClick') || 'Drag the marker or click on map to set your location'}
            </p>
          </div>
          <button
            onClick={handleCloseMapEditor}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: c.border,
              background: c.surface,
              color: c.textDark,
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = c.danger
              e.currentTarget.style.color = 'white'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = c.surface
              e.currentTarget.style.color = c.textDark
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          background: c.card,
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: c.border,
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <div style={{ flex: 1, position: 'relative', width: '100%' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
placeholder={(t('searchAreaStreetEgypt') || "Search for area, street, or landmark in Egypt...")}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: c.border,
                borderRadius: '10px',
                fontSize: '1rem',
                background: c.surface,
                color: c.textDark,
                fontFamily: 'inherit'
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: c.surface,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: c.border,
                borderRadius: '10px',
                marginTop: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: `0 8px 24px ${c.overlay}`
              }}>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectResult(result)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderBottomColor: c.border,
                      cursor: 'pointer',
                      color: c.textDark,
                      fontSize: '0.9rem',
                      transition: 'background 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = c.overlay
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span>📍</span>
                    <span style={{ flex: 1 }}>{result.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            style={{
              padding: '12px 24px',
              background: isSearching || !searchQuery.trim() ? c.textMuted : c.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '800',
              cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
              minWidth: '100px'
            }}
          >
            {isSearching ? '...' : `🔍 ${t('search') || 'Search'}`}
          </button>
        </div>

        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: c.overlay
        }}>
          {mapEditorLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: c.card,
              zIndex: 10
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '1rem',
                  animation: 'spin 2s linear infinite'
                }}>
                  📡
                </div>
                <p style={{ color: c.textMuted, fontWeight: '700' }}>
                  {t('loadingMap') || 'Loading map...'}
                </p>
              </div>
            </div>
          )}
          
          <div 
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '100%',
              zIndex: 1
            }}
          />

          <div style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: c.card,
            padding: '8px 16px',
            borderRadius: '20px',
            boxShadow: `0 4px 12px ${c.overlay}`,
            zIndex: 500,
            fontSize: '0.85rem',
            fontWeight: '700',
            color: c.textDark,
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: c.border,
            pointerEvents: 'none'
          }}>
            {t('clickMapOrDrag') || '🖱️ Click map or drag marker to set location'}
          </div>

          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: c.card,
            borderTopWidth: '2px',
            borderTopStyle: 'solid',
            borderTopColor: c.border,
            padding: '1.5rem',
            boxShadow: `0 -4px 12px ${c.overlay}`,
            animation: 'slideUpMap 0.4s ease-out',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 500
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: c.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem'
                }}>
                  {t('latitude') || 'Latitude'}
                </label>
                <div style={{
                  padding: '10px 14px',
                  background: c.overlay,
                  borderRadius: '10px',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: tempLocation ? c.success : c.border,
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: c.textDark,
                  fontFamily: 'monospace'
                }}>
                  {tempLocation?.lat?.toFixed(6) || '—'}
                </div>
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: c.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem'
                }}>
                  {t('longitude') || 'Longitude'}
                </label>
                <div style={{
                  padding: '10px 14px',
                  background: c.overlay,
                  borderRadius: '10px',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: tempLocation ? c.success : c.border,
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: c.textDark,
                  fontFamily: 'monospace'
                }}>
                  {tempLocation?.lng?.toFixed(6) || '—'}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <button
                onClick={handleCloseMapEditor}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: c.card,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: c.border,
                  borderRadius: '12px',
                  color: c.textDark,
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = c.border
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = c.card
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                ✕ {t('cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleSaveMapLocation}
                disabled={!tempLocation}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: !tempLocation ? c.textMuted : `linear-gradient(135deg, ${c.success} 0%, ${c.success}dd 100%)`,
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: !tempLocation ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: !tempLocation ? 'none' : `0 4px 12px ${c.success}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (tempLocation) {
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)'
                    e.currentTarget.style.boxShadow = `0 8px 24px ${c.success}60`
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = !tempLocation ? 'none' : `0 4px 12px ${c.success}40`
                }}
              >
                <span>✓</span> {t('saveLocation') || 'Save Location'}
              </button>
            </div>
          </div>
        </div>

        {/* Index-closable modal: the leaflet map editor owns the whole voxport. */}
        <style>{`
          @keyframes fadeInMap { from { opacity: 0; } to { opacity: 1; } }
          .leaflet-container { font-family: inherit; }
        `}</style>
      </div>
    )
  }

  const minimumBanner = MinimumOrderBanner()
  const cartErrorBanner = CartErrorBanner()
  const checkoutErrorBanner = CheckoutErrorBanner()
  const orderingPausedBanner = OrderingPausedBanner()

  // ============ EMPTY CART ============
  if (totalItems === 0) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
          <h1>{t('cart')}</h1>
          <div className="pa-callout" style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b>{t('emptyCart')}</b>
              <span className="pa-subtitle">{t('browseOurCollectionAndAddSomeItems')}</span>
              <div>
                <button type="button" className="pa-btn" onClick={() => navigate('/home')}>
                  {t('continueShopping')}
                </button>
              </div>
            </div>
          </div>
        </div>
        <MapEditorModal />
      </>
    )
  }

  // ============ MAIN RENDER ============
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>{t('cart')} <span className="pa-count">{totalItems}</span></h1>
          <div className="pa-subtitle">{currencyConfig.code}</div>
        </div>
        <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => navigate('/home')}>
          &larr; {t('continueShopping')}
        </button>
      </div>

      {orderingPausedBanner}
      {minimumBanner}
      {cartErrorBanner}
      {checkoutErrorBanner}

      <div className="pa-cols">
        {/* ---- lines ---- */}
        <div className="pa-listcol">
          {items.map((item) => {
            const product = productDetails[item.id]
            const stockError = stockErrors[item.id]
            const isOutOfStock = !product || product.stock <= 0

            return (
              <BagLine
                key={item.id}
                lang={lang}
                line={{
                  // The design system's bag line talks about a variant; the
                  // store's cart row is product + quantity (+ flavour), so the
                  // fields are mapped across here rather than reshaping the cart.
                  title: item.name,
                  unitPrice: item.price,
                  compareAtPrice: item.compareAtPrice ?? 0,
                  qty: item.quantity,
                  stock: product?.stock ?? 0,
                  image: product?.imageUrl ?? null,
                  colorName: isOutOfStock ? t('outOfStock') : null,
                  size: item.selectedFlavor || item.size || null
                }}
                onQty={(n) => {
                  // Guards the in-flight update: the cart re-reads stock from
                  // Firestore, so a second tap during that window would race it.
                  if (updatingItems.has(item.id)) return
                  handleQuantityUpdate(item, n)
                }}
                onRemove={() => removeFromCart(item.id)}
                issue={stockError?.message}
              >
                {stockError && (
                  <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => setStockErrors({})}>
                    {t('dismiss')}
                  </button>
                )}
              </BagLine>
            )
          })}
        </div>

        {/* ---- delivery, payment, summary ---- */}
        <aside className="pa-formcol" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <FreeShippingBar
            subtotal={totalPrice}
            threshold={currencyConfig.freeShippingThreshold}
            lang={lang}
            t={{
              remaining: (left) =>
                t('addMoreForFreeShipping', { amount: formatPrice(left) }) ||
                `Add ${formatPrice(left)} more for free shipping`,
              reached: shippingDetails.isFree ? `${t('free')}` : undefined
            }}
          />

          {/* ---- coupon ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pa-pdp__label">{t('coupon') || 'Coupon'}</div>
            {appliedCoupon ? (
              <div className="pa-callout">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <b style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{appliedCoupon.code}</b>
                  <span className="pa-ok">
                    {t('applied') || 'Applied'} · -{formatPrice(appliedCoupon.amount)}
                  </span>
                  <button
                    type="button"
                    className="pa-btn pa-btn--outline pa-btn--sm"
                    onClick={() => {
                      setAppliedCoupon(null)
                      contextSetAppliedCoupon(null)
                      setCouponInput('')
                    }}
                  >
                    {t('removeCoupon') || 'Remove coupon'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div className="pa-field" style={{ flex: 1 }}>
                    <label className="pa-label" htmlFor="co-coupon">{t('enterCouponCode') || 'Coupon code'}</label>
                    <input
                      id="co-coupon"
                      className="pa-input"
                      style={{ direction: 'ltr', unicodeBidi: 'embed' }}
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon() } }}
                      placeholder="EGP-XXXX"
                    />
                  </div>
                  <button
                    type="button"
                    className="pa-btn pa-btn--admin"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    aria-disabled={couponLoading || !couponInput.trim()}
                  >
                    {couponLoading ? (t('loading') || 'Applying…') : (t('apply') || 'Apply')}
                  </button>
                </div>
                {couponError && <div className="pa-error" role="alert">{couponError}</div>}
              </>
            )}
          </div>

          {(showDeliveryForm || !hasDeliveryInfo) ? (
            <form onSubmit={handleSaveDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ fontSize: 20 }}>{t('deliveryInformation')}</h2>

              <Field
                id="co-name"
                label={t('fullName')}
                error={formErrors.name}
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={t('enterFullName') || 'Enter your full name'}
                required
              />
              <Field
                id="co-phone"
                label={t('phoneNumber')}
                error={formErrors.phone}
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+20 123 456 7890"
                required
              />
              <Field
                id="co-email"
                label={t('email')}
                error={formErrors.email}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
                required
              />

              {currency === 'EGP' && (
                <div className="pa-field">
                  <label className="pa-label" htmlFor="co-gov">
                    {t('governorate') || 'Governorate'}
                  </label>
                  <select
                    id="co-gov"
                    className="pa-select"
                    name="governorate"
                    value={formData.governorate}
                    onChange={handleGovernorateChange}
                    disabled={loadingGovernorates}
                    aria-invalid={formErrors.governorate ? 'true' : undefined}
                    aria-describedby={formErrors.governorate ? 'co-gov-msg' : undefined}
                  >
                    <option value="">
                      {loadingGovernorates ? t('loading') || 'Loading...' : t('selectGovernorate')}
                    </option>
                    {EGYPT_GOVERNORATES.map((gov) => (
                      <option key={gov.id} value={gov.id}>
                        {lang === 'ar' ? `${gov.nameAr} - ${gov.name}` : `${gov.name} - ${gov.nameAr}`} ({currencyConfig.symbol} {governorateCosts[gov.id] || '--'})
                      </option>
                    ))}
                  </select>
                  {formErrors.governorate ? (
                    <div id="co-gov-msg" className="pa-error">{formErrors.governorate}</div>
                  ) : (
                    <div className="pa-subtitle">{t('shippingCostVaries') || 'Shipping cost varies by governorate'}</div>
                  )}
                </div>
              )}

              <div className="pa-field">
                <label className="pa-label" htmlFor="co-address">{t('detailedAddress')}</label>
                <textarea
                  id="co-address"
                  className="pa-input"
                  name="address"
                  rows="3"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder={t('enterDetailedAddress') || 'Enter detailed address'}
                  aria-invalid={formErrors.address ? 'true' : undefined}
                  aria-describedby={formErrors.address ? 'co-address-msg' : undefined}
                />
                {formErrors.address && <div id="co-address-msg" className="pa-error">{formErrors.address}</div>}
              </div>

              <Field
                id="co-city"
                label={t('city')}
                error={formErrors.city}
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder={t('enterCityAreaExample') || 'Enter city or area (e.g., Nasr City)'}
              />

              <div className="pa-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <label className="pa-label">{t('location')}</label>
                  <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={handleOpenMapEditor}>
                    {t('pickOnMap') || 'Pick on map'}
                  </button>
                </div>
                <div className="pa-subtitle" role="status">
                  {mapLoading && (t('loadingMap') || 'Getting your location…')}
                  {!mapLoading && mapError && (
                    <span className="pa-error">{t('locationDenied') || 'Location unavailable — you can still set it on the map.'}</span>
                  )}
                  {!mapLoading && !mapError && formData.latitude && formData.longitude
                    ? `${formData.latitude.toFixed(5)}, ${formData.longitude.toFixed(5)}`
                    : !mapLoading && !mapError && (t('clickMapOrDrag') || 'Click map or drag marker to set location')}
                </div>
              </div>

              <button type="submit" className="pa-btn">{t('save') || 'Save'}</button>
            </form>
          ) : (
            <div className="pa-callout">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <b>{deliveryInfo?.name}</b>
                <span className="pa-subtitle">
                  {[deliveryInfo?.phone, deliveryInfo?.email, deliveryInfo?.address].filter(Boolean).join(' · ')}
                </span>
                {currency === 'EGP' && deliveryInfo?.governorate && (
                  <span className="pa-subtitle">
                    {lang === 'ar'
                      ? (EGYPT_GOVERNORATES.find((g) => g.id === deliveryInfo.governorate)?.nameAr || deliveryInfo.governorate)
                      : (EGYPT_GOVERNORATES.find((g) => g.id === deliveryInfo.governorate)?.name || deliveryInfo.governorate)}
                  </span>
                )}
                <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => setShowDeliveryForm(true)}>
                  {t('edit') || 'Edit'}
                </button>
              </div>
            </div>
          )}

          {/* ---- payment method ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pa-pdp__label">{t('paymentMethod') || 'Payment method'}</div>
            <label className="pa-chip" style={{ padding: '12px 14px' }}>
              <input
                type="radio"
                name="payment"
                value="cod"
                checked={paymentMethod === 'cod'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>{t('cashOnDelivery') || 'Cash on Delivery'}</span>
            </label>
            <label className="pa-chip" style={{ padding: '12px 14px', opacity: 0.5, cursor: 'not-allowed' }}>
              <input type="radio" name="payment" value="card" checked={false} disabled onChange={() => {}} />
              <span>{t('creditDebitCard') || 'Credit/Debit Card'}</span>
            </label>
          </div>

          {/* ---- summary ---- */}
          <Summary
            rows={[
              { label: t('subtotal'), value: formatPrice(totalPrice) },
              ...(discountAmount > 0
                ? [{ label: t('discount'), value: `-${formatPrice(discountAmount)}`, tone: 'discount' }]
                : []),
              {
                label: t('shipping'),
                value: shippingDetails.isFree ? `${t('free')} 🎉` : formatPrice(shippingCost)
              },
              { label: t('total'), value: formatPrice(finalPrice), tone: 'total' }
            ]}
          />

          <button
            type="button"
            className="pa-btn pa-btn--lg pa-btn--block"
            onClick={handleCheckout}
            disabled={!canCheckout}
            aria-disabled={!canCheckout}
          >
            {isProcessing
              ? t('processing')
              : !hasDeliveryInfo
                ? t('completeDeliveryInfo')
                : Object.keys(stockErrors).length > 0
                  ? t('resolveStockIssues')
                  : currency === 'EGP' && minimumOrderAmount > 0 && totalPrice < minimumOrderAmount
                    ? `${t('minOrder') || 'Min Order'}: ${formatPrice(minimumOrderAmount)}`
                    : `${t('checkout')} (${currencyConfig.code})`}
          </button>

          {!canCheckout && (
            <div className="pa-callout pa-callout--error">
              {!hasDeliveryInfo
                ? t('pleaseCompleteDeliveryInfo')
                : Object.keys(stockErrors).length > 0
                  ? t('adjustQuantitiesBeforeCheckout')
                  : currency === 'EGP' && minimumOrderAmount > 0 && totalPrice < minimumOrderAmount
                    ? `${t('minimumOrderRequired')}: ${formatPrice(minimumOrderAmount)}. ${t('add')} ${formatPrice(minimumOrderAmount - totalPrice)} ${t('more')}.`
                    : t('cannotProceed')}
            </div>
          )}
        </aside>
      </div>

      <MapEditorModal />
    </>
  )
}



