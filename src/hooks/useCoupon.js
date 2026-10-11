// Coupon flow for checkout.
//
// The coupon document is never sent to the browser: /api/coupon/preview reads
// it with the Admin SDK and answers with only what the UI needs (valid? what
// discount?). That keeps `usedCount` and `maxUses` private, and means the
// preview is computed from the real document rather than a stale copy.

import { useCallback, useEffect, useState } from 'react'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../context/LanguageContext'
import { postJson } from '../services/api'
import { normalizeCouponCode } from '../utils/coupon'
import { COUPON_REJECTIONS, couponRejectionMessage } from '../utils/couponMessages'

export function useCoupon(subtotal) {
  const { t, lang } = useLanguage()
  const { appliedCoupon, setAppliedCoupon, clearAppliedCoupon } = useCart()

  const [input, setInput] = useState(appliedCoupon?.code ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // A code scanned from a coupon sheet lands here: the landing page stores it,
  // and the bag applies it with the same preview as a typed code.
  useEffect(() => {
    const prefill = sessionStorage.getItem('prefillCouponCode')
    const autoApply = sessionStorage.getItem('autoApplyCoupon')
    if (!prefill && !autoApply) return

    if (prefill) {
      setInput(prefill)
      sessionStorage.removeItem('prefillCouponCode')
    }

    let alive = true
    ;(async () => {
      if (!autoApply) return
      try {
        const code = JSON.parse(autoApply).code
        const { ok, error: why, coupon } = await preview(code, subtotal)
        if (!alive) return
        if (ok) {
          setAppliedCoupon(coupon)
          setInput(coupon.code)
        } else {
          setError(why)
        }
      } catch (e) {
        console.error('Error auto-applying scanned coupon:', e)
        if (alive) setError(t('couponError') || 'Error, please try again')
      } finally {
        sessionStorage.removeItem('autoApplyCoupon')
      }
    })()
    return () => { alive = false }
    // Runs once: the scanned code is in sessionStorage, and re-running on every
    // subtotal change would re-apply a coupon the shopper just removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preview = useCallback(async (rawCode, bagSubtotal) => {
    const code = normalizeCouponCode(rawCode).toUpperCase()
    if (!code) return { ok: false, error: t('invalidCoupon') || 'Invalid coupon' }

    const result = await postJson('/coupon/preview', { code, subtotal: bagSubtotal })
    if (result.valid !== true) {
      return {
        ok: false,
        error: couponRejectionMessage(result.reason, lang, t('invalidCoupon') || 'Invalid coupon')
      }
    }

    return {
      ok: true,
      coupon: {
        code: result.code,
        type: result.type,
        value: result.value,
        amount: result.discount,
        minOrder: result.minOrder ?? 0
      }
    }
  }, [lang, t])

  const apply = useCallback(async (rawCode) => {
    const code = rawCode ?? input
    if (!code.trim()) return { ok: false }

    setLoading(true)
    setError(null)
    try {
      const { ok, error: why, coupon } = await preview(code, subtotal)
      if (!ok) {
        setError(why)
        return { ok: false, error: why }
      }
      setAppliedCoupon(coupon)
      setInput(coupon.code)
      return { ok: true, coupon }
    } catch (e) {
      console.error('Coupon preview error:', e)
      const message = t('couponError') || 'Error, please try again'
      setError(message)
      return { ok: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [input, preview, subtotal, setAppliedCoupon, t])

  const remove = useCallback(() => {
    clearAppliedCoupon()
    setInput('')
    setError(null)
  }, [clearAppliedCoupon])

  // The discount the coupon is worth on THIS bag, so the summary and the
  // free-shipping bar agree.
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round((subtotal * Number(appliedCoupon.value)) / 100)
      : Number(appliedCoupon.amount ?? appliedCoupon.value ?? 0)
    : 0

  return {
    coupon: appliedCoupon, input, setInput, loading, error, setError,
    apply, remove, discount
  }
}
