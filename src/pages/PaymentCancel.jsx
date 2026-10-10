import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

export default function PaymentCancel() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  
  const errorMessage = searchParams.get('error') || 'Payment was cancelled'

  const colors = {
    light: {
      primary: '#3E2723',
      secondary: '#D4A017',
      background: '#F8F4F0',
      card: '#FCFAF8',
      textDark: '#2E1B1B',
      textLight: '#6B5E57',
      danger: '#C84B31',
      border: '#E8DDD4'
    },
    dark: {
      primary: '#2E1B1B',
      secondary: '#D4A017',
      background: '#1A1412',
      card: '#2E1B1B',
      textDark: '#F8F4F0',
      textLight: '#C4B5AD',
      danger: '#E67052',
      border: '#3E2723'
    }
  }

  const c = theme === 'light' ? colors.light : colors.dark

  return (
    <div style={{
      minHeight: '100vh',
      background: c.background,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>❌</div>
      
      <h1 style={{
        fontSize: '2.5rem',
        color: c.danger,
        marginBottom: '1rem',
        fontWeight: '700'
      }}>
        Payment Cancelled
      </h1>
      
      <p style={{
        fontSize: '1.2rem',
        color: c.textLight,
        marginBottom: '2rem'
      }}>
        {errorMessage}
      </p>
      
      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => navigate('/cart')}
          style={{
            padding: '14px 32px',
            background: c.secondary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '700',
            fontSize: '1.1rem',
            cursor: 'pointer',
            transition: 'transform 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          🛒 Try Again
        </button>
        
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '14px 32px',
            background: 'transparent',
            color: c.textDark,
            border: `2px solid ${c.border}`,
            borderRadius: '10px',
            fontWeight: '700',
            fontSize: '1.1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = c.border
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          🏠 Return Home
        </button>
      </div>
    </div>
  )
}