// src/pages/PrivacyPolicy.jsx
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicy() {
  const { theme } = useTheme()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const colors = {
    light: {
      primary: '#3E2723',
      secondary: '#D4A017',
      background: '#F8F4F0',
      card: '#FCFAF8',
      textDark: '#2E1B1B',
      textLight: '#6B5E57',
      border: '#E8DDD4'
    },
    dark: {
      primary: '#2E1B1B',
      secondary: '#D4A017',
      background: '#1A1412',
      card: '#2E1B1B',
      textDark: '#F8F4F0',
      textLight: '#C4B5AD',
      border: '#3E2723'
    }
  }

  const c = theme === 'light' ? colors.light : colors.dark

  return (
    <div style={{
      minHeight: '100vh',
      background: c.background,
      color: c.textDark,
      fontFamily: 'Georgia, serif'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        background: c.card,
        boxShadow: theme === 'light' 
          ? '0 2px 8px rgba(62, 39, 35, 0.08)' 
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: `1px solid ${c.border}`
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '1.5rem', 
          fontWeight: '700',
          color: c.textDark,
          letterSpacing: '-0.5px'
        }}>
          {t('Louable')}
        </h1>
        
        <button
          onClick={() => navigate('/home')}
          style={{
            background: 'transparent',
            border: `2px solid ${c.primary}`,
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            color: c.primary,
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = c.primary
            e.currentTarget.style.color = theme === 'light' ? '#FFFFFF' : c.textDark
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = c.primary
          }}
        >
          ← {t('backToHome')}
        </button>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '900px',
        margin: '40px auto',
        padding: '0 24px'
      }}>
        <div style={{
          background: c.card,
          borderRadius: '16px',
          padding: '40px',
          border: `1px solid ${c.border}`,
          boxShadow: theme === 'light'
            ? '0 4px 20px rgba(62, 39, 35, 0.1)'
            : '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: c.textDark,
            marginBottom: '24px',
            textAlign: lang === 'ar' ? 'right' : 'left'
          }}>
            {t('privacyPolicy')}
          </h2>

          <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: c.textLight }}>
            <p style={{ marginBottom: '20px' }}>
              <strong>{t('lastUpdated')}:</strong> February 1, 2026
            </p>

            <h3 style={{ color: c.textDark, marginTop: '30px', marginBottom: '15px' }}>
              {t('informationWeCollect')}
            </h3>
            <p style={{ marginBottom: '20px' }}>
              {t('infoCollectionText')}
            </p>

            <h3 style={{ color: c.textDark, marginTop: '30px', marginBottom: '15px' }}>
              {t('howWeUseInfo')}
            </h3>
            <p style={{ marginBottom: '20px' }}>
              {t('useInfoText')}
            </p>

            <h3 style={{ color: c.textDark, marginTop: '30px', marginBottom: '15px' }}>
              {t('dataSharing')}
            </h3>
            <p style={{ marginBottom: '20px' }}>
              {t('dataSharingText')}
            </p>

            <h3 style={{ color: c.textDark, marginTop: '30px', marginBottom: '15px' }}>
              {t('dataSecurity')}
            </h3>
            <p style={{ marginBottom: '20px' }}>
              {t('securityText')}
            </p>

            <h3 style={{ color: c.textDark, marginTop: '30px', marginBottom: '15px' }}>
              {t('yourRights')}
            </h3>
            <p style={{ marginBottom: '20px' }}>
              {t('rightsText')}
            </p>

            <h3 style={{ color: c.textDark, marginTop: '30px', marginBottom: '15px' }}>
              {t('contactUs')}
            </h3>
            <p>
              {t('contactPrivacyText')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}