import { useEffect } from 'react'
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLocation } from '../context/LocationContext'

export default function Splash() {
  const navigate = useNavigate()
  const routerLocation = useRouterLocation()
  const { getImage } = useTheme()
  const { currency, country, setLoading } = useLocation()

  // Get detected location from navigation state
  const detectedData = routerLocation.state || {}

  useEffect(() => {
    // Update context with detected data if passed
    if (detectedData.detectedCurrency) {
      // Currency is already set in context from LocationSplash
    }

    const timer = setTimeout(() => {
      navigate('/home')
    }, 3000)

    return () => clearTimeout(timer)
  }, [navigate, detectedData])

  const getCurrencyDisplay = () => {
    if (currency === 'EGP') {
      return { flag: '🇪🇬', text: 'Egypt Store', symbol: 'EGP' }
    }
    return { flag: '💵', text: 'International Store', symbol: 'USD' }
  }

  const currencyInfo = getCurrencyDisplay()

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
      {/* Animated gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(212, 160, 23, 0.1) 0%, transparent 70%)',
        animation: 'gradientShift 8s ease-in-out infinite'
      }}></div>

      {/* Animated background circles */}
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
      
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: 'clamp(350px, 70vw, 600px)',
        height: 'clamp(350px, 70vw, 600px)',
        background: 'radial-gradient(circle, rgba(232, 221, 212, 0.2) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(clamp(70px, 18vw, 100px))',
        animation: 'pulse 5s ease-in-out infinite reverse, drift 25s ease-in-out infinite reverse'
      }}></div>

      {/* Currency Badge */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '5%',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(10px)',
        padding: '12px 20px',
        borderRadius: '30px',
        border: '2px solid rgba(212, 160, 23, 0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        animation: 'slideInRight 0.8s ease-out'
      }}>
        <span style={{ fontSize: '1.5rem' }}>{currencyInfo.flag}</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#D4A017', 
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {currencyInfo.text}
          </div>
          <div style={{ 
            fontSize: '0.9rem', 
            color: '#F8F4F0', 
            fontWeight: '600' 
          }}>
            {currencyInfo.symbol}
          </div>
        </div>
      </div>

      {/* Sparkle effects */}
      <div style={{
        position: 'absolute',
        top: '20%',
        right: '15%',
        fontSize: 'clamp(1rem, 3vw, 1.5rem)',
        animation: 'sparkle 2s ease-in-out infinite, float 3s ease-in-out infinite',
        opacity: 0.8
      }}>✨</div>
      
      <div style={{
        position: 'absolute',
        bottom: '25%',
        left: '10%',
        fontSize: 'clamp(0.8rem, 2.5vw, 1.2rem)',
        animation: 'sparkle 2.5s ease-in-out infinite 0.5s, float 3.5s ease-in-out infinite',
        opacity: 0.7
      }}>✨</div>

      {/* Main Content Container */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(16px, 4vw, 24px)'
      }}>
        {/* Logo with enhanced animation */}
        <div style={{
          animation: 'logoEntrance 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
          filter: 'drop-shadow(0 15px 35px rgba(212, 160, 23, 0.5))',
          position: 'relative'
        }}>
          <img 
            src={getImage('logo')} 
            alt="Louable Logo" 
            style={{ 
              height: 'clamp(150px, 30vh, 280px)',
              width: 'auto',
              maxWidth: '90vw',
              objectFit: 'contain',
              animation: 'floatGentle 4s ease-in-out infinite'
            }} 
          />
          
          {/* Glow effect behind logo */}
          <div style={{
            position: 'absolute',
            inset: '-20%',
            background: 'radial-gradient(circle, rgba(212, 160, 23, 0.3) 0%, transparent 60%)',
            filter: 'blur(30px)',
            animation: 'glow 2s ease-in-out infinite',
            zIndex: -1
          }}></div>
        </div>

        {/* Brand Name */}
        <h1 style={{
          fontSize: 'clamp(2.5rem, 10vw, 4.5rem)',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #FFD700 0%, #D4A017 25%, #F5C561 50%, #D4A017 75%, #FFD700 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 'clamp(8px, 2vw, 12px)',
          letterSpacing: 'clamp(-2px, -0.5vw, -3px)',
          animation: 'slideUp 0.8s ease-out 0.3s backwards, shimmer 3s linear infinite',
          textShadow: '0 4px 20px rgba(212, 160, 23, 0.4)',
          textAlign: 'center',
          fontFamily: 'Georgia, serif'
        }}>
          Louable
        </h1>

        {/* Decorative line */}
        <div style={{
          width: 'clamp(80px, 20vw, 120px)',
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #D4A017, transparent)',
          animation: 'expandWidth 1s ease-out 0.5s backwards',
          borderRadius: '2px'
        }}></div>

        {/* Tagline */}
        <p style={{
          fontSize: 'clamp(1rem, 4vw, 1.5rem)',
          color: '#F8F4F0',
          marginBottom: 'clamp(24px, 6vw, 40px)',
          animation: 'slideUp 0.8s ease-out 0.6s backwards',
          fontWeight: '500',
          letterSpacing: 'clamp(0.5px, 0.2vw, 1.5px)',
          textShadow: '0 2px 15px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
          padding: '0 clamp(16px, 4vw, 24px)',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic'
        }}>
          Your Premium Chocolate Experience
        </p>

        {/* Location Info (if available) */}
        {country && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            padding: '10px 20px',
            borderRadius: '20px',
            border: '1px solid rgba(212, 160, 23, 0.3)',
            animation: 'fadeInUp 0.8s ease-out 0.8s backwards',
            marginBottom: '20px'
          }}>
            <span style={{ color: '#F8F4F0', fontSize: '0.9rem' }}>
              📍 Detected: {country}
            </span>
          </div>
        )}

        {/* Enhanced Loading Spinner */}
        <div style={{
          position: 'relative',
          width: 'clamp(60px, 14vw, 70px)',
          height: 'clamp(60px, 14vw, 70px)',
          animation: 'slideUp 0.8s ease-out 0.8s backwards'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '5px solid rgba(212, 160, 23, 0.15)',
            borderRadius: '50%',
            boxShadow: 'inset 0 0 20px rgba(212, 160, 23, 0.1)'
          }}></div>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '5px solid transparent',
            borderTopColor: '#D4A017',
            borderRightColor: '#D4A017',
            borderRadius: '50%',
            animation: 'spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            boxShadow: '0 0 25px rgba(212, 160, 23, 0.4)'
          }}></div>
          <div style={{
            position: 'absolute',
            inset: '10px',
            border: '3px solid transparent',
            borderTopColor: '#F5C561',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite reverse',
            opacity: 0.7
          }}></div>
        </div>

        {/* Loading text */}
        <p style={{
          fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
          color: 'rgba(248, 244, 240, 0.8)',
          animation: 'pulse 1.5s ease-in-out infinite, slideUp 0.8s ease-out 1s backwards',
          fontWeight: '600',
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}>
          Loading {currencyInfo.symbol} Store...
        </p>
      </div>

      {/* Bottom decorative elements */}
      <div style={{
        position: 'absolute',
        bottom: 'clamp(40px, 10vw, 60px)',
        display: 'flex',
        gap: 'clamp(10px, 2.5vw, 16px)',
        animation: 'fadeIn 1.5s ease-out 1.2s backwards',
        zIndex: 10
      }}>
        <div style={{
          width: 'clamp(35px, 9vw, 50px)',
          height: '5px',
          background: 'linear-gradient(90deg, transparent, rgba(212, 160, 23, 0.6))',
          borderRadius: '3px',
          animation: 'expandWidth 1s ease-out 1.5s backwards, pulse 2s ease-in-out infinite'
        }}></div>
        <div style={{
          width: 'clamp(50px, 13vw, 70px)',
          height: '5px',
          background: 'linear-gradient(90deg, rgba(212, 160, 23, 0.6), rgba(212, 160, 23, 0.9), rgba(212, 160, 23, 0.6))',
          borderRadius: '3px',
          animation: 'expandWidth 1s ease-out 1.6s backwards, pulse 2s ease-in-out infinite 0.3s'
        }}></div>
        <div style={{
          width: 'clamp(35px, 9vw, 50px)',
          height: '5px',
          background: 'linear-gradient(90deg, rgba(212, 160, 23, 0.6), transparent)',
          borderRadius: '3px',
          animation: 'expandWidth 1s ease-out 1.7s backwards, pulse 2s ease-in-out infinite 0.6s'
        }}></div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes logoEntrance {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-10deg);
          }
          70% {
            transform: scale(1.1) rotate(5deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes floatGentle {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          50% { 
            transform: translateY(-15px) rotate(2deg); 
          }
        }

        @keyframes shimmer {
          0% {
            background-position: 0% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        @keyframes glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes drift {
          0%, 100% {
            transform: translate(0, 0);
          }
          33% {
            transform: translate(30px, -30px);
          }
          66% {
            transform: translate(-30px, 30px);
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
        
        @keyframes expandWidth {
          from { 
            width: 0; 
            opacity: 0; 
          }
          to { 
            opacity: 1; 
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.98);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}