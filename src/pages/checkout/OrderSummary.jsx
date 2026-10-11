// Sticky order summary for checkout.
//
// The same numbers every step computes, always visible on desktop so a shopper
// never has to scroll back to see what they are about to pay. On a phone it
// collapses into a thin bar that the step content scrolls under.

import { formatEGP } from '../../ui'

export default function OrderSummary({ checkout, coupon, L, lang }) {
  const { totalPrice, shipping, effectiveMinimum, belowMinimum, invalidLines, ordersOpen } = checkout
  const total = totalPrice + (shipping?.cost ?? 0)

  return (
    <div className="pa-summary-card">
      <div className="pa-group-title">{L('orderSummary', 'Order summary', 'ملخص الطلب')}</div>

      <div className="pa-summary__row">
        <span>{L('subtotal', 'Subtotal', 'الإجمالي الفرعي')}</span>
        <bdi>{formatEGP(totalPrice, lang)}</bdi>
      </div>

      {coupon.discount > 0 && (
        <div className="pa-summary__row">
          <span>{L('coupon', 'Coupon', 'كود الخصم')}</span>
          <bdi style={{ color: 'var(--pa-instock)' }}>-{formatEGP(coupon.discount, lang)}</bdi>
        </div>
      )}

      <div className="pa-summary__row">
        <span>{L('shipping', 'Shipping', 'الشحن')}</span>
        <bdi>{shipping?.available ? formatEGP(shipping.cost, lang) : L('chooseGovernorate', 'choose a governorate', 'اختار محافظة')}</bdi>
      </div>

      <div className="pa-summary__row pa-summary__row--total">
        <span>{L('total', 'Total', 'الإجمالي')}</span>
        <bdi>{formatEGP(total, lang)}</bdi>
      </div>

      {/* Why the order cannot be placed yet, always visible rather than
          discovered by pressing a disabled button. */}
      {invalidLines.length > 0 && (
        <div className="pa-error" style={{ marginTop: 10 }}>
          {L('fixNItems', `Fix ${invalidLines.length} item to continue`, `ظبط ${invalidLines.length} منتج عشان تكمل`)}
        </div>
      )}
      {belowMinimum && (
        <div className="pa-error" style={{ marginTop: 10 }}>
          {L('belowMinimumShort', `Minimum ${effectiveMinimum} EGP`, `الحد الأدنى ${effectiveMinimum} جنيه`)}
        </div>
      )}
      {!ordersOpen && (
        <div className="pa-error" style={{ marginTop: 10 }}>
          {L('orderingPausedShort', 'Ordering is paused', 'الطلب متوقف')}
        </div>
      )}
    </div>
  )
}
