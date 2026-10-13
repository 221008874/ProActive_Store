// Sticky order summary for checkout.
//
// The same numbers every step computes, always visible on desktop so a shopper
// never has to scroll back to see what they are about to pay. On a phone it
// collapses into a thin bar that the step content scrolls under.

import { formatEGP } from '../../ui'

export default function OrderSummary({ checkout, coupon, L, lang }) {
  const { totals, shipping, effectiveMinimum, belowMinimum, invalidLines, ordersOpen } = checkout
  // The same breakdown the server computes (useCheckout.totals): the coupon
  // comes off the subtotal and shipping is charged only on what is left, so
  // this card cannot quote a total the order will not be created with.
  const total = totals.total

  return (
    <div className="pa-summary-card">
      <div className="pa-group-title">{L('orderSummary', 'Order summary', 'ملخص الطلب')}</div>

      <div className="pa-summary__row">
        <span>{L('subtotal', 'Subtotal', 'الإجمالي الفرعي')}</span>
        <bdi>{formatEGP(totals.subtotal, lang)}</bdi>
      </div>

      {coupon.discount > 0 && (
        <div className="pa-summary__row">
          <span>{L('coupon', 'Coupon', 'كود الخصم')}</span>
          <bdi style={{ color: 'var(--pa-instock)' }}>-{formatEGP(coupon.discount, lang)}</bdi>
        </div>
      )}

<div className="pa-summary__row">
        <span>{L('shipping', 'Shipping', 'الشحن')}</span>
        <bdi>
          {!shipping?.available
            ? L('chooseGovernorate', 'choose a governorate', 'اختر المحافظة')
            // Free above the threshold, which the server also decides on the
            // discounted subtotal.
            : totals.shippingCost === 0 && shipping.cost > 0
              ? L('free')
              : formatEGP(totals.shippingCost, lang)}
        </bdi>
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
