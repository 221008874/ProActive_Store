import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { db } from '../services/firebase'
import { doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore'

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { t } = useLanguage()
  const { clearCart } = useCart()
  
  const [loading, setLoading] = useState(true)
  const [orderData, setOrderData] = useState(null)
  const [error, setError] = useState(null)

  const paymentRef = searchParams.get('paymentRef')
  
  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const pendingOrderId = sessionStorage.getItem('pendingOrderId')
        const pendingFirestoreId = sessionStorage.getItem('pendingFirestoreId')
        const pendingMobileOrderId = sessionStorage.getItem('pendingMobileOrderId')
        const pendingCurrency = sessionStorage.getItem('pendingCurrency') || 'EGP'
        
        if (!pendingOrderId || !pendingFirestoreId) {
          setError('No pending order found')
          setLoading(false)
          return
        }

        const orderCollection = pendingCurrency === 'USD' ? 'orders_usd' : 'orders_egp'
        
        const batch = writeBatch(db)
        
        const orderRef = doc(db, orderCollection, pendingFirestoreId)
        batch.update(orderRef, {
          paymentStatus: 'paid',
          paymentRef: paymentRef,
          paidAt: new Date().toISOString(),
          status: 'confirmed',
          updatedAt: new Date().toISOString()
        })

        if (pendingMobileOrderId) {
          const mobileOrderRef = doc(db, 'mobile_orders', pendingOrderId)
          batch.update(mobileOrderRef, {
            paymentStatus: 'paid',
            status: 'confirmed',
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }

        await batch.commit()

        const orderSnap = await getDoc(orderRef)
        if (orderSnap.exists()) {
          setOrderData(orderSnap.data())
        }

        clearCart()
        sessionStorage.removeItem('pendingOrderId')
        sessionStorage.removeItem('pendingFirestoreId')
        sessionStorage.removeItem('pendingMobileOrderId')
        sessionStorage.removeItem('pendingCurrency')

        setLoading(false)
      } catch (err) {
        console.error('Payment verification error:', err)
        setError('Failed to verify payment: ' + err.message)
        setLoading(false)
      }
    }

    verifyPayment()
  }, [paymentRef, clearCart])

  const colors = {
    light: {
      primary: '#3E2723', secondary: '#D4A017', background: '#F8F4F0',
      card: '#FCFAF8', textDark: '#2E1B1B', textLight: '#6B5E57',
      success: '#8BC34A', border: '#E8DDD4'
    },
    dark: {
      primary: '#2E1B1B', secondary: '#D4A017', background: '#1A1412',
      card: '#2E1B1B', textDark: '#F8F4F0', textLight: '#C4B5AD',
      success: '#8BC34A', border: '#3E2723'
    }
  }

  const c = theme === 'light' ? colors.light : colors.dark

  const formatPrice = (price, currency) => {
    if (currency === 'USD') return `$${price?.toFixed(2)}`
    return `${price?.toFixed(2)} EGP`
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: c.background, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px'
      }}>
        <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>⏳</div>
        <p style={{ color: c.textLight }}>Verifying payment...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', background: c.background, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', textAlign: 'center'
      }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>❌</div>
        <h1 style={{ color: c.textDark, marginBottom: '1rem' }}>Payment Verification Failed</h1>
        <p style={{ color: c.textLight, marginBottom: '2rem' }}>{error}</p>
        <button onClick={() => navigate('/cart')} style={{ padding: '12px 24px', background: c.secondary, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Return to Cart
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: c.background, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', textAlign: 'center'
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1.5rem', animation: 'bounce 2s infinite' }}>🎉</div>
      
      <h1 style={{ fontSize: '2.5rem', color: c.success, marginBottom: '1rem', fontWeight: '700' }}>
        Payment Successful!
      </h1>
      
      <p style={{ fontSize: '1.2rem', color: c.textLight, marginBottom: '2rem' }}>
        Thank you for your purchase. Your order has been confirmed.
      </p>
      
      <div style={{
        background: c.card, borderRadius: '16px', padding: '2rem',
        maxWidth: '500px', width: '100%', border: `2px solid ${c.border}`, marginBottom: '2rem'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ color: c.textLight }}>Order ID: </span>
          <strong style={{ color: c.textDark, fontFamily: 'monospace' }}>
            {orderData?.orderId}
          </strong>
        </div>
        
        {paymentRef && (
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ color: c.textLight }}>Payment Ref: </span>
            <strong style={{ color: c.textDark, fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {paymentRef}
            </strong>
          </div>
        )}
        
        <div style={{ padding: '1rem', background: c.background, borderRadius: '8px', marginTop: '1rem' }}>
          <span style={{ color: c.textLight }}>Total Paid: </span>
          <strong style={{ color: c.secondary, fontSize: '1.5rem' }}>
            {formatPrice(orderData?.totalPrice, orderData?.currency)}
          </strong>
        </div>
      </div>
      
      <button onClick={() => navigate('/home')} style={{
        padding: '14px 32px', background: `linear-gradient(135deg, ${c.secondary} 0%, #B8860B 100%)`,
        color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700',
        fontSize: '1.1rem', cursor: 'pointer', transition: 'transform 0.3s ease',
        boxShadow: '0 4px 12px rgba(212, 160, 23, 0.3)'
      }}>
        🛍️ Continue Shopping
      </button>
      
      <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }`}</style>
    </div>
  )
}