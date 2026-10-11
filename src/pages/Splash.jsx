// Splash — the brand screen between the country gate and the store.
//
// Short by design: it exists to cover the first paint, not to be looked at.
// It waits at most about a second and skips instantly when the catalogue is
// already cached locally, so a returning shopper never sees it twice.
//
// The surface is the design system's .pa-hero pinned to the ink token — a
// permanent dark brand screen, so it does not follow the light/dark switch.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { loadCachedSnapshot } from '../services/snapshotStore'

const MAX_MS = 1000

export default function Splash() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { getImage } = useTheme()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  useEffect(() => {
    let cancelled = false

    // A cached catalogue means the store is already warm: skip the reveal.
    const timer = setTimeout(() => {
      if (!cancelled) navigate('/home', { replace: true })
    }, MAX_MS)

    loadCachedSnapshot()
      .then((snap) => {
        if (!cancelled && snap?.products?.length) {
          clearTimeout(timer)
          navigate('/home', { replace: true })
        }
      })
      .catch(() => {})

    return () => { cancelled = true; clearTimeout(timer) }
  }, [navigate])

  return (
    <section className="pa-hero" style={{
      minHeight: '100vh', justifyContent: 'center', alignItems: 'center',
      textAlign: 'center', gap: 20, background: 'var(--pa-ink)', color: 'var(--pa-paper)'
    }}>
      <img
        src={getImage('logo')}
        alt="ProActive Store"
        style={{ height: 'clamp(110px, 22vh, 200px)', width: 'auto', maxWidth: '80vw', objectFit: 'contain' }}
      />
      <p className="pa-hero__eyebrow" style={{ margin: 0, letterSpacing: 'normal' }}>
        {L('styleDelivered', 'Style, delivered to your door', 'ستايلات مختارة بعناية، بتوصل لبابك.')}
      </p>
      {/* The progress bar from the board: 120x3, white on the ink surface. */}
      <div style={{ width: 120, height: 3, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }} aria-hidden="true">
        <div style={{ height: '100%', width: '40%', background: 'var(--pa-paper)' }} />
      </div>
      <p className="pa-hero__eyebrow" style={{ margin: 0, fontSize: 12 }}>
        {L('loadingLatest', 'Loading the latest styles', 'جاري تحميل أحدث الستايلات')}
      </p>
    </section>
  )
}
