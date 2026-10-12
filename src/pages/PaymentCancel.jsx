// src/pages/PaymentCancel.jsx — ProActive Fashion design system refactor.
//
// Logic is unchanged: the cancelled-payment message still comes from the
// ?error query param with the same fallback, and the two handlers still go to
// /cart and /home. The hand-animated full-screen styles became
// StepHeader / .pa-receipt / .pa-callout / .pa-btn.

import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { Button, StepHeader, IconBag, IconClose, IconHome } from '../ui'

export default function PaymentCancel() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const errorMessage = searchParams.get('error') || 'Payment was cancelled'

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  return (
    <>
      <StepHeader
        title={L('paymentCancelled', 'Payment Cancelled', 'تم إلغاء الدفع')}
        step={3}
        of={3}
        backHref="/cart"
      />

      <div className="pa-receipt" style={{ maxWidth: 560, marginInline: 'auto', width: '100%', alignItems: 'center', textAlign: 'center' }}>
        <div className="pa-callout pa-callout--error" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <IconClose width={26} height={26} />
          <b>{L('paymentCancelled', 'Payment Cancelled', 'تم إلغاء الدفع')}</b>
          <p className="pa-subtitle" style={{ margin: 0 }}>{errorMessage}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button onClick={() => navigate('/cart')}>
              <IconBag width={18} height={18} /> {L('tryAgain', 'Try Again', 'جرب تاني')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/home')}>
              <IconHome width={18} height={18} /> {L('returnHome', 'Return Home', 'رجوع للرئيسية')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
