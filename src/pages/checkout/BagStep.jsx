// Bag — step 1 of checkout.
//
// The bag is the last place a shopper can catch a mistake before money is
// involved, so it carries the free-shipping progress, the coupon, the summary
// and the per-line stock warnings. A line that changed since it was added is
// marked here rather than failing at the API.

import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import {
  BagLine, Button, EmptyState, FreeShippingBar, Summary, formatEGP, loc
} from '../../ui'
import { getFreeShippingThreshold } from '../../services/settings'
import { checkoutRejectionMessage } from '../../utils/checkoutMessages'
import CouponBox from './CouponBox'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function BagStep({ checkout, coupon }) {
  const { t, lang } = useLanguage()
  const L = label(t, lang)
  const [threshold, setThreshold] = useState(800)

  const {
    items, totalPrice, shipping, effectiveMinimum, invalidLines, belowMinimum,
    ordersOpen, updateQuantity, removeFromCart, productDetails, stockErrors,
    setStep, error, dismissError
  } = checkout

  useEffect(() => {
    getFreeShippingThreshold().then(setThreshold).catch(() => {})
  }, [])

  if (items.length === 0) {
    return (
      <EmptyState
        title={L('bagEmpty', 'Your bag is empty', 'العربية فاضية')}
        body={L('bagEmptyBody', 'Find something you like and it will show up here.', 'اختار حاجة تعجبك وهتظهر هنا.')}
        actionLabel={L('startShopping', 'Start shopping', 'ابدأ التسوّق')}
        to="/shop"
        as={Link}
      />
    )
  }

  const total = totalPrice + (shipping?.cost ?? 0)

  return (
    <div className="pa-checkout">
      {error && (
        <div className="pa-callout pa-callout--error" role="alert" style={{ margin: '0 var(--pa-gutter) 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b>{L('orderNotCompleted', 'Order not placed', 'لم يتم إتمام الطلب')}</b>
            <span>{L(`checkout_${error.key}`, checkoutRejectionMessage(error.key, lang))}</span>
            <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={dismissError}
              style={{ alignSelf: 'flex-start' }}>
              {L('dismiss', 'Dismiss', 'تم')}
            </button>
          </div>
        </div>
      )}

      {!ordersOpen && (
        <div className="pa-callout" style={{ margin: '0 var(--pa-gutter) 12px' }}>
          <b>{L('orderingPaused', 'Ordering is paused', 'الطلب متوقف مؤقتاً')}</b>{' '}
          <span className="pa-subtitle">{L('orderingPausedHint', 'The store is not taking orders right now.', 'نعتذر، الشراء متاح قريباً')}</span>
        </div>
      )}

      <FreeShippingBar
        subtotal={totalPrice}
        threshold={threshold}
        lang={lang}
        t={{
          remaining: (amount) => (
            <>
              {L('addMoreForFree', 'Add', 'ضيف')} <b><bdi>{formatEGP(amount, lang)}</bdi></b>{' '}
              {L('moreForFreeShipping', 'more for free shipping', 'كمان للشحن المجاني')}
            </>
          ),
          reached: L('freeShippingReached', 'You get free shipping', 'الشحن مجاني')
        }}
      />

      {belowMinimum && (
        <div className="pa-callout" style={{ margin: '12px var(--pa-gutter) 0' }}>
          <b>{L('minimumOrder', 'Minimum order', 'الحد الأدنى للطلب')}</b>{' '}
          <span>
            {L('minimumFor', 'The minimum for this governorate is', 'الحد الأدنى للمحافظة دي')}{' '}
            <bdi>{formatEGP(effectiveMinimum, lang)}</bdi> — {L('addMoreToProceed', 'add', 'ضيف')}{' '}
            <bdi>{formatEGP(effectiveMinimum - totalPrice, lang)}</bdi>.
          </span>
        </div>
      )}

      <div>
        {items.map((line) => {
          const detail = productDetails[line.id]
          const stockError = stockErrors[line.id]
          const stock = stockError
            ? Number(stockError.available ?? 0)
            : Number(detail?.stock ?? line.stock ?? 0)

          return (
            <BagLine
              key={line.id}
              line={{
                ...line,
                qty: line.quantity,
                unitPrice: line.price,
                stock,
                title: detail?.title ?? line.title,
                colorName: loc(line.colorName ?? line.color, lang),
                image: detail?.images?.[0]?.url ?? line.image
              }}
              lang={lang}
              onQty={(n) => updateQuantity(line.id, n)}
              onRemove={() => removeFromCart(line.id)}
              issue={stockError?.message}
            >
              {/* The only useful action on a broken line is to change it, which
                  means going back to the product. */}
              <Link className="pa-btn pa-btn--outline pa-btn--sm" to={`/product/${line.productId}`}>
                {L('changeSize', 'Choose another size', 'اختار مقاس تاني')}
              </Link>
            </BagLine>
          )
        })}
      </div>

      <CouponBox coupon={coupon} lang={lang} L={L} />

      <Summary
        rows={[
          { label: L('subtotal', 'Subtotal', 'الإجمالي الفرعي'), value: formatEGP(totalPrice, lang) },
          coupon.discount > 0 && {
            label: L('coupon', 'Coupon', 'كود الخصم'),
            tone: 'discount',
            value: `-${formatEGP(coupon.discount, lang)}`
          },
          {
            label: L('shippingTo', 'Shipping', 'الشحن'),
            value: shipping?.available ? formatEGP(shipping.cost, lang) : L('chooseGovernorate', 'choose a governorate', 'اختار محافظة')
          },
          { label: L('total', 'Total', 'الإجمالي'), value: formatEGP(total, lang), tone: 'total' }
        ].filter(Boolean)}
      />

      <div className="pa-checkout__foot">
        <Link className="pa-btn pa-btn--outline" to="/shop">{L('keepShopping', 'Keep shopping', 'كمل تسوّق')}</Link>
        <Button size="lg" block disabled={invalidLines.length > 0} onClick={() => setStep(2)}>
          {invalidLines.length > 0
            ? L('fixNItems', `Fix ${invalidLines.length} item to continue`, `ظبط ${invalidLines.length} منتج عشان تكمل`)
            : L('continue', 'Continue', 'كمل')}
        </Button>
      </div>
    </div>
  )
}
