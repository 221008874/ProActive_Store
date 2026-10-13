// Review and order — step 3 of checkout.
//
// The last screen before money is committed, so it shows the one payment option
// (cash on delivery), the address with a way back to it, the exact items, the
// totals, and the amount the courier will ask for in the largest type on the
// page. The terms checkbox is required and honest: it is the only place the
// shopper agrees to the store's terms.

import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { Button, Checkbox, formatEGP, loc, thumb } from '../../ui'
import { checkoutRejectionMessage } from '../../utils/checkoutMessages'
import CouponBox from './CouponBox'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function ReviewStep({ checkout, coupon }) {
  const { t, lang } = useLanguage()
  const L = label(t, lang)
  const [agreed, setAgreed] = useState(false)

  const {
    items, totals, address, governorateDocs, setStep,
    placeOrder, processing, error, ordersOpen, effectiveMinimum, belowMinimum
  } = checkout

  const total = totals.total
  const gov = governorateDocs[address.governorate]
  const govName = gov?.name ? loc(gov.name, lang) : address.governorate

  const blockedReason = !ordersOpen
    ? L('orderingPaused', 'Ordering is paused', 'الطلب متوقف مؤقتاً')
    : belowMinimum
      ? `${L('belowMinimum', 'Below the minimum for this governorate', 'أقل من الحد الأدنى للمحافظة دي')} (${formatEGP(effectiveMinimum, lang)})`
      : !agreed
        ? L('acceptTerms', 'Accept the terms to continue', 'وافق على الشروط عشان تكمل')
        : null

  return (
    <div className="pa-checkout">
      {/* Payment: the single option, selected and unchangeable. Cash on delivery
          is the only method this store runs, so there is no picker to build. */}
      <fieldset className="pa-checkout__section" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="pa-group-title">{L('payment', 'Payment', 'الدفع')}</legend>
        <div className="pa-radio-card" aria-checked="true" role="radio" style={{ cursor: 'default' }}>
          <input type="radio" name="payment" value="cod" checked readOnly aria-label={L('cod', 'Cash on delivery', 'الدفع عند الاستلام')} />
          <span>
            <b>{L('codTitle', 'Cash on delivery', 'الدفع عند الاستلام')}</b>
            <span>{L('codBody', 'Pay the courier when your order arrives.', 'ادفع للمندوب لما يوصل طلبك.')}</span>
          </span>
        </div>
      </fieldset>

      <div className="pa-checkout__section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <div className="pa-group-title">{L('deliverTo', 'Deliver to', 'التوصيل إلى')}</div>
          <button type="button" className="pa-btn pa-btn--sm pa-btn--outline" onClick={() => setStep(2)}>
            {L('edit', 'Edit', 'تعديل')}
          </button>
        </div>
        <address style={{ fontStyle: 'normal', fontSize: 14, lineHeight: 1.5 }}>
          <b>{address.name}</b> · <span className="pa-ltr">{address.phone}</span>
          <br />
          {address.address}
          {address.building && `, ${address.building}`}
          {address.city && `, ${address.city}`}
          <br />
          {govName}
          {address.latitude && address.longitude && (
            <>
              {' · '}
              <a
                href={`https://maps.google.com/?q=${address.latitude},${address.longitude}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                {L('viewOnMap', 'View on map', 'عرض على الخريطة')}
              </a>
            </>
          )}
          {address.notes && (
            <>
              <br />
              <span className="pa-subtitle">{address.notes}</span>
            </>
          )}
        </address>
      </div>

      <div className="pa-checkout__section">
        <div className="pa-group-title">{L('items', 'Items', 'المنتجات')}</div>
        <div>
          {items.map((line) => (
            <div key={line.id} className="pa-line" style={{ paddingInline: 0 }}>
              <div className="pa-line__img" style={{
                flex: '0 0 48px', height: 64,
                backgroundImage: line.image ? `url(${thumb(line.image, 120)})` : undefined
              }} />
              <div className="pa-line__body">
                <div className="pa-line__title" style={{ fontSize: 14 }}>
                  <span>{loc(line.title, lang)}</span>
                  <span className="pa-subtitle">×{line.quantity}</span>
                </div>
                <div className="pa-line__meta">
                  {[loc(line.colorName ?? line.color, lang), line.size].filter(Boolean).join(' · ')}
                </div>
                <bdi>{formatEGP((line.price ?? 0) * line.quantity, lang)}</bdi>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!coupon.coupon && <CouponBox coupon={coupon} lang={lang} L={L} />}

      <div className="pa-callout" style={{ margin: '0 var(--pa-gutter)', textAlign: 'center' }}>
        <div className="pa-subtitle">{L('collectOnDelivery', 'Pay the courier', 'ادفع للمندوب')}</div>
        <div className="pa-cod-amount">{formatEGP(total, lang)}</div>
      </div>

      <Checkbox
        id="r-terms"
        label={L('acceptTermsOf', 'I accept the terms of service', 'أوافق على شروط الخدمة')}
        checked={agreed}
        onChange={setAgreed}
      />

      {error && (
        <div className="pa-callout pa-callout--error" role="alert" style={{ margin: '0 var(--pa-gutter)' }}>
          {/* No `checkout_*` key exists in the dictionary, so falling back to the
              key alone printed `outOfStock` / `rateLimited` to the shopper. The
              message table is the real copy, in both languages. */}
          {L(`checkout_${error.key}`, checkoutRejectionMessage(error.key, lang))}
        </div>
      )}

      <div className="pa-checkout__foot">
        <Button type="button" variant="outline" onClick={() => setStep(2)}>{L('back', 'Back', 'رجوع')}</Button>
        <Button
          size="lg"
          block
          onClick={placeOrder}
          disabled={processing || !!blockedReason}
          aria-disabled={processing || !!blockedReason}
        >
          {processing
            ? L('placing', 'Placing order…', 'جاري إرسال الطلب…')
            : `${L('placeOrder', 'Place order', 'إتمام الطلب')} · ${formatEGP(total, lang)}`}
        </Button>
      </div>
      {blockedReason && <p className="pa-error" style={{ textAlign: 'center', margin: '0 var(--pa-gutter)' }}>{blockedReason}</p>}
    </div>
  )
}
