import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '../context/LocationContext'
import { useTheme } from '../context/ThemeContext'

export default function LocationSplash() {
  const navigate = useNavigate()
  const { requestLocation, setLoading, currency, country } = useLocation()
  const { getImage } = useTheme()
  const [status, setStatus] = useState('initial') // 'initial', 'requesting', 'detecting', 'complete', 'error'
  const [error, setError] = useState(null)

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
        return 'Preparing your experience...'
      case 'requesting':
        return 'Requesting location access...'
      case 'detecting':
        return `Detecting your location in ${country}...`
      case 'complete':
        return `Welcome! Currency set to ${currency === 'EGP' ? 'Egyptian Pound' : 'US Dollar'}`
      case 'error':
        return error || 'Location detection failed'
      default:
        return 'Loading...'
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
        return currency === 'EGP' ? '🇪🇬' : '💵'
      case 'error':
        return '⚠️'
      default:
        return '⏳'
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #2E1B1B 0%, #3E2723 25%, #5D4037 50%, #3E2723 75%, #2E1B1B 100%)',
      position: 'relative',
      overflow: 'hidden',
      padding: 'clamp(16px, 4vw, 24px)'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(212, 160, 23, 0.1) 0%, transparent 70%)',
        animation: 'gradientShift 8s ease-in-out infinite'
      }}></div>

      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: 'clamp(300px, 60vw, 500px)',
        height: 'clamp(300px, 60vw, 500px)',
        background: 'radial-gradient(circle, rgba(212, 160, 23, 0.25) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(clamp(60px, 15vw, 80px))',
        animation: 'pulse 4s ease-in-out infinite, drift 20s ease-in-out infinite'
      }}></div>

      {/* Main Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(20px, 5vw, 32px)',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{
          animation: 'logoEntrance 1s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
          filter: 'drop-shadow(0 15px 35px rgba(212, 160, 23, 0.5))'
        }}>
          <img 
            src={getImage('logo')} 
            alt="Louable Logo" 
            style={{ 
              height: 'clamp(120px, 25vh, 200px)',
              width: 'auto',
              maxWidth: '80vw',
              objectFit: 'contain',
              animation: 'floatGentle 4s ease-in-out infinite'
            }} 
          />
        </div>

        {/* Status Icon */}
        <div style={{
          fontSize: 'clamp(3rem, 10vw, 4rem)',
          animation: 'bounce 2s infinite',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
        }}>
          {getStatusIcon()}
        </div>

        {/* Status Message */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            color: '#F8F4F0',
            margin: 0,
            fontWeight: '700',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.6s ease-out'
          }}>
            {getStatusMessage()}
          </h1>

          {status === 'requesting' && (
            <p style={{
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              color: 'rgba(248, 244, 240, 0.8)',
              margin: 0,
              animation: 'fadeInUp 0.8s ease-out'
            }}>
              Please allow location access when prompted
            </p>
          )}

          {status === 'complete' && (
            <p style={{
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              color: '#D4A017',
              margin: 0,
              fontWeight: '600',
              animation: 'fadeInUp 0.8s ease-out'
            }}>
              Redirecting to store...
            </p>
          )}
        </div>

        {/* Progress Indicator */}
        <div style={{
          width: 'clamp(200px, 60vw, 300px)',
          height: '4px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '2px',
          overflow: 'hidden',
          marginTop: '20px'
        }}>
          <div style={{
            height: '100%',
            width: status === 'initial' ? '20%' : 
                  status === 'requesting' ? '50%' : 
                  status === 'detecting' ? '80%' : '100%',
            background: 'linear-gradient(90deg, #D4A017, #FFD700)',
            borderRadius: '2px',
            transition: 'width 0.5s ease',
            boxShadow: '0 0 10px rgba(212, 160, 23, 0.5)'
          }}></div>
        </div>

        {/* Skip Button (always available) */}
        <button
          onClick={handleManualSkip}
          style={{
            marginTop: '20px',
            padding: '10px 24px',
            background: 'transparent',
            border: '2px solid rgba(248, 244, 240, 0.4)',
            borderRadius: '24px',
            color: '#F8F4F0',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: 0.8
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(248, 244, 240, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(248, 244, 240, 0.8)'
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(248, 244, 240, 0.4)'
            e.currentTarget.style.opacity = 0.8
          }}
        >
          Skip Detection →
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes logoEntrance {
          0% { opacity: 0; transform: scale(0.3) rotate(-10deg); }
          70% { transform: scale(1.1) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        @keyframes floatGentle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -30px); }
          66% { transform: translate(-30px, 30px); }
        }

        @keyframes gradientShift {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}