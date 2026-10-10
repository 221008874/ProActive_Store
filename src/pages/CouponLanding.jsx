// src/pages/CouponLanding.jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  limit
} from 'firebase/firestore'
import { useTheme } from '../context/ThemeContext'
import { useCart } from '../context/CartContext'
import { useLocation } from '../context/LocationContext'

export default function CouponLanding() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { currency } = useLocation()
  const { items, totalPrice, setAppliedCoupon } = useCart()
  
  const [coupon, setCoupon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alreadyApplied, setAlreadyApplied] = useState(false)

  const colors = {
    light: {
      primary: '#2C1810',
      secondary: '#D4A574',
      background: '#FAFAF8',
      card: '#FFFFFF',
      textDark: '#1A1410',
      textMuted: '#8B7D73',
      success: '#6B9E5F',
      danger: '#C84B31',
      warning: '#E8A840'
    },
    dark: {
      primary: '#E8B4A0',
      secondary: '#D4A574',
      background: '#0F0E0C',
      card: '#1A1410',
      textDark: '#F5F3F0',
      textMuted: '#A8968B',
      success: '#8FC178',
      danger: '#E67052',
      warning: '#F0B956'
    }
  }

  const c = colors[theme] || colors.light

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
        const couponsRef = collection(db, 'egp_coupons')
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
      <div style={{
        minHeight: '100vh',
        background: c.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: `4px solid ${c.secondary}30`,
          borderTopColor: c.secondary,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: c.textMuted, fontWeight: 600 }}>Validating coupon...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: c.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: c.card,
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          border: `2px solid ${c.danger}40`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.1)`
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: c.danger, marginBottom: '10px' }}>Invalid Coupon</h2>
          <p style={{ color: c.textMuted, marginBottom: '30px' }}>{error}</p>
          <button
            onClick={() => navigate('/home')}
            style={{
              padding: '14px 32px',
              background: c.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  if (alreadyApplied) {
    return (
      <div style={{
        minHeight: '100vh',
        background: c.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: c.card,
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          border: `2px solid ${c.warning}40`
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ color: c.warning, marginBottom: '10px' }}>Already Applied</h2>
          <p style={{ color: c.textMuted, marginBottom: '30px' }}>
            This coupon has already been applied to your cart
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/home')}
              style={{
                padding: '14px 24px',
                background: c.background,
                color: c.textDark,
                border: `2px solid ${c.border}`,
                borderRadius: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Continue Shopping
            </button>
            <button
              onClick={() => navigate('/cart')}
              style={{
                padding: '14px 24px',
                background: c.secondary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              View Cart
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: c.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: c.card,
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
        border: `3px solid ${c.success}40`,
        boxShadow: `0 25px 80px rgba(0,0,0,0.15)`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: `radial-gradient(circle, ${c.success}10 0%, transparent 70%)`,
          animation: 'pulse 3s ease-in-out infinite'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: `linear-gradient(135deg, ${c.success}, ${c.success}dd)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '3rem',
            boxShadow: `0 10px 30px ${c.success}50`,
            animation: 'bounceIn 0.6s cubic-bezier(0.23, 1, 0.320, 1)'
          }}>
            🎉
          </div>

          <h1 style={{
            color: c.textDark,
            fontSize: '2rem',
            marginBottom: '8px',
            fontWeight: 800
          }}>
            Coupon Ready!
          </h1>
          <p style={{ color: c.textMuted, marginBottom: '24px' }}>
            This coupon will be automatically applied at checkout
          </p>

          <div style={{
            background: `linear-gradient(135deg, ${c.secondary}20, ${c.secondary}05)`,
            borderRadius: '16px',
            padding: '24px',
            margin: '24px 0',
            border: `2px solid ${c.secondary}40`
          }}>
            <div style={{
              fontSize: '3rem',
              fontWeight: 800,
              color: c.secondary,
              marginBottom: '8px'
            }}>
              EGP {coupon.amount}
            </div>
            <div style={{
              fontSize: '0.9rem',
              color: c.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontWeight: 700
            }}>
              Discount Amount
            </div>
            
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: `1px dashed ${c.border}`,
              fontFamily: 'monospace',
              fontSize: '1.2rem',
              color: c.textDark,
              letterSpacing: '2px'
            }}>
              {coupon.code}
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '24px',
            fontSize: '0.9rem',
            color: c.textMuted
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Valid until:</span>
              <span style={{ color: c.textDark, fontWeight: 600 }}>
                {coupon.expiresAt.toLocaleDateString('en-GB')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Status:</span>
              <span style={{ color: c.success, fontWeight: 700 }}>✓ Active</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            <button
              onClick={handleContinueShopping}
              style={{
                padding: '16px 32px',
                background: `linear-gradient(135deg, ${c.secondary}, ${c.secondary}dd)`,
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontWeight: 800,
                fontSize: '1.1rem',
                cursor: 'pointer',
                boxShadow: `0 8px 24px ${c.secondary}40`,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-3px) scale(1.02)'
                e.target.style.boxShadow = `0 12px 32px ${c.secondary}60`
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0) scale(1)'
                e.target.style.boxShadow = `0 8px 24px ${c.secondary}40`
              }}
            >
              🛍️ Continue Shopping
            </button>
            
            {items.length > 0 && (
              <button
                onClick={handleGoToCart}
                style={{
                  padding: '14px 32px',
                  background: c.background,
                  color: c.textDark,
                  border: `2px solid ${c.border}`,
                  borderRadius: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🛒 Go to Cart ({items.length} items)
                <span style={{ color: c.secondary, fontWeight: 800 }}>
                  EGP {totalPrice}
                </span>
              </button>
            )}
          </div>

          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: c.background,
            borderRadius: '12px',
            border: `1px dashed ${c.border}`
          }}>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: c.textMuted
            }}>
              💡 <strong>Tip:</strong> You can change the coupon code in your cart if you have a better one!
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}