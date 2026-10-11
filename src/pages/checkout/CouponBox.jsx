// Coupon box, shared by the bag step.
//
// The apply flow lives in hooks/useCoupon.js; this is only the control and its
// states, so the delivery and review steps can show the applied discount
// without re-implementing anything.

import { formatEGP } from '../../ui'

export default function CouponBox({ coupon, lang, L }) {
  const { coupon: applied, input, setInput, loading, error, apply, remove, discount } = coupon

  if (applied) {
    return (
      <div className="pa-block">
        <div className="pa-group-title">{L('coupon', 'Coupon', 'كود الخصم')}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span className="pa-ok">
            <bdi className="pa-ltr">{applied.code}</bdi>
            {' — '}
            {applied.type === 'percent'
              ? `${applied.value}% ${L('off', 'off', 'خصم')}`
              : `${formatEGP(applied.amount ?? applied.value, lang)} ${L('off', 'off', 'خصم')}`}
            {discount > 0 && ` (−${formatEGP(discount, lang)})`}
          </span>
          <button type="button" className="pa-btn pa-btn--sm pa-btn--outline" onClick={remove}>
            {L('remove', 'Remove', 'إزالة')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pa-block">
      <div className="pa-group-title">{L('haveCoupon', 'Have a coupon code?', 'عندك كود خصم؟')}</div>
      <form
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
        onSubmit={(e) => { e.preventDefault(); apply() }}
      >
        <div className="pa-field" style={{ flex: '1 1 200px' }}>
          <label className="pa-label" htmlFor="coupon">{L('couponCode', 'Coupon code', 'كود الخصم')}</label>
          <input
            id="coupon"
            className="pa-input pa-ltr"
            value={input ?? ''}
            onChange={(e) => setInput(e.target.value)}
            placeholder="PA-XXXXXX"
            autoComplete="off"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'coupon-msg' : undefined}
          />
        </div>
        <button type="submit" className="pa-btn pa-btn--outline pa-btn--compact" disabled={loading || !input?.trim()}>
          {loading ? L('checking', 'Checking…', 'جاري التحقق…') : L('apply', 'Apply', 'تطبيق')}
        </button>
      </form>
      {error && (
        <div id="coupon-msg" className="pa-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
