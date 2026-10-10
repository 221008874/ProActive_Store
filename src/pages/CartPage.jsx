// src/pages/CartPage.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useLocation } from '../context/LocationContext'
import { db } from '../services/firebase'
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

const EGYPT_GOVERNORATES = [
  { id: 'cairo', name: 'Cairo', nameAr: 'القاهرة' },
  { id: 'giza', name: 'Giza', nameAr: 'الجيزة' },
  { id: 'alexandria', name: 'Alexandria', nameAr: 'الإسكندرية' },
  { id: 'qalyubia', name: 'Qalyubia', nameAr: 'القليوبية' },
  { id: 'monufia', name: 'Monufia', nameAr: 'المنوفية' },
  { id: 'gharbia', name: 'Gharbia', nameAr: 'الغربية' },
  { id: 'dakahlia', name: 'Dakahlia', nameAr: 'الدقهلية' },
  { id: 'sharkia', name: 'Sharqia', nameAr: 'الشرقية' },
  { id: 'beheira', name: 'Beheira', nameAr: 'البحيرة' },
  { id: 'kafr_sheikh', name: 'Kafr El Sheikh', nameAr: 'كفر الشيخ' },
  { id: 'damietta', name: 'Damietta', nameAr: 'دمياط' },
  { id: 'port_said', name: 'Port Said', nameAr: 'بورسعيد' },
  { id: 'ismailia', name: 'Ismailia', nameAr: 'الإسماعيلية' },
  { id: 'suez', name: 'Suez', nameAr: 'السويس' },
  { id: 'matrouh', name: 'Matrouh', nameAr: 'مطروح' },
  { id: 'north_sinai', name: 'North Sinai', nameAr: 'شمال سيناء' },
  { id: 'south_sinai', name: 'South Sinai', nameAr: 'جنوب سيناء' },
  { id: 'faiyum', name: 'Faiyum', nameAr: 'الفيوم' },
  { id: 'beni_suef', name: 'Beni Suef', nameAr: 'بني سويف' },
  { id: 'minya', name: 'Minya', nameAr: 'المنيا' },
  { id: 'asyut', name: 'Asyut', nameAr: 'أسيوط' },
  { id: 'sohag', name: 'Sohag', nameAr: 'سوهاج' },
  { id: 'qena', name: 'Qena', nameAr: 'قنا' },
  { id: 'luxor', name: 'Luxor', nameAr: 'الأقصر' },
  { id: 'aswan', name: 'Aswan', nameAr: 'أسوان' },
  { id: 'red_sea', name: 'Red Sea', nameAr: 'البحر الأحمر' },
  { id: 'new_valley', name: 'New Valley', nameAr: 'الوادي الجديد' }
]

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
  const { theme } = useTheme()
  const { currency } = useLocation()
  const navigate = useNavigate()

  // ============ CURRENCY CONFIGURATION ============
  const currencyConfig = useMemo(() => {
    if (currency === 'USD') {
      return {
        symbol: '$',
        code: 'USD',
        collection: 'products_dollar',
        orderCollection: 'orders_dollar',
        shippingZones: {
          usa: { name: t('usa') || 'USA', baseCost: 15 },
          canada: { name: t('canada') || 'Canada', baseCost: 25 },
          europe: { name: t('europe') || 'Europe', baseCost: 35 },
          other: { name: t('restOfWorld') || 'Rest of World', baseCost: 50 }
        },
        freeShippingThreshold: 150
      }
    }
    return {
      symbol: 'EGP',
      code: 'EGP',
      collection: 'products_egp',
      orderCollection: 'orders_egp',
      freeShippingThreshold: 800
    }
  }, [currency, t])

  // ============ MAIN STATES ============
  const [isProcessing, setIsProcessing] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(contextAppliedCoupon)
  const [couponInput, setCouponInput] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  const [hoveredItem, setHoveredItem] = useState(null)
  const [scrollY, setScrollY] = useState(0)

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
  const isSmallMobile = windowWidth < 480

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
          
          const couponsRef = collection(db, 'egp_coupons')
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
        const costsRef = collection(db, 'egp_governorate_costs')
        const snapshot = await getDocs(costsRef)
        const costs = {}
        snapshot.docs.forEach(doc => {
          costs[doc.id] = doc.data().cost
        })
        setGovernorateCosts(costs)
      } catch (error) {
        console.error('Error loading governorate costs:', error)
        const fallbackCosts = {}
        EGYPT_GOVERNORATES.forEach(gov => {
          fallbackCosts[gov.id] = 50
        })
        setGovernorateCosts(fallbackCosts)
      } finally {
        setLoadingGovernorates(false)
      }
    }

    loadGovernorateCosts()
  }, [currency])

  // ============ FIXED: Calculate shipping based on governorate ============
  const calculateShipping = useCallback(() => {
    if (currency === 'USD') {
      const zone = currencyConfig.shippingZones.other
      const cost = totalPrice >= currencyConfig.freeShippingThreshold ? 0 : zone.baseCost
      return {
        cost,
        zone: zone.name,
        isFree: cost === 0
      }
    }

    if (!selectedGovernorate) {
      return { cost: 0, zone: t('selectGovernorate') || 'Select Governorate', isFree: false }
    }

    const governorateCost = governorateCosts[selectedGovernorate] || 50
    const isFree = totalPrice >= currencyConfig.freeShippingThreshold
    const cost = isFree ? 0 : governorateCost
    
    const govName = lang === 'ar' 
      ? (EGYPT_GOVERNORATES.find(g => g.id === selectedGovernorate)?.nameAr || selectedGovernorate)
      : (EGYPT_GOVERNORATES.find(g => g.id === selectedGovernorate)?.name || selectedGovernorate)

    return {
      cost,
      zone: govName,
      isFree
    }
  }, [currency, selectedGovernorate, governorateCosts, totalPrice, currencyConfig, t, lang])

  const shippingDetails = calculateShipping()

  // ============ SCROLL ANIMATIONS ============
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
      setMapCenter(currency === 'USD' 
        ? { lat: 40.7128, lng: -74.0060 }
        : { lat: 30.0444, lng: 31.2357 }
      )
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
        setMapCenter(currency === 'USD' 
          ? { lat: 40.7128, lng: -74.0060 }
          : { lat: 30.0444, lng: 31.2357 }
        )
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
        const settingsRef = doc(db, 'egp_settings', 'general')
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
    const errors = {}
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!formData.name.trim()) errors.name = t('nameRequired')
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone)) {
      errors.phone = t('validPhoneRequired')
    }
    if (!formData.email?.trim() || !emailRegex.test(formData.email)) {
      errors.email = t('validEmailRequired') || 'Valid email required'
    }
    if (!formData.address.trim() || formData.address.trim().length < 10) {
      errors.address = t('addressTooShort') || 'Address must be at least 10 characters'
    }
    
    if (currency === 'EGP' && !formData.governorate) {
      errors.governorate = t('selectGovernorate') || 'Please select your governorate'
    }
    
    if (!formData.latitude || !formData.longitude) {
      errors.location = t('locationRequired')
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData, t, currency])

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
      const countryCodes = currency === 'USD' ? '' : '&countrycodes=eg'
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}${countryCodes}&limit=5`
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
  }, [searchQuery, currency])

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
      
      const initialCenter = mapEditorCenter || (currency === 'USD' 
        ? { lat: 40.7128, lng: -74.0060 }
        : { lat: 30.0444, lng: 31.2357 })
      
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
      : mapCenter || (currency === 'USD' 
        ? { lat: 40.7128, lng: -74.0060 }
        : { lat: 30.0444, lng: 31.2357 })
      
    setMapEditorCenter(initialCenter)
    setTempLocation(initialCenter)
    setSearchQuery('')
    setSearchResults([])
    setShowMapEditor(true)
    
    document.body.style.overflow = 'hidden'
  }, [deliveryInfo, mapCenter, currency])

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
    const rawInput = couponInput.trim()
    if (!rawInput) return
    
    console.log('🔍 Attempting to apply coupon:', rawInput)
    
    setCouponLoading(true)
    setCouponError(null)
    
    try {
      const couponsRef = collection(db, 'egp_coupons')
      
      let q = query(
        couponsRef, 
        where('code', '==', rawInput),
        where('isActive', '==', true)
      )
      let snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        console.log('❌ Exact match failed, trying uppercase...')
        q = query(
          couponsRef,
          where('code', '==', rawInput.toUpperCase()),
          where('isActive', '==', true)
        )
        snapshot = await getDocs(q)
      }
      
      if (snapshot.empty) {
        console.log('❌ Uppercase failed, trying lowercase...')
        q = query(
          couponsRef,
          where('code', '==', rawInput.toLowerCase()),
          where('isActive', '==', true)
        )
        snapshot = await getDocs(q)
      }
      
      if (snapshot.empty) {
        console.log('❌ Lowercase failed, trying case-insensitive...')
        q = query(couponsRef, where('isActive', '==', true))
        const allCoupons = await getDocs(q)
        const matchingDoc = allCoupons.docs.find(doc => {
          const code = doc.data().code
          const match = code.toLowerCase() === rawInput.toLowerCase()
          console.log(`Comparing: "${code}" vs "${rawInput}" -> ${match}`)
          return match
        })
        
        if (matchingDoc) {
          snapshot = { docs: [matchingDoc], empty: false }
        }
      }
      
      console.log('📊 Final snapshot:', {
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
      
      console.log('✅ Found coupon:', couponData)
      
      const now = new Date()
      const expiresAt = couponData.expiresAt?.toDate?.() || new Date(couponData.expiresAt)
      
      if (expiresAt < now) {
        console.log('⏰ Coupon expired:', expiresAt)
        setCouponError(t('couponExpired') || 'Coupon expired')
        setCouponLoading(false)
        return
      }
      
      if (couponData.usedCount >= couponData.maxUses) {
        console.log('🚫 Usage limit reached:', couponData.usedCount, '/', couponData.maxUses)
        setCouponError(t('couponExhausted') || 'Coupon fully used')
        setCouponLoading(false)
        return
      }
      
      if (couponData.currency && couponData.currency !== 'EGP') {
        setCouponError(t('couponCurrencyMismatch') || `Coupon valid only for ${couponData.currency}`)
        setCouponLoading(false)
        return
      }
      
      const couponToApply = {
        id: couponDoc.id,
        code: couponData.code,
        amount: couponData.amount,
        currency: couponData.currency || 'EGP',
        label: `${currencyConfig.symbol} ${couponData.amount} ${t('off') || 'off'}`
      }
      
      setAppliedCoupon(couponToApply)
      contextSetAppliedCoupon(couponToApply)
      setCouponInput(couponData.code)
      
      console.log('🎉 Coupon applied successfully:', couponToApply)
      
    } catch (error) {
      console.error('💥 Coupon validation error:', error)
      setCouponError(t('couponError') || 'Error, please try again')
    } finally {
      setCouponLoading(false)
    }
  }, [couponInput, currencyConfig.symbol, t, appliedCoupon, contextSetAppliedCoupon])

  const discountAmount = appliedCoupon ? appliedCoupon.amount : 0
  const subtotal = Math.max(0, totalPrice - discountAmount)
  const shippingCost = shippingDetails.cost
  const finalPrice = subtotal + shippingCost

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
          couponRef = doc(db, 'egp_coupons', appliedCoupon.id)
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
          paymentMethod: paymentMethod === 'cod' ? t('cashOnDelivery') : t('cardPayment'),
          paymentStatus: paymentMethod === 'cod' ? 'pending' : 'awaiting_payment',
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

        const mobileOrderRef = doc(db, 'mobile_orders', orderId)
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
            paymentMethod: paymentMethod === 'cod' ? t('cashOnDelivery') : t('cardPayment'),
            status: 'pending',
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'awaiting_payment',
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
  const colors = useMemo(() => ({
    light: {
      primary: '#2C1810',
      secondary: '#D4A574',
      accent: '#E8B4A0',
      background: '#FAFAF8',
      surface: '#FFFFFF',
      card: '#FCFBF9',
      textDark: '#1A1410',
      textMuted: '#8B7D73',
      success: '#6B9E5F',
      danger: '#C84B31',
      warning: '#E8A840',
      border: '#E8DDD4',
      overlay: 'rgba(44, 24, 16, 0.05)'
    },
    dark: {
      primary: '#E8B4A0',
      secondary: '#D4A574',
      accent: '#C49080',
      background: '#0F0E0C',
      surface: '#1A1410',
      card: '#2C1810',
      textDark: '#F5F3F0',
      textMuted: '#A8968B',
      success: '#8FC178',
      danger: '#E67052',
      warning: '#F0B956',
      border: '#3E2723',
      overlay: 'rgba(232, 180, 160, 0.05)'
    }
  }), [])

  const c = colors[theme] || colors.light

  const formatPrice = useCallback((price) => {
    if (currencyConfig.code === 'USD') {
      return `$${price.toFixed(2)}`
    }
    return `${price.toFixed(2)} EGP`
  }, [currencyConfig.code])

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
              placeholder={currency === 'USD' 
                ? (t('searchAreaStreet') || "Search for area, street, or landmark...")
                : (t('searchAreaStreetEgypt') || "Search for area, street, or landmark in Egypt...")}
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

        <style>{`
          @keyframes fadeInMap {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUpMap {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .leaflet-container {
            font-family: inherit;
          }
        `}</style>
      </div>
    )
  }

  const MinimumOrderBanner = () => {
    if (currency !== 'EGP' || minimumOrderAmount <= 0 || totalPrice >= minimumOrderAmount) return null

    const remaining = minimumOrderAmount - totalPrice

    return (
      <div style={{
        padding: '16px 20px',
        background: theme === 'light' ? '#FEF3C7' : '#451a03',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: c.warning,
        borderRadius: '16px',
        marginBottom: '2rem',
        color: c.warning,
        animation: 'slideDown 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '700' }}>
              {t('minimumOrderRequired') || 'Minimum Order Required'}
            </h4>
            <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>
              {t('minimumOrderAmountIs') || 'Minimum order amount is'} <strong>{formatPrice(minimumOrderAmount)}</strong>
            </p>
            <p style={{ margin: '4px 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {t('addMoreToProceed') || 'Add'} <strong>{formatPrice(remaining)}</strong> {t('moreToCheckout') || 'more to proceed with checkout'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const CartErrorBanner = () => {
    if (!cartError && Object.keys(stockErrors).length === 0) return null

    return (
      <div style={{
        padding: '16px 20px',
        background: theme === 'light' ? '#FEF2F0' : '#4A2B24',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: c.danger,
        borderRadius: '16px',
        marginBottom: '2rem',
        color: c.danger,
        animation: 'slideDown 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
        transform: `translateY(${scrollY * 0.05}px)`
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '700' }}>
              {t('stockIssuesDetected')}
            </h4>
            {Object.entries(stockErrors).map(([id, error]) => (
              <p key={id} style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                • {items.find(i => i.id === id)?.name}: {error.message}
              </p>
            ))}
            <button
              onClick={() => setStockErrors({})}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: c.danger,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: '700',
                transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.opacity = '0.9'
                e.target.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = '1'
                e.target.style.transform = 'scale(1)'
              }}
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ EMPTY CART VIEW ============
  if (totalItems === 0) {
    return (
      <div style={{
        padding: isMobile ? '2rem 1rem' : '4rem 2rem',
        background: c.background,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          fontSize: isMobile ? '6rem' : '8rem',
          marginBottom: '2rem',
          opacity: 0.3,
          animation: 'bounce 3s ease-in-out infinite'
        }}>
          🛒
        </div>
        <h2 style={{
          fontSize: isMobile ? '1.75rem' : '2.5rem',
          marginBottom: '1rem',
          color: c.textDark,
          fontWeight: '900',
          textAlign: 'center',
          animation: 'fadeInUp 0.8s ease-out'
        }}>
          {t('emptyCart')}
        </h2>
        <p style={{
          color: c.textMuted,
          marginBottom: '2rem',
          maxWidth: '400px',
          textAlign: 'center',
          animation: 'fadeInUp 1s ease-out 0.2s backwards'
        }}>
          {t('browseOurCollectionAndAddSomeItems')}
        </p>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: c.card,
          borderRadius: '20px',
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: c.border,
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: c.textMuted
        }}>
          <span>{currency === 'USD' ? '💵' : '🇪🇬'}</span>
          <span>{t('shoppingIn') || 'Shopping in'} {currencyConfig.code}</span>
        </div>
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '14px 48px',
            background: `linear-gradient(135deg, ${c.secondary} 0%, ${c.accent} 100%)`,
            color: '#FFF',
            border: 'none',
            borderRadius: '14px',
            fontWeight: '800',
            fontSize: '1.1rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
            boxShadow: `0 8px 24px rgba(212, 160, 23, 0.25)`,
            animation: 'fadeInUp 1.2s ease-out 0.4s backwards'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-4px) scale(1.05)'
            e.target.style.boxShadow = '0 12px 32px rgba(212, 160, 23, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0) scale(1)'
            e.target.style.boxShadow = `0 8px 24px rgba(212, 160, 23, 0.25)`
          }}
        >
          🛍️ {t('continueShopping')}
        </button>
      </div>
    )
  }

  // ============ MAIN RENDER ============
  return (
    <div style={{ padding: isMobile ? '1rem' : '2rem', background: c.background, minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          gap: '16px',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          animation: 'fadeInDown 0.6s ease-out'
        }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              padding: '12px 24px',
              background: c.card,
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: c.border,
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '700',
              color: c.textDark,
              transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = c.primary
              e.currentTarget.style.color = 'white'
              e.currentTarget.style.transform = 'translateX(-4px) scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = c.card
              e.currentTarget.style.color = c.textDark
              e.currentTarget.style.transform = 'translateX(0) scale(1)'
            }}
          >
            ← {!isMobile && t('back')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: c.card,
              borderRadius: '20px',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: c.secondary,
              fontSize: '0.85rem',
              fontWeight: '700',
              color: c.secondary
            }}>
              <span>{currency === 'USD' ? '💵' : '🇪🇬'}</span>
              <span>{currencyConfig.code}</span>
            </div>

            <h1 style={{
              margin: 0,
              color: c.textDark,
              fontSize: isMobile ? '1.8rem' : '2.5rem',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              🛒 {t('cart')}
              <span style={{
                fontSize: isMobile ? '1rem' : '1.3rem',
                fontWeight: '800',
                background: `linear-gradient(135deg, ${c.secondary}20, ${c.secondary}05)`,
                color: c.secondary,
                padding: '8px 16px',
                borderRadius: '24px',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: c.secondary,
                minWidth: '50px',
                textAlign: 'center',
                animation: 'badgePulse 2s ease-in-out infinite'
              }}>
                {totalItems}
              </span>
            </h1>
          </div>
        </header>

        <CartErrorBanner />
        <MinimumOrderBanner />
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 420px',
          gap: '2.5rem',
          alignItems: 'start'
        }}>
          
          {/* CART ITEMS */}
          <main>
            {items.map((item, idx) => {
              const product = productDetails[item.id]
              const stockError = stockErrors[item.id]
              const isOutOfStock = !product || product.stock <= 0
              const isLowStock = product && product.stock > 0 && product.stock < 10
              const canIncrease = product && item.quantity < product.stock
              const isUpdating = updatingItems.has(item.id)

              return (
                <article
                  key={item.id}
                  onMouseEnter={() => !isMobile && setHoveredItem(item.id)}
                  onMouseLeave={() => !isMobile && setHoveredItem(null)}
                  style={{
                    padding: isMobile ? '1.25rem' : '1.75rem',
                    background: c.card,
                    borderRadius: '16px',
                    marginBottom: '1.5rem',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: stockError ? c.danger : isOutOfStock ? c.danger : c.border,
                    display: 'grid',
                    gridTemplateColumns: isSmallMobile ? '1fr' : '130px 1fr',
                    gap: '1.5rem',
                    opacity: isOutOfStock ? 0.7 : 1,
                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.320, 1)',
                    transform: hoveredItem === item.id ? 'translateY(-6px) scale(1.01)' : 'translateY(0) scale(1)',
                    boxShadow: hoveredItem === item.id ? `0 16px 40px ${c.overlay}` : `0 4px 12px ${c.overlay}`,
                    animation: `slideInItem 0.5s ease-out ${idx * 0.1}s backwards`
                  }}
                >
                  <div
                    onClick={() => navigate(`/product/${item.id}`)}
                    style={{
                      width: isSmallMobile ? '100%' : '130px',
                      height: isSmallMobile ? '200px' : '130px',
                      background: c.overlay,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: c.border,
                      transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.320, 1)',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (!isMobile && product?.imageUrl) {
                        e.currentTarget.style.transform = 'scale(1.08) rotate(2deg)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
                    }}
                  >
                    {product?.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={item.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isOutOfStock ? 'grayscale(0.8) opacity(0.6)' : 'none'
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        fontSize: '3rem'
                      }}>
                        🍫
                      </div>
                    )}
                    {isOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '900',
                        textTransform: 'uppercase'
                      }}>
                        {t('outOfStock')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '8px' }}>
                        <h3
                          onClick={() => navigate(`/product/${item.id}`)}
                          style={{
                            margin: 0,
                            color: isOutOfStock ? c.textMuted : c.textDark,
                            fontSize: isMobile ? '1.05rem' : '1.2rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            textDecoration: isOutOfStock ? 'line-through' : 'none',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            transition: 'color 0.3s ease'
                          }}
                        >
                          {item.name}
                        </h3>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: c.danger,
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '4px',
                            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.4) rotate(15deg)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1) rotate(0deg)'
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{
                        color: c.secondary,
                        fontSize: '1.4rem',
                        fontWeight: '900',
                        marginBottom: '0.5rem'
                      }}>
                        {formatPrice(item.price * item.quantity)}
                      </div>

                      <div style={{
                        color: c.textMuted,
                        fontSize: '0.85rem',
                        marginBottom: '1rem'
                      }}>
                        @ {formatPrice(item.price)} {t('each')}
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        fontWeight: '700'
                      }}>
                        {isOutOfStock ? (
                          <span style={{ color: c.danger }}>❌ {t('outOfStock')}</span>
                        ) : isLowStock ? (
                          <span style={{ color: c.warning }}>⚡ {t('onlyLeft', { count: product.stock })}</span>
                        ) : (
                          <span style={{ color: c.success }}>✓ {t('inStock', { count: product.stock })}</span>
                        )}
                      </div>

                      {stockError && (
                        <div style={{
                          padding: '10px 14px',
                          background: `${c.danger}20`,
                          borderLeftWidth: '4px',
                          borderLeftStyle: 'solid',
                          borderLeftColor: c.danger,
                          borderRadius: '8px',
                          color: c.danger,
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          marginBottom: '1rem',
                          animation: 'slideDown 0.5s ease-out'
                        }}>
                          ⚠️ {stockError.message}
                        </div>
                      )}

                      {product?.flavors && product.flavors.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <button
                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: c.secondary,
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              textDecoration: 'underline',
                              padding: 0,
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.color = c.accent
                              e.target.style.letterSpacing = '0.5px'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.color = c.secondary
                              e.target.style.letterSpacing = '0px'
                            }}
                          >
                            🍬 {product.flavors.length} {t('flavors')} {expandedItem === item.id ? '▲' : '▼'}
                          </button>
                          {expandedItem === item.id && (
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              marginTop: '10px',
                              animation: 'slideDown 0.4s ease-out'
                            }}>
                              {product.flavors.map((flavor, i) => (
                                <span
                                  key={i}
                                  style={{
                                    background: c.overlay,
                                    padding: '6px 12px',
                                    borderRadius: '12px',
                                    color: c.textDark,
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    borderColor: c.border,
                                    animation: `fadeInScale 0.4s ease-out ${i * 0.08}s backwards`
                                  }}
                                >
                                  {flavor}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1rem' }}>
                      <span style={{
                        fontSize: '0.85rem',
                        color: c.textMuted,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {t('qty')}:
                      </span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: c.overlay,
                        padding: '6px',
                        borderRadius: '10px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: c.border,
                        transition: 'all 0.3s ease'
                      }}>
                        <button
                          onClick={() => handleQuantityUpdate(item, item.quantity - 1)}
                          disabled={isUpdating}
                          style={{
                            width: '36px',
                            height: '36px',
                            border: 'none',
                            background: c.card,
                            borderRadius: '8px',
                            cursor: isUpdating ? 'not-allowed' : 'pointer',
                            fontWeight: '800',
                            color: c.textDark,
                            opacity: isUpdating ? 0.5 : 1,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => !isUpdating && (e.target.style.background = c.danger)}
                          onMouseLeave={(e) => (e.target.style.background = c.card)}
                        >
                          −
                        </button>
                        <span style={{
                          fontWeight: '800',
                          minWidth: '36px',
                          textAlign: 'center',
                          color: c.textDark,
                          fontSize: '1rem'
                        }}>
                          {isUpdating ? '⟳' : item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityUpdate(item, item.quantity + 1)}
                          disabled={!canIncrease || isUpdating || isOutOfStock}
                          style={{
                            width: '36px',
                            height: '36px',
                            border: 'none',
                            background: (!canIncrease || isOutOfStock) ? c.overlay : c.card,
                            borderRadius: '8px',
                            cursor: (!canIncrease || isUpdating || isOutOfStock) ? 'not-allowed' : 'pointer',
                            fontWeight: '800',
                            color: (!canIncrease || isOutOfStock) ? c.textMuted : c.textDark,
                            opacity: isUpdating ? 0.5 : 1,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => !(!canIncrease || isUpdating || isOutOfStock) && (e.target.style.background = c.success)}
                          onMouseLeave={(e) => (e.target.style.background = (!canIncrease || isOutOfStock) ? c.overlay : c.card)}
                        >
                          +
                        </button>
                      </div>
                      {product && item.quantity >= product.stock && !isOutOfStock && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: c.warning,
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          {t('maxReached')}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </main>

          {/* SIDEBAR */}
          <aside style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: isMobile ? 'relative' : 'sticky',
            top: '20px',
            height: 'fit-content'
          }}>
            {(showDeliveryForm || !hasDeliveryInfo) && (
              <form onSubmit={handleSaveDelivery} style={{
                background: c.card,
                padding: isMobile ? '1.5rem' : '1.75rem',
                borderRadius: '16px',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: c.secondary + '40',
                boxShadow: `0 8px 24px ${c.overlay}`,
                animation: 'slideInRight 0.6s ease-out'
              }}>
                <h3 style={{
                  margin: '0 0 1.5rem 0',
                  color: c.textDark,
                  fontWeight: '800',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📍 {t('deliveryInformation')}
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.7rem',
                    padding: '4px 8px',
                    background: c.overlay,
                    borderRadius: '12px',
                    color: c.textMuted
                  }}>
                    {currencyConfig.code}
                  </span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: c.textDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {t('fullName')} <span style={{ color: c.danger }}>*</span>
                    </label>
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder={t('enterFullName') || "Enter your full name"}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: formErrors.name ? c.danger : c.border,
                        borderRadius: '12px',
                        fontSize: '1rem',
                        background: c.surface,
                        color: c.textDark,
                        fontFamily: 'inherit',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        if (!formErrors.name) e.target.style.borderColor = c.secondary
                      }}
                      onBlur={(e) => (e.target.style.borderColor = formErrors.name ? c.danger : c.border)}
                    />
                    {formErrors.name && <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>✕ {formErrors.name}</div>}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: c.textDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {t('phoneNumber')} <span style={{ color: c.danger }}>*</span>
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder={currency === 'USD' ? '+1 (555) 123-4567' : '+20 123 456 7890'}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: formErrors.phone ? c.danger : c.border,
                        borderRadius: '12px',
                        fontSize: '1rem',
                        background: c.surface,
                        color: c.textDark,
                        fontFamily: 'inherit',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        if (!formErrors.phone) e.target.style.borderColor = c.secondary
                      }}
                      onBlur={(e) => (e.target.style.borderColor = formErrors.phone ? c.danger : c.border)}
                    />
                    {formErrors.phone && <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>✕ {formErrors.phone}</div>}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: c.textDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {t('email')} <span style={{ color: c.danger }}>*</span>
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your@email.com"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: formErrors.email ? c.danger : c.border,
                        borderRadius: '12px',
                        fontSize: '1rem',
                        background: c.surface,
                        color: c.textDark,
                        fontFamily: 'inherit',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        if (!formErrors.email) e.target.style.borderColor = c.secondary
                      }}
                      onBlur={(e) => (e.target.style.borderColor = formErrors.email ? c.danger : c.border)}
                    />
                    {formErrors.email && <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>✕ {formErrors.email}</div>}
                  </div>

                  {currency === 'EGP' && (
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: c.textDark,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {t('governorate') || 'Governorate'} <span style={{ color: c.danger }}>*</span>
                      </label>
                      <select
                        name="governorate"
                        value={formData.governorate}
                        onChange={handleGovernorateChange}
                        disabled={loadingGovernorates}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: formErrors.governorate ? c.danger : c.border,
                          borderRadius: '12px',
                          fontSize: '1rem',
                          background: c.surface,
                          color: c.textDark,
                          fontFamily: 'inherit',
                          cursor: loadingGovernorates ? 'not-allowed' : 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onFocus={(e) => {
                          if (!formErrors.governorate) e.target.style.borderColor = c.secondary
                        }}
                        onBlur={(e) => (e.target.style.borderColor = formErrors.governorate ? c.danger : c.border)}
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
                      {formErrors.governorate && (
                        <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>
                          ✕ {formErrors.governorate}
                        </div>
                      )}
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: c.textMuted, 
                        marginTop: '6px',
                        fontStyle: 'italic'
                      }}>
                        {t('shippingCostVaries') || 'Shipping cost varies by governorate'}
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: c.textDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {t('detailedAddress')} <span style={{ color: c.danger }}>*</span>
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder={t('enterDetailedAddress') || "Enter detailed address"}
                      rows="3"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: formErrors.address ? c.danger : c.border,
                        borderRadius: '12px',
                        fontSize: '1rem',
                        background: c.surface,
                        color: c.textDark,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        if (!formErrors.address) e.target.style.borderColor = c.secondary
                      }}
                      onBlur={(e) => (e.target.style.borderColor = formErrors.address ? c.danger : c.border)}
                    />
                    {formErrors.address && <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>✕ {formErrors.address}</div>}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: c.textDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {t('city')} {currency !== 'EGP' && <span style={{ color: c.danger }}>*</span>}
                    </label>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder={currency === 'USD' ? t('enterCityExample') || "Enter city (e.g., New York)" : t('enterCityAreaExample') || "Enter city or area (e.g., Nasr City)"}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: formErrors.city ? c.danger : c.border,
                        borderRadius: '12px',
                        fontSize: '1rem',
                        background: c.surface,
                        color: c.textDark,
                        fontFamily: 'inherit',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        if (!formErrors.city) e.target.style.borderColor = c.secondary
                      }}
                      onBlur={(e) => (e.target.style.borderColor = formErrors.city ? c.danger : c.border)}
                    />
                    {formErrors.city && <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>✕ {formErrors.city}</div>}
                  </div>

                  <div>
                    <label style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: c.textDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <span>{t('location')} <span style={{ color: c.danger }}>*</span></span>
                      <button
                        type="button"
                        onClick={handleOpenMapEditor}
                        style={{
                          background: `linear-gradient(135deg, ${c.secondary} 0%, ${c.accent} 100%)`,
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'
                          e.currentTarget.style.boxShadow = `0 4px 12px ${c.secondary}40`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        🗺️ {t('editLocation') || 'Edit Location'}
                      </button>
                    </label>

                    {mapError && (
                      <div style={{
                        padding: '10px 12px',
                        background: `${c.warning}20`,
                        color: c.warning,
                        fontSize: '0.8rem',
                        borderLeftWidth: '4px',
                        borderLeftStyle: 'solid',
                        borderLeftColor: c.warning,
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                        fontWeight: '700'
                      }}>
                        ⚠️ {t('geolocationNotSupported')}
                      </div>
                    )}

                    <div style={{
                      height: '250px',
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: formErrors.location ? c.danger : c.border,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: c.overlay
                    }}>
                      {mapLoading ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: c.textMuted
                        }}>
                          {t('loadingMap')}
                        </div>
                      ) : mapCenter ? (
                        <iframe
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 0.01}%2C${mapCenter.lat - 0.01}%2C${mapCenter.lng + 0.01}%2C${mapCenter.lat + 0.01}&marker=${mapCenter.lat}%2C${mapCenter.lng}`}
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          title={t('locationMap') || "Location Map"}
                          loading="lazy"
                        />
                      ) : null}
                    </div>

                    {formErrors.location && <div style={{ color: c.danger, fontSize: '0.75rem', marginTop: '4px' }}>✕ {formErrors.location}</div>}
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '13px 20px',
                    background: `linear-gradient(135deg, ${c.success} 0%, ${c.success}dd 100%)`,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px) scale(1.05)'
                    e.target.style.boxShadow = `0 8px 20px ${c.success}50`
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0) scale(1)'
                    e.target.style.boxShadow = 'none'
                  }}
                >
                  <span>✓</span> {t('save')}
                </button>
              </form>
            )}

            {hasDeliveryInfo && !showDeliveryForm && (
              <div style={{
                background: `linear-gradient(135deg, ${c.success}15, ${c.success}05)`,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: c.success + '40',
                padding: '1.5rem',
                borderRadius: '14px',
                boxShadow: `0 4px 12px ${c.overlay}`,
                animation: 'slideInRight 0.6s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: c.success, fontWeight: '800', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✓</span> {t('deliveryInformation')}
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowDeliveryForm(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: c.success,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        textDecoration: 'underline',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = c.secondary
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = c.success
                      }}
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={handleOpenMapEditor}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: c.secondary,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        textDecoration: 'underline',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = c.accent
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = c.secondary
                      }}
                    >
                      🗺️ {t('location')}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.9rem', color: c.textDark, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>{deliveryInfo.name}</strong></div>
                  <div>{deliveryInfo.phone}</div>
                  <div>{deliveryInfo.email}</div>
                  {currency === 'EGP' && deliveryInfo.governorate && (
                    <div style={{ color: c.secondary, fontWeight: '700' }}>
                      📍 {lang === 'ar' 
                        ? (EGYPT_GOVERNORATES.find(g => g.id === deliveryInfo.governorate)?.nameAr || deliveryInfo.governorate)
                        : (EGYPT_GOVERNORATES.find(g => g.id === deliveryInfo.governorate)?.name || deliveryInfo.governorate)
                      }
                    </div>
                  )}
                  <div style={{ wordBreak: 'break-word' }}>{deliveryInfo.address}</div>
                </div>
              </div>
            )}

            {/* COUPON SECTION */}
            <div style={{
              background: c.card,
              padding: '1.5rem',
              borderRadius: '14px',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: couponError ? c.danger : appliedCoupon ? c.success + '40' : c.border,
              boxShadow: `0 4px 12px ${c.overlay}`,
              animation: 'slideInRight 0.7s ease-out'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', color: c.textDark, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎟️ {t('haveCoupon') || 'Coupon'}
                {appliedCoupon && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: c.success, fontWeight: 700 }}>✓ {t('active') || 'Active'}</span>}
              </h4>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: couponError || appliedCoupon ? '1rem' : 0 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase())
                      if (appliedCoupon && e.target.value.toUpperCase() !== appliedCoupon.code) {
                        setAppliedCoupon(null)
                        contextSetAppliedCoupon(null)
                        setCouponError(null)
                      }
                    }}
                    placeholder={t('enterCouponCode') || "Enter coupon code"}
                    disabled={couponLoading}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: couponError ? c.danger : appliedCoupon ? c.success : c.border,
                      borderRadius: '10px',
                      background: appliedCoupon ? `${c.success}10` : c.surface,
                      color: c.textDark,
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      fontFamily: 'inherit',
                      transition: 'all 0.3s ease'
                    }}
                  />
                  {appliedCoupon && (
                    <span style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: c.success,
                      fontSize: '1rem'
                    }}>
                      ✓
                    </span>
                  )}
                </div>
                
                {!appliedCoupon ? (
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    style={{
                      padding: '10px 16px',
                      background: couponLoading || !couponInput.trim() ? c.textMuted : c.secondary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      cursor: couponLoading || !couponInput.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {couponLoading ? '⟳' : t('apply')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAppliedCoupon(null)
                      contextSetAppliedCoupon(null)
                      setCouponInput('')
                      setCouponError(null)
                    }}
                    style={{
                      padding: '10px 16px',
                      background: c.danger,
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    {t('remove') || 'Remove'}
                  </button>
                )}
              </div>
              
              {couponError && (
                <div style={{
                  padding: '10px 14px',
                  background: `${c.danger}20`,
                  borderLeftWidth: '4px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: c.danger,
                  borderRadius: '8px',
                  color: c.danger,
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}>
                  ⚠️ {couponError}
                </div>
              )}
              
              {appliedCoupon && (
                <div style={{
                  padding: '12px 16px',
                  background: `${c.success}15`,
                  borderRadius: '10px',
                  border: `1px solid ${c.success}40`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>🎉</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: c.textMuted }}>{t('discountApplied') || 'Discount applied'}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c.success }}>
                      -{currencyConfig.symbol} {appliedCoupon.amount}
                    </div>
                  </div>
                </div>
              )}
              
              <p style={{
                marginTop: '12px',
                fontSize: '0.75rem',
                color: c.textMuted,
                fontStyle: 'italic'
              }}>
                * {t('couponInstructions') || 'Enter a different code above to replace, or remove to clear'}
              </p>
            </div>

            {/* PAYMENT METHOD */}
            <div style={{
              background: c.card,
              padding: '1.5rem',
              borderRadius: '14px',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: c.border,
              boxShadow: `0 4px 12px ${c.overlay}`,
              animation: 'slideInRight 0.75s ease-out'
            }}>
              <h4 style={{
                margin: '0 0 1rem 0',
                color: c.textDark,
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                💳 {t('paymentMethod') || 'Payment Method'}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currency === 'EGP' && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px',
                    background: paymentMethod === 'cod' ? `${c.success}15` : c.overlay,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: paymentMethod === 'cod' ? c.success : c.border,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}>
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ width: '20px', height: '20px', accentColor: c.success }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', color: c.textDark }}>{t('cashOnDelivery') || 'Cash on Delivery'}</div>
                      <div style={{ fontSize: '0.8rem', color: c.textMuted }}>{t('payWhenReceive') || 'Pay when you receive'}</div>
                    </div>
                    <span style={{ fontSize: '1.5rem' }}>💵</span>
                  </label>
                )}

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  background: c.overlay,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: c.border,
                  borderRadius: '12px',
                  cursor: 'not-allowed',
                  transition: 'all 0.3s ease',
                  opacity: 0.5
                }}>
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={false}
                    disabled={true}
                    onChange={() => {}}
                    style={{ width: '20px', height: '20px', accentColor: c.secondary }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '800', color: c.textMuted }}>{t('creditDebitCard') || 'Credit/Debit Card'}</div>
                    <div style={{ fontSize: '0.8rem', color: c.textMuted }}>
                      {t('temporarilyUnavailable') || 'Temporarily unavailable'}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>💳</span>
                </label>
              </div>
            </div>

            {/* ORDER SUMMARY */}
            <div style={{
              background: c.card,
              padding: '1.5rem',
              borderRadius: '14px',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: c.secondary + '40',
              boxShadow: `0 8px 24px ${c.overlay}`,
              animation: 'slideInRight 0.8s ease-out'
            }}>
              <h4 style={{ margin: '0 0 1.25rem 0', color: c.textDark, fontWeight: '800', fontSize: '1.1rem' }}>
                💰 {t('orderSummary')}
              </h4>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                paddingBottom: '1.25rem',
                borderBottomWidth: '2px',
                borderBottomStyle: 'solid',
                borderBottomColor: c.border
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: c.textMuted, fontSize: '0.9rem', fontWeight: '600' }}>
                  <span>{t('subtotal')}</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: c.success, fontSize: '0.9rem', fontWeight: '800', animation: 'slideDown 0.4s ease-out' }}>
                    <span>💚 {t('discount')}</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: c.textMuted, fontSize: '0.9rem', fontWeight: '600' }}>
                  <span>{t('shipping')}</span>
                  <span style={{ 
                    color: shippingDetails.isFree ? c.success : c.textDark, 
                    fontWeight: '800',
                    animation: shippingDetails.isFree ? 'badgePulse 2s ease-in-out infinite' : 'none'
                  }}>
                    {shippingDetails.isFree 
                      ? `${t('free')} 🎉` 
                      : formatPrice(shippingCost)
                    }
                  </span>
                </div>
                {currency === 'EGP' && deliveryInfo?.governorate && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: c.textMuted, 
                    textAlign: 'right',
                    marginTop: '-4px'
                  }}>
                    📍 {lang === 'ar' 
                      ? (EGYPT_GOVERNORATES.find(g => g.id === deliveryInfo.governorate)?.nameAr || deliveryInfo.governorate)
                      : (EGYPT_GOVERNORATES.find(g => g.id === deliveryInfo.governorate)?.name || deliveryInfo.governorate)
                    }
                  </div>
                )}
              </div>
              
              {!shippingDetails.isFree && (
                <div style={{
                  marginBottom: '1.25rem',
                  background: c.overlay,
                  borderRadius: '8px',
                  height: '6px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min((totalPrice / currencyConfig.freeShippingThreshold) * 100, 100)}%`,
                    background: c.secondary,
                    height: '100%',
                    transition: 'width 0.5s cubic-bezier(0.23, 1, 0.320, 1)'
                  }} />
                </div>
              )}
              {!shippingDetails.isFree && (
                <p style={{
                  fontSize: '0.75rem',
                  color: c.textMuted,
                  textAlign: 'center',
                  marginBottom: '1.25rem',
                  animation: 'fadeInUp 0.6s ease-out'
                }}>
                  {t('addMoreForFreeShipping', { amount: formatPrice(currencyConfig.freeShippingThreshold - totalPrice) }) || `Add ${formatPrice(currencyConfig.freeShippingThreshold - totalPrice)} more for free shipping!`}
                </p>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.3rem',
                fontWeight: '900',
                color: c.textDark,
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <span>{t('total')}:</span>
                <span style={{ color: c.secondary }}>{formatPrice(finalPrice)}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={!canCheckout}
                style={{
                  width: '100%',
                  padding: '15px 20px',
                  background: canCheckout ? `linear-gradient(135deg, ${c.secondary} 0%, ${c.accent} 100%)` : c.textMuted,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '900',
                  fontSize: '1.05rem',
                  cursor: canCheckout ? 'pointer' : 'not-allowed',
                  opacity: canCheckout ? 1 : 0.6,
                  transition: 'all 0.4s cubic-bezier(0.23, 1, 0.320, 1)',
                  boxShadow: canCheckout ? `0 4px 12px ${c.overlay}` : 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (canCheckout) {
                    e.target.style.transform = 'translateY(-4px) scale(1.05)'
                    e.target.style.boxShadow = `0 12px 32px ${c.overlay}`
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0) scale(1)'
                  e.target.style.boxShadow = canCheckout ? `0 4px 12px ${c.overlay}` : 'none'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>
                  {isProcessing ? '⏳' : 
                   !hasDeliveryInfo ? '📝' : 
                   Object.keys(stockErrors).length > 0 ? '❌' : 
                   (currency === 'EGP' && minimumOrderAmount > 0 && totalPrice < minimumOrderAmount) ? '💰' : 
                   '💳'}
                </span>
                {isProcessing ? t('processing') : 
                 !hasDeliveryInfo ? t('completeDeliveryInfo') : 
                 Object.keys(stockErrors).length > 0 ? t('resolveStockIssues') : 
                 (currency === 'EGP' && minimumOrderAmount > 0 && totalPrice < minimumOrderAmount) ? 
                   `${t('minOrder') || 'Min Order'}: ${formatPrice(minimumOrderAmount)}` : 
                 `${t('checkout')} (${currencyConfig.code})`}
              </button>

              {!canCheckout && (
                <p style={{
                  marginTop: '12px',
                  color: c.danger,
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  fontWeight: '700',
                  background: `${c.danger}15`,
                  padding: '10px',
                  borderRadius: '8px',
                  borderLeftWidth: '4px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: c.danger
                }}>
                  {!hasDeliveryInfo ? t('pleaseCompleteDeliveryInfo') : 
                   Object.keys(stockErrors).length > 0 ? t('adjustQuantitiesBeforeCheckout') :
                   (currency === 'EGP' && minimumOrderAmount > 0 && totalPrice < minimumOrderAmount) ? 
                     `${t('minimumOrderRequired')}: ${formatPrice(minimumOrderAmount)}. ${t('add')} ${formatPrice(minimumOrderAmount - totalPrice)} ${t('more')}.` :
                   t('cannotProceed')}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <MapEditorModal />

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInItem {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        * {
          box-sizing: border-box;
        }

        button:disabled {
          cursor: not-allowed !important;
        }

        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type=number] {
          -moz-appearance: textfield;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}