// Cart and checkout.
//
// Three steps on a phone, shown as three screens with a progress bar under the
// header; on desktop the same three steps become accordion panels beside a
// sticky order summary. The state (cart, address, governorates, coupon, the
// API call) lives in useCheckout and useCoupon, so the steps only render it and
// step 3 shows the same numbers step 1 computed.
//
// Money and stock are never decided here: /api/placeOrder validates prices,
// stock and the coupon against the database in one transaction, so a page left
// open for an hour still pays the price that exists when it submits.

import { useLanguage } from '../context/LanguageContext'
import { useCheckout } from '../hooks/useCheckout'
import { useCoupon } from '../hooks/useCoupon'
import { StepHeader } from '../ui'
import BagStep from './checkout/BagStep'
import DeliveryStep from './checkout/DeliveryStep'
import ReviewStep from './checkout/ReviewStep'
import OrderSummary from './checkout/OrderSummary'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

const STEP_TITLES = {
  1: ['Your bag', 'العربية'],
  2: ['Delivery', 'التوصيل'],
  3: ['Review and order', 'المراجعة والطلب']
}

export default function CartPage() {
  const { t, lang } = useLanguage()
  const L = label(t, lang)

  const checkout = useCheckout()
  const coupon = useCoupon(checkout.totalPrice)

  const [title, titleAr] = STEP_TITLES[checkout.step] ?? STEP_TITLES[1]

  // One list drives both layouts, so the phone's three screens and the desktop's
  // three panels are the same steps in the same order by construction.
  const steps = [
    { key: 1, label: L('stepBag', 'Bag', 'العربية'), Component: BagStep },
    { key: 2, label: L('stepDelivery', 'Delivery', 'التوصيل'), Component: DeliveryStep },
    { key: 3, label: L('stepReview', 'Review', 'المراجعة'), Component: ReviewStep }
  ]

  const goBack = () => {
    if (checkout.step === 1) { window.history.back(); return }
    checkout.setStep(checkout.step - 1)
  }

  return (
    <>
      <StepHeader title={lang === 'ar' ? titleAr : title} step={checkout.step} onBack={goBack} />

      <div className="pa-steps" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.key} data-done={checkout.step >= s.key} />
        ))}
      </div>

      <div className="pa-checkout-layout">
        {/* Phone and tablet: the current step, full width. */}
        <div className="pa-checkout__mobile">
          {steps[checkout.step - 1] && <CurrentStep step={steps[checkout.step - 1]} checkout={checkout} coupon={coupon} />}
        </div>

        {/* Laptop and desktop: the steps as panels, all reachable. */}
        <div className="pa-checkout__steps">
          {steps.map((step) => {
            const isCurrent = checkout.step === step.key
            const isDone = checkout.step > step.key
            return (
              <section
                key={step.key}
                className="pa-checkout__panel"
                data-state={isCurrent ? 'current' : isDone ? 'done' : 'todo'}
              >
                <button
                  type="button"
                  className="pa-checkout__panel-head"
                  aria-expanded={isCurrent}
                  onClick={() => checkout.setStep(step.key)}
                >
                  <span className="pa-checkout__panel-num">{step.key}</span>
                  <span>{step.label}</span>
                  {isDone && <span className="pa-ok">{L('done', 'Done', 'تم')}</span>}
                </button>
                <div className="pa-checkout__panel-body" hidden={!isCurrent}>
                  <CurrentStep step={step} checkout={checkout} coupon={coupon} />
                </div>
              </section>
            )
          })}
        </div>

        <aside className="pa-checkout__summary" aria-label={L('orderSummary', 'Order summary', 'ملخص الطلب')}>
          <OrderSummary checkout={checkout} coupon={coupon} L={L} lang={lang} />
        </aside>
      </div>
    </>
  )
}

/** The review step needs the coupon hook too, so the step components share one
 *  prop shape rather than each reaching for what it needs. */
function CurrentStep({ step, checkout, coupon }) {
  const { Component } = step
  return <Component checkout={checkout} coupon={coupon} />
}
