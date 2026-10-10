// src/pages/PaymentSuccess.jsx — ProActive Fashion design system refactor.
//
// Logic is unchanged: the payment-verification effect still writes the
// order + mobile order in one batch, reads the order back, clears the cart and
// drops the sessionStorage handoff keys. Only the markup changed — the
// hand-animated full-screen styles became StepHeader / .pa-receipt /
// .pa-callout / Summary / .pa-btn, and money goes through the design system's
// formatEGP instead of a local `toFixed(2) EGP` helper. (The previous file
// also carried a broken template literal in an inline style; it is gone with
// the inline styles.)

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { db } from '../services/firebase'
import { COLLECTIONS } from '../config'
import { doc, getDoc, writeBatch } from 'firebase/firestore'
import { Button, StepHeader, Summary, formatEGP } from '../ui'

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
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

        if (!pendingOrderId || !pendingFirestoreId) {
          setError('No pending order found')
          setLoading(false)
          return
        }

        const orderCollection = 'orders_egp'

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
          const mobileOrderRef = doc(db, COLLECTIONS.mobileOrders, pendingOrderId)
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

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  if (loading) {
    return (
      <div className="pa-container" style={{ paddingBlock: 64, minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--pa-line)', borderTopColor: 'var(--pa-ink)', animation: 'pa-spin 1s linear infinite' }} />
          <p className="pa-subtitle" role="status">{L(null, 'Verifying payment...', 'جاري التحقق من الدفع...')}</p>
        </div>
        <style>{`@keyframes pa-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <>
        <StepHeader
          title={L('paymentVerificationFailed', 'Payment Verification Failed', 'فشل التحقق من الدفع')}
          step={3}
          of={3}
          backHref="/cart"
        />
        <div className="pa-receipt" style={{ maxWidth: 560, marginInline: 'auto', width: '100%', alignItems: 'center', textAlign: 'center' }}>
          <div className="pa-callout pa-callout--error" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <b aria-hidden="true" style={{ fontSize: 26 }}>✕</b>
            <b>{error}</b>
            <Button onClick={() => navigate('/cart')}>
              {L('returnToCart', 'Return to Cart', 'رجوع للعربية')}
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <StepHeader
        title={L('paymentSuccessful', 'Payment Successful!', 'تم الدفع بنجاح!')}
        step={3}
        of={3}
        backHref="/home"
      />

      <div className="pa-receipt" style={{ maxWidth: 560, marginInline: 'auto', width: '100%' }}>
        <div className="pa-callout pa-ok" role="status" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <b aria-hidden="true" style={{ fontSize: 22 }}>🎉</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b>{L('paymentSuccessful', 'Payment Successful!', 'تم الدفع بنجاح!')}</b>
            <span className="pa-subtitle">
              {L('thankYouPurchase', 'Thank you for your purchase. Your order has been confirmed.', 'شكراً لشرائك. تم تأكيد طلبك.')}
            </span>
          </div>
        </div>

        <Summary
          rows={[
            { label: L('orderId', 'Order ID', 'رقم الطلب'), value: orderData?.orderId },
            ...(paymentRef
              ? [{ label: L('paymentRef', 'Payment Ref', 'مرجع الدفع'), value: paymentRef }]
              : []),
            { label: L('totalPaid', 'Total Paid', 'إجمالي المدفوع'), value: formatEGP(orderData?.totalPrice ?? 0), tone: 'total' }
          ]}
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button onClick={() => navigate('/home')}>
            🛍️ {L('continueShopping', 'Continue Shopping', 'كمل تسوق')}
          </Button>
        </div>
      </div>
    </>
  )
}
