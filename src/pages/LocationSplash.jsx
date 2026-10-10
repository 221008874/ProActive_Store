// src/pages/LocationSplash.jsx — ProActive Fashion design system refactor.
//
// Logic is unchanged: the same auto-start timer, the same requestLocation flow
// (success and error both forward to /splash with the detected country and
// currency), the same status machine and the same always-available skip
// handler. The full-screen layout is kept, but the surface is now the design
// system's .pa-hero pinned to the ink token — a permanent dark brand screen, so
// it does not follow the light/dark switch — and the skip control is a .pa-btn.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '../context/LocationContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

export default function LocationSplash() {
  const navigate = useNavigate()
  const { requestLocation, setLoading, country } = useLocation()
  const { t, lang } = useLanguage()
  const { getImage } = useTheme()
  const [status, setStatus] = useState('initial') // 'initial', 'requesting', 'detecting', 'complete', 'error'
  const [error, setError] = useState(null)

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  useEffect(() => {
    // Start location detection automatically after brief delay
    const timer = setTimeout(() => {
      handleLocationRequest()
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  const handleLocationRequest = async () => {
    setStatus('requesting')

    try {
      const result = await requestLocation()
      setStatus('complete')

      // Navigate to main splash after brief delay to show success
      setTimeout(() => {
        navigate('/splash', {
          state: {
            detectedCountry: result.country,
            detectedCurrency: result.currency
          }
        })
      }, 1000)
    } catch (err) {
      console.error('Location detection failed:', err)
      setError('Unable to detect location. Using default settings.')
      setStatus('error')

      // Navigate anyway after delay
      setTimeout(() => {
        navigate('/splash', {
          state: {
            detectedCountry: 'Egypt',
            detectedCurrency: 'EGP'
          }
        })
      }, 2000)
    }
  }

  const handleManualSkip = () => {
    navigate('/splash', {
      state: {
        detectedCountry: 'Egypt',
        detectedCurrency: 'EGP'
      }
    })
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'initial':
        return L('preparingExperience', 'Preparing your experience...', 'بنحضّر تجربتك...')
      case 'requesting':
        return L('requestingLocationAccess', 'Requesting location access...', 'بنطلب صلاحية الوصول للموقع...')
      case 'detecting':
        return L('detectingYourLocation', `Detecting your location in ${country}...`, `بنعرف موقعك في ${country}...`)
      case 'complete':
        return L('welcomeCurrencySet', 'Welcome! Currency set to Egyptian Pound', 'أهلاً بيك! تم ضبط العملة على الجنيه المصري')
      case 'error':
        return error || L('locationDetectionFailed', 'Location detection failed', 'معرفناش موقعك')
      default:
        return L('loading', 'Loading...', 'جاري التحميل...')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'initial':
        return '🌍'
      case 'requesting':
        return '📍'
      case 'detecting':
        return '🗺️'
      case 'complete':
        return '🇪🇬'
      case 'error':
        return '⚠️'
      default:
        return '⏳'
    }
  }

  const progress = status === 'initial' ? '20%'
    : status === 'requesting' ? '50%'
    : status === 'detecting' ? '80%'
    : '100%'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <section
        className="pa-hero"
        style={{
          flex: '1 1 auto',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          gap: 20,
          background: 'var(--pa-ink)',
          color: 'var(--pa-paper)'
        }}
      >
        <img
          src={getImage('logo')}
          alt="ProActive Store Logo"
          style={{ height: 'clamp(120px, 25vh, 200px)', width: 'auto', maxWidth: '80vw', objectFit: 'contain' }}
        />

        <div aria-hidden="true" style={{ fontSize: 'clamp(2.5rem, 10vw, 4rem)' }}>
          {getStatusIcon()}
        </div>

        <h1 className="pa-hero__title" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)' }}>
          {getStatusMessage()}
        </h1>

        {status === 'requesting' && (
          <p className="pa-hero__eyebrow" style={{ margin: 0, letterSpacing: 'normal' }}>
            {L('allowLocationAccess', 'Please allow location access when prompted', 'اسمح بالوصول للموقع لما يطلب منك')}
          </p>
        )}

        {status === 'complete' && (
          <p className="pa-hero__eyebrow" style={{ margin: 0, letterSpacing: 'normal' }}>
            {L('redirectingToStore', 'Redirecting to store...', 'بنحوّلك للمتجر...')}
          </p>
        )}

        <div
          aria-hidden="true"
          style={{ width: 'clamp(200px, 60vw, 300px)', height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2, overflow: 'hidden' }}
        >
          <div style={{ height: '100%', width: progress, background: 'var(--pa-paper)', transition: 'width .5s ease' }} />
        </div>

        <button type="button" className="pa-btn pa-btn--outline" onClick={handleManualSkip}>
          {L('skipDetection', 'Skip Detection', 'تخطّي الكشف')} →
        </button>
      </section>
    </div>
  )
}
