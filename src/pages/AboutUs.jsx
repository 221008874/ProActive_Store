// src/pages/AboutUs_RESPONSIVE.jsx
// Enhanced version with improved responsive design
import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useNavigate } from 'react-router-dom'

export default function AboutUs() {
  const { theme, getImage } = useTheme()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  const isMobile = windowWidth < 768
  const isSmallMobile = windowWidth < 480

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
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

  const sections = [
    {
      icon: '🍫',
      title: t('ourMission'),
      description: t('missionDescription'),
      gradient: 'linear-gradient(135deg, rgba(212, 160, 23, 0.1), transparent)'
    },
    {
      icon: '👁️',
      title: t('ourVision'),
      description: t('visionDescription'),
      gradient: 'linear-gradient(135deg, rgba(93, 64, 55, 0.1), transparent)'
    },
    {
      icon: '💎',
      title: t('ourValues'),
      description: t('valuesDescription'),
      gradient: 'linear-gradient(135deg, rgba(139, 195, 74, 0.1), transparent)'
    }
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: c.background,
      color: c.textDark,
      fontFamily: 'Georgia, serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background elements - Hidden on mobile */}
      {!isMobile && (
        <>
          <div style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            background: `radial-gradient(circle, ${c.secondary}15, transparent)`,
            borderRadius: '50%',
            filter: 'blur(80px)',
            animation: 'float 10s ease-in-out infinite'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-150px',
            left: '-150px',
            width: '500px',
            height: '500px',
            background: `radial-gradient(circle, ${c.primary}10, transparent)`,
            borderRadius: '50%',
            filter: 'blur(90px)',
            animation: 'float 12s ease-in-out infinite reverse'
          }}></div>
        </>
      )}

      {/* Header with Logo */}
      <header style={{
        padding: isMobile ? '16px' : 'clamp(20px, 4vw, 32px)',
        background: c.card,
        boxShadow: theme === 'light' 
          ? '0 4px 16px rgba(62, 39, 35, 0.1)' 
          : '0 4px 16px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: `2px solid ${c.border}`,
        backdropFilter: 'blur(10px)',
        animation: 'slideDown 0.5s ease-out',
        gap: '12px',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}>
        {/* Logo + Brand Name */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? '10px' : 'clamp(12px, 3vw, 16px)',
          animation: 'fadeInLeft 0.6s ease-out',
          flex: isMobile ? '1 1 auto' : 'none'
        }}>
          <img 
            src={getImage('logo')} 
            alt="Louable" 
            style={{ 
              height: isMobile ? '40px' : 'clamp(45px, 10vw, 55px)',
              filter: theme === 'dark' 
                ? 'brightness(1.2) drop-shadow(0 4px 12px rgba(212, 160, 23, 0.3))' 
                : 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
              transition: 'transform 0.3s ease'
            }}
            onMouseEnter={(e) => {
              if (windowWidth >= 768) {
                e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)'
              }
            }}
            onMouseLeave={(e) => {
              if (windowWidth >= 768) {
                e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
              }
            }}
          />
          <h1 style={{ 
            margin: 0, 
            fontSize: isMobile ? '1.2rem' : 'clamp(1.3rem, 4vw, 1.8rem)', 
            fontWeight: '700',
            color: c.textDark,
            letterSpacing: '-0.5px',
            background: `linear-gradient(135deg, ${c.textDark}, ${c.secondary})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {t('Louable')}
          </h1>
        </div>
        
        <button
          onClick={() => navigate('/home')}
          style={{
            background: 'transparent',
            border: `2px solid ${c.primary}`,
            borderRadius: isMobile ? '8px' : 'clamp(8px, 2vw, 10px)',
            padding: isMobile ? '8px 14px' : 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
            cursor: 'pointer',
            color: c.primary,
            fontWeight: '700',
            transition: 'all 0.3s ease',
            fontSize: isMobile ? '0.8rem' : 'clamp(0.85rem, 2.5vw, 0.95rem)',
            animation: 'fadeInRight 0.6s ease-out',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (windowWidth >= 768) {
              e.currentTarget.style.background = c.primary
              e.currentTarget.style.color = theme === 'light' ? '#FFFFFF' : c.textDark
              e.currentTarget.style.transform = 'translateX(-4px)'
            }
          }}
          onMouseLeave={(e) => {
            if (windowWidth >= 768) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = c.primary
              e.currentTarget.style.transform = 'translateX(0)'
            }
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)'
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <span>←</span>
          {t('backToHome')}
        </button>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1000px',
        margin: isMobile ? '2rem auto' : 'clamp(40px, 8vw, 60px) auto',
        padding: isMobile ? '0 1rem' : '0 clamp(20px, 5vw, 32px)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Hero Card */}
        <div style={{
          background: c.card,
          borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 24px)',
          padding: isMobile ? '24px 20px' : 'clamp(40px, 8vw, 60px) clamp(32px, 6vw, 48px)',
          border: `2px solid ${c.border}`,
          boxShadow: theme === 'light'
            ? '0 12px 40px rgba(62, 39, 35, 0.12)'
            : '0 12px 40px rgba(0, 0, 0, 0.4)',
          marginBottom: isMobile ? '2rem' : 'clamp(32px, 6vw, 48px)',
          position: 'relative',
          overflow: 'hidden',
          animation: 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          {/* Decorative corner gradient - Hidden on mobile */}
          {!isMobile && (
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%',
              height: '50%',
              background: `radial-gradient(circle at top right, ${c.secondary}10, transparent)`,
              pointerEvents: 'none'
            }}></div>
          )}

          <h2 style={{
            fontSize: isMobile ? 'clamp(1.8rem, 8vw, 2.5rem)' : 'clamp(2rem, 6vw, 3.5rem)',
            fontWeight: '700',
            color: c.textDark,
            marginBottom: isMobile ? '12px' : 'clamp(16px, 4vw, 24px)',
            textAlign: isMobile ? 'center' : (lang === 'ar' ? 'right' : 'left'),
            letterSpacing: '-1px',
            position: 'relative',
            display: 'inline-block',
            width: '100%'
          }}>
            {t('aboutUsTitle')}
            {/* Underline decoration */}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: isMobile ? '50%' : (lang === 'ar' ? 'auto' : 0),
              right: isMobile ? 'auto' : (lang === 'ar' ? 0 : 'auto'),
              transform: isMobile ? 'translateX(-50%)' : 'none',
              width: isMobile ? '50%' : '60%',
              height: '4px',
              background: `linear-gradient(90deg, ${c.secondary}, transparent)`,
              borderRadius: '2px'
            }}></div>
          </h2>

                     <p style={{
              fontSize: isMobile ? '0.95rem' : 'clamp(1rem, 3vw, 1.2rem)',
              color: c.textLight,
              lineHeight: 1.7,
              maxWidth: isMobile ? '100%' : '600px',
              margin: '0 auto',
              marginBottom: isMobile ? '20px' : 'clamp(24px, 5vw, 32px)',
              padding: isMobile ? '0 0.5rem' : '0'
            }}>
              {t('experienceFinest')}
            </p>
        </div>

        {/* Mission, Vision, Values Cards */}
        <div style={{
          display: 'grid',
          // IMPROVED: Single column on mobile
          gridTemplateColumns: isSmallMobile || isMobile 
            ? '1fr' 
            : 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: isMobile ? '1.5rem' : 'clamp(24px, 5vw, 32px)'
        }}>
          {sections.map((section, index) => (
            <div
              key={section.title}
              style={{
                background: c.card,
                borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 20px)',
                padding: isMobile ? '24px 20px' : 'clamp(32px, 6vw, 40px)',
                border: `2px solid ${c.border}`,
                boxShadow: theme === 'light'
                  ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                  : '0 8px 24px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                animation: `fadeInUp 0.6s ease-out ${index * 0.15}s backwards`,
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                  e.currentTarget.style.boxShadow = theme === 'light'
                    ? '0 16px 48px rgba(62, 39, 35, 0.16)'
                    : '0 16px 48px rgba(0, 0, 0, 0.5)'
                  e.currentTarget.style.borderColor = c.secondary
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = theme === 'light'
                    ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                    : '0 8px 24px rgba(0, 0, 0, 0.3)'
                  e.currentTarget.style.borderColor = c.border
                }
              }}
            >
              {/* Background gradient */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: section.gradient,
                pointerEvents: 'none'
              }}></div>

              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 1,
                // IMPROVED: Center on mobile
                textAlign: isMobile ? 'center' : (lang === 'ar' ? 'right' : 'left')
              }}>
                {/* Icon with background */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  // IMPROVED: Smaller icons on mobile
                  width: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                  height: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                  fontSize: isMobile ? '2.5rem' : 'clamp(3rem, 8vw, 4rem)',
                  marginBottom: isMobile ? '16px' : 'clamp(20px, 4vw, 24px)',
                  background: c.background,
                  borderRadius: '50%',
                  border: `3px solid ${c.secondary}40`,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  animation: isMobile ? 'none' : `iconFloat 3s ease-in-out infinite ${index * 0.5}s`
                }}>
                  {section.icon}
                </div>

                <h3 style={{
                  fontSize: isMobile ? '1.2rem' : 'clamp(1.3rem, 4vw, 1.8rem)',
                  fontWeight: '700',
                  color: c.textDark,
                  marginBottom: isMobile ? '10px' : 'clamp(12px, 3vw, 16px)',
                  letterSpacing: '-0.5px'
                }}>
                  {section.title}
                </h3>

                <p style={{
                  fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 3vw, 1.1rem)',
                  color: c.textLight,
                  lineHeight: 1.8,
                  margin: 0
                }}>
                  {section.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info Card */}
        <div style={{
          background: c.card,
          borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 20px)',
          padding: isMobile ? '28px 20px' : 'clamp(32px, 6vw, 48px)',
          border: `2px solid ${c.secondary}40`,
          boxShadow: theme === 'light'
            ? `0 12px 40px rgba(212, 160, 23, 0.15)`
            : `0 12px 40px rgba(212, 160, 23, 0.25)`,
          marginTop: isMobile ? '2rem' : 'clamp(32px, 6vw, 48px)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          animation: 'fadeInUp 0.6s ease-out 0.6s backwards'
        }}>
          {/* Decorative elements - Hidden on mobile */}
          {!isMobile && (
            <>
              <div style={{
                position: 'absolute',
                top: '-50px',
                left: '-50px',
                width: '150px',
                height: '150px',
                background: `radial-gradient(circle, ${c.secondary}20, transparent)`,
                borderRadius: '50%',
                filter: 'blur(40px)'
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '-50px',
                right: '-50px',
                width: '150px',
                height: '150px',
                background: `radial-gradient(circle, ${c.secondary}15, transparent)`,
                borderRadius: '50%',
                filter: 'blur(40px)'
              }}></div>
            </>
          )}

          <div style={{
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              fontSize: isMobile ? '2.5rem' : 'clamp(2.5rem, 7vw, 4rem)',
              marginBottom: isMobile ? '12px' : 'clamp(16px, 4vw, 24px)',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              🎉
            </div>
                       <h3 style={{
              fontSize: isMobile ? '1.4rem' : 'clamp(1.5rem, 5vw, 2rem)',
              fontWeight: '700',
              color: c.textDark,
              marginBottom: isMobile ? '10px' : 'clamp(12px, 3vw, 16px)'
            }}>
              {t('joinOurSweetJourney')}
            </h3>
            <p style={{
              fontSize: isMobile ? '0.95rem' : 'clamp(1rem, 3vw, 1.2rem)',
              color: c.textLight,
              lineHeight: 1.7,
              maxWidth: isMobile ? '100%' : '600px',
              margin: '0 auto',
              marginBottom: isMobile ? '20px' : 'clamp(24px, 5vw, 32px)',
              padding: isMobile ? '0 0.5rem' : '0'
            }}>
              Experience the finest chocolates crafted with love and dedication. 
              Every piece tells a story of quality and passion.
            </p>
            <button
              onClick={() => navigate('/home')}
              style={{
                background: `linear-gradient(135deg, ${c.secondary}, #D4A017)`,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: isMobile ? '10px' : 'clamp(8px, 2vw, 12px)',
                padding: isMobile ? '12px 28px' : 'clamp(12px, 3vw, 16px) clamp(32px, 7vw, 48px)',
                fontSize: isMobile ? '0.95rem' : 'clamp(1rem, 3vw, 1.15rem)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 6px 20px rgba(212, 160, 23, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(212, 160, 23, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(212, 160, 23, 0.4)'
                }
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <span>🛍️</span>
              Explore Our Products
            </button>
          </div>
        </div>
      </main>

      {/* Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes iconFloat {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(5deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
