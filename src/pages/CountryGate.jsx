// Country gate — the entry screen.
//
// One question, then straight in. Egypt is selected because the store sells in
// EGP with cash on delivery and ships to the 27 governorates; every other
// country is shown as unavailable rather than hidden, so a visitor from abroad
// is told the truth instead of being left to wonder.
//
// Detection is a non-blocking courtesy: ipapi.co is consulted once to preselect
// the right card, and it is never waited on. No geolocation permission is
// requested here — that belongs to the delivery address, which is the first
// moment it actually matters.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { Button, RadioCard } from '../ui'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function CountryGate() {
  const { t, lang, toggleLanguage } = useLanguage()
  const navigate = useNavigate()
  const L = label(t, lang)

  const [choice, setChoice] = useState('eg')
  const [detected, setDetected] = useState(null)

  // Preselect from the IP, never block on it. A visitor who lands here from a
  // country the store does not serve still sees Egypt selected, because that is
  // the only place it can ship.
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.country_code) setDetected(String(data.country_code).toUpperCase()) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  const enter = () => navigate(choice === 'eg' ? '/home' : '/home')

  return (
    <main className="pa-gate">
      <header className="pa-gate__head">
        <span className="pa-logo">PROACTIVE</span>
        <button type="button" className="pa-footer__toggle" onClick={() => toggleLanguage()}>
          {lang === 'ar' ? 'English' : 'العربية'}
        </button>
      </header>

      <div className="pa-gate__body">
        <div className="pa-hero__eyebrow" style={{ color: 'var(--pa-muted)' }}>
          {L('welcome', 'Welcome', 'أهلاً بيك')}
        </div>
        <h1 className="pa-gate__title">
          {L('whereShopping', 'Where are you shopping from?', 'بتشتري منين؟')}
        </h1>

        <div className="pa-gate__options" role="radiogroup" aria-label={L('country', 'Country', 'الدولة')}>
          <RadioCard
            id="gate-eg"
            name="country"
            value="eg"
            checked={choice === 'eg'}
            onChange={setChoice}
            title={L('egypt', 'Egypt', 'مصر')}
            description={L('egyptSub', 'Prices in EGP · Cash on delivery', 'الأسعار بالجنيه · الدفع عند الاستلام')}
          />
          <RadioCard
            id="gate-other"
            name="country"
            value="other"
            checked={choice === 'other'}
            onChange={setChoice}
            title={L('otherCountries', 'Other countries', 'دول تانية')}
            description={L('otherCountriesSub', 'Not available yet', 'مش متاح لسه')}
            disabled
          />
        </div>

        {/* The detection result is stated rather than acted on: it is a hint,
            not a lock. */}
        {detected && detected !== 'EG' && (
          <p className="pa-gate__note">
            {L('detectedOutside', `We can only ship inside Egypt right now (detected: ${detected}).`,
              `بنوصل جوه مصر بس دلوقتي (تم التعرف على: ${detected}).`)}
          </p>
        )}
        {!detected && (
          <p className="pa-gate__note">
            {L('gateNote', 'You can change this later at checkout.', 'تقدر تغيّر ده بعدين عند الطلب.')}
          </p>
        )}

        <div className="pa-gate__foot">
          <Button size="lg" block onClick={enter}>
            {L('continue', 'Continue', 'كمل')}
          </Button>
          <Link className="pa-subtitle" to="/about" style={{ textAlign: 'center', display: 'block' }}>
            {L('learnMore', 'Learn more about ProActive', 'اعرف أكثر عن برو أكتيف')}
          </Link>
        </div>
      </div>
    </main>
  )
}
