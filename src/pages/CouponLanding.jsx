// src/pages/CouponLanding.jsx — ProActive Fashion design system refactor.
//
// Logic is unchanged: the same Firestore query, the same defence-in-depth
// validation chain (session flag, active, expiry, usage limit, exact code,
// currency), the same context + sessionStorage handoff to the cart, and the
// same two navigation handlers. Only the markup changed — the four animated
// full-screen states became .pa-coupon-card variants, Summary and .pa-btn, and
// money goes through the design system's formatEGP.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { COLLECTIONS } from '../config'
import {
  collection,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../context/LanguageContext'
import { Button, Summary, formatEGP } from '../ui'

export default function CouponLanding() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { items, totalPrice, setAppliedCoupon } = useCart()
  const { t, lang } = useLanguage()

  const [coupon, setCoupon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alreadyApplied, setAlreadyApplied] = useState(false)

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  useEffect(() => {
    const validateCoupon = async () => {
      try {
        // Check session first
        const sessionApplied = sessionStorage.getItem(`coupon_${code?.toUpperCase()}_used`)
        if (sessionApplied) {
          setAlreadyApplied(true)
          setLoading(false)
          return
        }

        if (!code) {
          setError('No coupon code provided')
          setLoading(false)
          return
        }

        // Query with BOTH filters to minimize data exposure
        const couponsRef = collection(db, COLLECTIONS.coupons)
        const q = query(
          couponsRef,
          where('code', '==', code.toUpperCase()),
          where('isActive', '==', true),
          limit(1)
        )

        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          setError('Invalid coupon code')
          setLoading(false)
          return
        }

        const couponDoc = snapshot.docs[0]
        const couponData = couponDoc.data()

        // CRITICAL: Double-check everything client-side
        const now = new Date()
        const expiresAt = couponData.expiresAt?.toDate?.() || new Date(couponData.expiresAt)

        // Verify all conditions (defense in depth)
        if (!couponData.isActive) {
          setError('This coupon is no longer active')
          setLoading(false)
          return
        }

        if (expiresAt < now) {
          setError('This coupon has expired')
          setLoading(false)
          return
        }

        if (couponData.usedCount >= couponData.maxUses) {
          setError('This coupon has reached its usage limit')
          setLoading(false)
          return
        }

        // Additional security: verify the code matches exactly
        if (couponData.code !== code.toUpperCase()) {
          setError('Invalid coupon code')
          setLoading(false)
          return
        }

        // FIXED: Check currency compatibility
        if (couponData.currency && couponData.currency !== 'EGP') {
          setError(`This coupon is only valid for ${couponData.currency} currency`)
          setLoading(false)
          return
        }

        // Success - set coupon
        const couponToApply = {
          id: couponDoc.id,
          code: couponData.code,
          amount: couponData.amount,
          currency: couponData.currency || 'EGP',
          expiresAt: expiresAt.toISOString()
        }

        setCoupon({
          id: couponDoc.id,
          ...couponData,
          expiresAt: expiresAt
        })

        // Store in context (persists to localStorage)
        setAppliedCoupon(couponToApply)

        // Store for cart auto-apply
        sessionStorage.setItem('prefillCouponCode', couponData.code)
        sessionStorage.setItem('autoApplyCoupon', JSON.stringify(couponToApply))

        setLoading(false)
      } catch (err) {
        console.error('Coupon validation error:', err)
        setError('Failed to validate coupon. Please try again.')
        setLoading(false)
      }
    }

    validateCoupon()
  }, [code, setAppliedCoupon])

  const handleContinueShopping = () => {
    navigate('/home', { state: { couponApplied: true, couponCode: code } })
  }

  const handleGoToCart = () => {
    navigate('/cart')
  }

  if (loading) {
    return (
      <div className="pa-container" style={{ paddingBlock: 64, minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--pa-line)', borderTopColor: 'var(--pa-ink)', animation: 'pa-spin 1s linear infinite' }} />
          <p className="pa-subtitle" role="status">{L(null, 'Validating coupon...', 'جاري التحقق من الكوبون...')}</p>
        </div>
        <style>{`@keyframes pa-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pa-container" style={{ paddingBlock: 48, display: 'flex', justifyContent: 'center' }}>
        <div className="pa-coupon-card pa-coupon-card--error" style={{ maxWidth: 480, width: '100%', alignItems: 'center', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ fontSize: 40 }}>❌</div>
          <h1 style={{ fontSize: 24 }}>{L('invalidCouponTitle', 'Invalid Coupon', 'كوبون غير صالح')}</h1>
          <p className="pa-subtitle" style={{ margin: 0 }}>{error}</p>
          <div style={{ marginTop: 8 }}>
            <Button onClick={() => navigate('/home')}>
              {L('continueShopping', 'Continue Shopping', 'كمل تسوق')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (alreadyApplied) {
    return (
      <div className="pa-container" style={{ paddingBlock: 48, display: 'flex', justifyContent: 'center' }}>
        <div className="pa-coupon-card" style={{ maxWidth: 480, width: '100%', alignItems: 'center', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ fontSize: 24 }}>{L('alreadyApplied', 'Already Applied', 'متطبق بالفعل')}</h1>
          <p className="pa-subtitle" style={{ margin: 0 }}>
            {L(null, 'This coupon has already been applied to your cart', 'الكوبون ده متطبق على عربيتك بالفعل')}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            <Button variant="outline" onClick={() => navigate('/home')}>
              {L('continueShopping', 'Continue Shopping', 'كمل تسوق')}
            </Button>
            <Button onClick={() => navigate('/cart')}>
              {L('viewCart', 'View Cart', 'شوف العربية')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pa-container" style={{ paddingBlock: 48, display: 'flex', justifyContent: 'center' }}>
      <div className="pa-coupon-card" style={{ maxWidth: 520, width: '100%' }}>
        <div aria-hidden="true" style={{ fontSize: 40 }}>🎉</div>
        <h1 style={{ fontSize: 24 }}>{L('couponReady', 'Coupon Ready!', 'الكوبون جاهز!')}</h1>
        <p className="pa-subtitle" style={{ margin: 0 }}>
          {L(null, 'This coupon will be automatically applied at checkout', 'الكوبون ده هيتطبق تلقائياً عند إتمام الطلب')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <div className="pa-price pa-price--lg"><bdi>{formatEGP(coupon.amount)}</bdi></div>
          <span className="pa-subtitle">{L('discountAmount', 'Discount Amount', 'قيمة الخصم')}</span>
          <div className="pa-coupon-card__code">{coupon.code}</div>
        </div>

        <div style={{ width: '100%' }}>
          <Summary
            rows={[
              { label: L('validUntil', 'Valid until', 'صالح حتى'), value: coupon.expiresAt.toLocaleDateString('en-GB') },
              { label: L('status', 'Status', 'الحالة'), value: `✓ ${L('active', 'Active', 'مفعل')}` }
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <Button block onClick={handleContinueShopping}>
            🛍️ {L('continueShopping', 'Continue Shopping', 'كمل تسوق')}
          </Button>

          {items.length > 0 && (
            <Button variant="outline" block onClick={handleGoToCart}>
              🛒 {L('goToCart', 'Go to Cart', 'روح للعربية')} ({items.length}) · <bdi>{formatEGP(totalPrice)}</bdi>
            </Button>
          )}
        </div>

        <div className="pa-callout" style={{ width: '100%' }}>
          💡 <b>{L('tip', 'Tip', 'نصيحة')}:</b>{' '}
          {L(null, 'You can change the coupon code in your cart if you have a better one!', 'تقدر تغيّر كود الكوبون في عربيتك لو عندك كود أحسن!')}
        </div>
      </div>
    </div>
  )
}
