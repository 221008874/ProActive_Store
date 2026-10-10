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
import {
  assertCouponUsable,
  buildAppliedCoupon,
  findCaseInsensitiveMatch,
  normalizeCouponCode,
  COUPON_COLLECTION
} from '../utils/coupon'
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  query,
  where,
  getDocs, 
  updateDoc, 
  increment,
  limit,
  writeBatch,
  Timestamp,
  runTransaction
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

export default function CartPage() {
  const {
    items,
    totalItems,
    totalPrice,
    removeFromCart,
    updateQuantity,
    clearCart,
    error: cartError,
    clearError,
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
  const mapContainerRef = useRef(null)
  const markerRef = useRef(null)

  // ============ MINIMUM ORDER AMOUNT STATE ============
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(0)
  const [loadingMinOrder, setLoadingMinOrder] = useState(false)

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

  // ============ FIXED: Handle scanned coupon from QR ============
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
          const now = new Date()
          
          const storedExpiresAt = couponData.expiresAt ? new Date(couponData.expiresAt) : null
          if (storedExpiresAt && storedExpiresAt < now) {
            console.log('Scanned coupon expired:', couponData.code)
            sessionStorage.removeItem('autoApplyCoupon')
            return
          }
          
          const couponsRef = collection(db, COLLECTIONS.coupons)
          const q = query(couponsRef, where('code', '==', couponData.code), where('isActive', '==', true))
          const snapshot = await getDocs(q)
          
          if (!snapshot.empty) {
            const couponDoc = snapshot.docs[0]
            const couponInfo = couponDoc.data()
            
            const expiresAt = couponInfo.expiresAt?.toDate?.() || new Date(couponInfo.expiresAt)
            
            if (expiresAt > now && couponInfo.usedCount < couponInfo.maxUses) {
              const couponToApply = {
                id: couponDoc.id,
                code: couponInfo.code,
                amount: couponInfo.amount,
                currency: couponInfo.currency || 'EGP',
                label: `${currencyConfig.symbol} ${couponInfo.amount} ${t('off') || 'off'}`
              }
              
              setAppliedCoupon(couponToApply)
              contextSetAppliedCoupon(couponToApply)
              
              sessionStorage.setItem(`coupon_${couponData.code}_used`, 'true')
              
              console.log('Scanned coupon auto-applied:', couponData.code)
            }
          }
          
          sessionStorage.removeItem('autoApplyCoupon')
        } catch (error) {
          console.error('Error auto-applying scanned coupon:', error)
        }
      }
    }

    handleScannedCoupon()
  }, [currencyConfig.symbol, contextSetAppliedCoupon, t])

  // ============ FIXED: Load governorate costs from Firestore ============
  useEffect(() => {
    const loadGovernorateCosts = async () => {
      if (currency !== 'EGP') return
      
      setLoadingGovernorates(true)
      try {
        const costsRef = collection(db, COLLECTIONS.governorateCosts)
        const snapshot = await getDocs(costsRef)
        const costs = {}
        snapshot.docs.forEach(doc => {
          costs[doc.id] = doc.data().cost
        })
        setGovernorateCosts(costs)
      } catch (error) {
        console.error('Error loading governorate costs:', error)
setGovernorateCosts(defaultGovernorateCosts())
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
  useEffect(() => {
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
        console.warn('Geolocation error:', error)
        setMapError(true)
setMapCenter({ lat: 30.0444, lng: 31.2357 })
        setMapLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [currency])

  // ============ FIXED: Load minimum order amount from Firestore ============
  useEffect(() => {
    const loadMinimumOrderAmount = async () => {
      if (currency !== 'EGP') return
      
      setLoadingMinOrder(true)
      try {
        const settingsRef = doc(db, COLLECTIONS.settings, 'general')
        const settingsSnap = await getDoc(settingsRef)
        const minAmount = settingsSnap.exists() ? settingsSnap.data().minimumOrderAmount || 0 : 0
        setMinimumOrderAmount(minAmount)
      } catch (error) {
        console.error('Error loading minimum order amount:', error)
        setMinimumOrderAmount(0)
      } finally {
        setLoadingMinOrder(false)
      }
    }

    loadMinimumOrderAmount()
  }, [currency])

  // ============ PRODUCT DETAILS FETCH ============
  useEffect(() => {
    const fetchProductDetails = async () => {
      const details = {}
      const errors = {}

      await Promise.all(items.map(async (item) => {
        try {
          const docRef = doc(db, currencyConfig.collection, item.id)
          const docSnap = await getDoc(docRef)

          if (docSnap.exists()) {
            const data = docSnap.data()
            details[item.id] = data

            if (data.stock < item.quantity) {
              errors[item.id] = {
                type: 'INSUFFICIENT_STOCK',
                available: data.stock,
                requested: item.quantity,
                message: t('onlyAvailable', { count: data.stock })
              }
            }
          } else {
            errors[item.id] = {
              type: 'PRODUCT_NOT_FOUND',
              message: t('productNotAvailable')
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
    const baseInfo = deliveryInfo && deliveryInfo.name && deliveryInfo.phone && deliveryInfo.email && deliveryInfo.address
    if (currency === 'EGP') {
      return baseInfo && deliveryInfo.governorate
    }
    return baseInfo
  }, [deliveryInfo, currency])

  const canCheckout = useMemo(() => {
    if (currency === 'EGP' && minimumOrderAmount > 0 && totalPrice < minimumOrderAmount) {
      return false
    }
    return Object.keys(stockErrors).length === 0 && hasDeliveryInfo && !isProcessing
  }, [stockErrors, hasDeliveryInfo, isProcessing, currency, minimumOrderAmount, totalPrice])

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
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
const response = await fetch(
           `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=eg&limit=5`
      )
      const data = await response.json()
      setSearchResults(data.map(item => ({
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      })))
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
        attribution: 'آ© OpenStreetMap contributors',
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

  const handleApplyCoupon = useCallback(async () => {
const rawInput = normalizeCouponCode(couponInput)
      if (!rawInput) return
    
    console.log('ًں”چ Attempting to apply coupon:', rawInput)
    
    setCouponLoading(true)
    setCouponError(null)
    
    try {
      const couponsRef = collection(db, COLLECTIONS.coupons)
      
      let q = query(
        couponsRef, 
        where('code', '==', rawInput),
        where('isActive', '==', true)
      )
      let snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        console.log('â‌Œ Exact match failed, trying uppercase...')
        q = query(
          couponsRef,
          where('code', '==', rawInput.toUpperCase()),
          where('isActive', '==', true)
        )
        snapshot = await getDocs(q)
      }
      
      if (snapshot.empty) {
        console.log('â‌Œ Uppercase failed, trying lowercase...')
        q = query(
          couponsRef,
          where('code', '==', rawInput.toLowerCase()),
          where('isActive', '==', true)
        )
        snapshot = await getDocs(q)
      }
      
      if (snapshot.empty) {
        console.log('â‌Œ Lowercase failed, trying case-insensitive...')
        q = query(couponsRef, where('isActive', '==', true))
const allCoupons = await getDocs(q)
          const matchingDoc = findCaseInsensitiveMatch(allCoupons.docs, rawInput)

          if (matchingDoc) {
            snapshot = { docs: [matchingDoc], empty: false }
          }
      }
      
      console.log('ًں“ٹ Final snapshot:', {
        empty: snapshot.empty,
        size: snapshot.size,
        docs: snapshot.docs?.map(d => ({ id: d.id, ...d.data() }))
      })
      
      if (snapshot.empty) {
        setCouponError(t('invalidCoupon'))
        setCouponLoading(false)
        return
      }
      
      const couponDoc = snapshot.docs[0]
      const couponData = couponDoc.data()
      
      console.log('âœ… Found coupon:', couponData)
      
const now = new Date()

  const rejection = assertCouponUsable(couponData, { now })
        if (rejection) {
          setCouponError(t(rejection.key) || rejection.fallback)
          setCouponLoading(false)
          return
        }

        const couponToApply = buildAppliedCoupon({
          id: couponDoc.id,
          couponData,
          symbol: currencyConfig.symbol,
          t
        })

        setAppliedCoupon(couponToApply)
        contextSetAppliedCoupon(couponToApply)
        setCouponInput(couponData.code)
      
      console.log('ًںژ‰ Coupon applied successfully:', couponToApply)
      
    } catch (error) {
      console.error('ًں’¥ Coupon validation error:', error)
      setCouponError(t('couponError') || 'Error, please try again')
    } finally {
      setCouponLoading(false)
    }
  }, [couponInput, currencyConfig.symbol, t, appliedCoupon, contextSetAppliedCoupon])

  const { discountAmount, shippingCost, finalPrice } = computeTotals({
    totalPrice,
    couponAmount: appliedCoupon ? appliedCoupon.amount : 0,
    shippingCost: shippingDetails.cost
  })

  // ============ FIXED: Checkout with proper error handling ============
  const handleCheckout = useCallback(async () => {
    if (!canCheckout || Object.keys(stockErrors).length > 0) {
      alert(t('resolveStockIssues'))
      return
    }

    if (appliedCoupon && appliedCoupon.currency && appliedCoupon.currency !== 'EGP') {
      alert(t('couponCurrencyMismatch') || 'Coupon currency mismatch')
      return
    }

    setIsProcessing(true)
    const orderId = `order_${Date.now()}`
    
    const discountAmount = appliedCoupon ? appliedCoupon.amount : 0
    const calculatedSubtotal = Math.max(0, totalPrice - discountAmount)
    const calculatedShipping = shippingDetails.cost
    const calculatedFinalPrice = calculatedSubtotal + calculatedShipping
    
    console.log('Checkout calculation:', {
      totalPrice,
      discountAmount,
      calculatedSubtotal,
      shipping: calculatedShipping,
      finalPrice: calculatedFinalPrice,
      appliedCoupon
    })
    
    try {
      const orderData = await runTransaction(db, async (transaction) => {
        const stockChecks = await Promise.all(items.map(async (item) => {
          const productRef = doc(db, currencyConfig.collection, item.id)
          const productSnap = await transaction.get(productRef)
          
          if (!productSnap.exists()) {
            throw new Error(t('productNotFound') || `Product ${item.name} no longer exists`)
          }
          
          const currentStock = productSnap.data().stock
          if (currentStock < item.quantity) {
            throw new Error(t('insufficientStock') || `Insufficient stock for ${item.name}`)
          }
          
          return { ref: productRef, newStock: currentStock - item.quantity, item }
        }))
        
        let couponData = null
        let couponRef = null
        
        if (appliedCoupon) {
          couponRef = doc(db, COLLECTIONS.coupons, appliedCoupon.id)
          const couponSnap = await transaction.get(couponRef)
          
          if (!couponSnap.exists()) {
            throw new Error(t('couponNotFound') || 'Coupon no longer exists')
          }
          
          couponData = couponSnap.data()
          if (couponData.usedCount >= couponData.maxUses) {
            throw new Error(t('couponExhausted') || 'Coupon fully used')
          }
        }
        
        const orderData = {
          orderId,
          userId: `guest_${Date.now()}`,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1
          })),
          totalPrice: calculatedFinalPrice,
          subtotal: totalPrice,
          discount: discountAmount,
          shippingCost: calculatedShipping,
          totalItems: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
          currency: currencyConfig.code,
paymentMethod: paymentMethodLabelFor(paymentMethod, t),
            paymentStatus: paymentStatusFor(paymentMethod),
          status: 'pending',
          customerName: deliveryInfo.name,
          customerPhone: deliveryInfo.phone,
          customerEmail: deliveryInfo.email,
          customerAddress: deliveryInfo.address,
          governorate: currency === 'EGP' ? deliveryInfo.governorate : null,
          customerLocation: {
            latitude: deliveryInfo.latitude,
            longitude: deliveryInfo.longitude
          },
          coupon: appliedCoupon ? {
            code: appliedCoupon.code,
            amount: appliedCoupon.amount,
            id: appliedCoupon.id
          } : null,
          shipping: {
            ...shippingDetails,
            governorate: currency === 'EGP' ? deliveryInfo.governorate : undefined
          },
          source: 'web',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }

        const currencyOrderRef = doc(collection(db, currencyConfig.orderCollection))
        transaction.set(currencyOrderRef, orderData)

        const mobileOrderRef = doc(db, COLLECTIONS.mobileOrders, orderId)
        transaction.set(mobileOrderRef, {
          ...orderData,
          webOrderRef: currencyOrderRef.id,
          platform: 'web',
          isRead: false,
          syncedToMobile: true
        })

        stockChecks.forEach(({ ref, newStock }) => {
          transaction.update(ref, { stock: newStock })
        })

        if (appliedCoupon && couponRef) {
          transaction.update(couponRef, {
            usedCount: increment(1),
            lastUsedAt: Timestamp.now(),
            lastUsedBy: deliveryInfo.email || 'guest'
          })
        }
        
        return orderData
      })

      if (appliedCoupon) {
        sessionStorage.setItem(`coupon_${appliedCoupon.code}_used`, 'true')
      }
      
      clearCart()
      clearDeliveryInfo()
      
      navigate('/order-success', { 
        state: { 
          orderId,
          orderData: {
            totalPrice: calculatedFinalPrice,
            subtotal: totalPrice,
            discount: discountAmount,
            shippingCost: calculatedShipping,
            currency: currencyConfig.code,
            paymentMethod: paymentMethodLabelFor(paymentMethod, t),
            status: 'pending',
            paymentStatus: paymentStatusFor(paymentMethod),
            items: items.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity || 1
            })),
            customerName: deliveryInfo.name,
            customerEmail: deliveryInfo.email,
            customerPhone: deliveryInfo.phone,
            governorate: currency === 'EGP' ? deliveryInfo.governorate : null
          },
          securityToken: orderId.split('_')[1]
        } 
      })
      
    } catch (error) {
      console.error('Checkout error:', error)
      alert((t('checkoutFailed') || 'Checkout failed') + ': ' + (error.message || t('tryAgain')))
      setIsProcessing(false)
    }
  }, [
    canCheckout, 
    items, 
    totalPrice, 
    deliveryInfo, 
    appliedCoupon, 
    shippingDetails, 
    paymentMethod, 
    stockErrors,
    t,
    clearCart, 
    clearDeliveryInfo, 
    navigate,
    currencyConfig,
    currency
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
    if (currency !== 'EGP' || minimumOrderAmount <= 0 || totalPrice >= minimumOrderAmount) return null

    const remaining = minimumOrderAmount - totalPrice

    return (
      <div className="pa-callout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <b>{t('minimumOrderRequired') || 'Minimum Order Required'}</b>
          <span>{t('minimumOrderAmountIs') || 'Minimum order amount is'} <bdi>{formatPrice(minimumOrderAmount)}</bdi></span>
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
              ًں—؛ï¸ڈ {t('selectLocation') || 'Select Location'}
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
            âœ•
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
                    <span>ًں“چ</span>
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
            {isSearching ? '...' : `ًں”چ ${t('search') || 'Search'}`}
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
                  ًں“،
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
            {t('clickMapOrDrag') || 'ًں–±ï¸ڈ Click map or drag marker to set location'}
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
                  {tempLocation?.lat?.toFixed(6) || 'â€”'}
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
                  {tempLocation?.lng?.toFixed(6) || 'â€”'}
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
                âœ• {t('cancel') || 'Cancel'}
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
                <span>âœ“</span> {t('saveLocation') || 'Save Location'}
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

      {minimumBanner}
      {cartErrorBanner}

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
                  {[deliveryInfo?.phone, deliveryInfo?.email, deliveryInfo?.address].filter(Boolean).join(' آ· ')}
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
                value: shippingDetails.isFree ? `${t('free')} ًںژ‰` : formatPrice(shippingCost)
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



