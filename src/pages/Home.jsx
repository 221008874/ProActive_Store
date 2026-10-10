// This is the complete professional animations file
// Copy and replace your existing Home.jsx with this file
import { useLocation as useRouterLocation } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../context/LanguageContext'
import { useLocation } from '../context/LocationContext'
import ProductCard from '../components/ProductCard'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, getDocs } from 'firebase/firestore'
import heroImage from '../assets/mainBG.webp'
import facebookIcon from '../assets/facebook.png'
import instagramIcon from '../assets/instagram.png'
import twitterIcon from '../assets/twitter.png'
import whatsappIcon from '../assets/whatsapp.png'

export default function Home() {
  const { toggleTheme, theme, getImage } = useTheme()
  const { totalItems } = useCart()
  const { t, lang, toggleLanguage } = useLanguage()
  const navigate = useNavigate()
  const { currency } = useLocation()
  const routerLocation = useRouterLocation()
  
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const [scrollY, setScrollY] = useState(0)
  
  const missionCardRef = useRef(null)
  const visionCardRef = useRef(null)
  const valuesCardRef = useRef(null)
  const productsRef = useRef({})
  
  const [animatedElements, setAnimatedElements] = useState({
    mission: false,
    vision: false,
    values: false,
    products: new Set()
  })

  // Get detected location info from navigation state (passed from Splash)
  const detectedInfo = routerLocation.state || {}

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
      primary: '#F8F4F0',
      secondary: '#D4A017',
      background: '#1A1412',
      card: '#2E1B1B',
      textDark: '#F8F4F0',
      textLight: '#C4B5AD',
      border: '#3E2723'
    }
  }

  const c = theme === 'light' ? colors.light : colors.dark

  const isMobile = windowWidth < 768
  const isTablet = windowWidth >= 768 && windowWidth < 1024
  const isSmallMobile = windowWidth < 480

const PRODUCT_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

const getCachedProducts = (currency) => {
  try {
    const key = `products_${currency}`
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > PRODUCT_CACHE_TTL) return null
    return data
  } catch (e) {
    return null
  }
}

const setCachedProducts = (currency, data) => {
  try {
    const key = `products_${currency}`
    sessionStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.warn('Failed to cache products:', e)
  }
}



  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const observerOptions = {
      threshold: isMobile ? [0, 0.2, 0.5] : [0, 0.3, 0.6],
      rootMargin: '0px 0px -50px 0px'
    }

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.15) {
          const id = entry.target.getAttribute('data-animate')
          
          if (id === 'mission') {
            setAnimatedElements(prev => ({ ...prev, mission: true }))
          } else if (id === 'vision') {
            setAnimatedElements(prev => ({ ...prev, vision: true }))
          } else if (id === 'values') {
            setAnimatedElements(prev => ({ ...prev, values: true }))
          } else if (id?.startsWith('product-')) {
            const index = parseInt(id.split('-')[1])
            setAnimatedElements(prev => ({
              ...prev,
              products: new Set([...prev.products, index])
            }))
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    if (missionCardRef.current) observer.observe(missionCardRef.current)
    if (visionCardRef.current) observer.observe(visionCardRef.current)
    if (valuesCardRef.current) observer.observe(valuesCardRef.current)
    
    Object.values(productsRef.current).forEach(card => {
      if (card) observer.observe(card)
    })

    return () => observer.disconnect()
  }, [isMobile, products.length])

  // SINGLE currency-aware fetch effect - REMOVED the duplicate
 useEffect(() => {
  const fetchProducts = async () => {
    if (!currency) return
    
    // Check cache first
    const cached = getCachedProducts(currency)
    if (cached) {
      setProducts(cached)
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      const collectionName = currency === 'USD' ? 'products_dollar' : 'products_egp'
      const querySnapshot = await getDocs(collection(db, collectionName))
      const productList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setProducts(productList)
      setCachedProducts(currency, productList) // Cache results
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }
  
  fetchProducts()
}, [currency])

  // Show currency badge in header
  const getCurrencyDisplay = () => {
    if (currency === 'USD') {
      return { flag: '💵', text: 'International Store', symbol: 'USD' }
    }
    return { flag: '🇪🇬', text: 'Egypt Store', symbol: 'EGP' }
  }

  const currencyInfo = getCurrencyDisplay()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: c.background,
        color: c.textDark,
        fontSize: '1.25rem',
        fontFamily: 'Georgia, serif',
        gap: '24px',
        padding: '20px'
      }}>
        <div style={{ width: '80px', height: '80px', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '6px solid rgba(212, 160, 23, 0.2)',
            borderRadius: '50%'
          }}></div>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '6px solid transparent',
            borderTopColor: '#D4A017',
            borderRightColor: '#D4A017',
            borderRadius: '50%',
            animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
          }}></div>
        </div>
        <p style={{ fontWeight: '600', letterSpacing: '1px', textAlign: 'center' }}>
          {t('loadingPremiumChocolates')}
        </p>
        <p style={{ 
          fontSize: '0.9rem', 
          color: c.textLight,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{currencyInfo.flag}</span>
          Loading {currencyInfo.symbol} Store...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      {/* HERO SECTION */}
      <section style={{
        position: 'relative',
        width: '100%',
        height: isMobile ? 'clamp(600px, 90vh, 750px)' : '75vh',
        minHeight: isMobile ? '600px' : '850px',
        maxHeight: isMobile ? '750px' : '950px',
        overflow: 'hidden',
        background: c.card
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: theme === 'dark' ? 'brightness(0.75)' : 'brightness(0.9)',
          transition: 'filter 0.3s ease',
          animation: isMobile ? 'none' : 'kenBurns 20s ease-in-out infinite alternate',
          transform: isMobile ? 'none' : `translateY(${scrollY * 0.5}px)`,
          willChange: 'transform'
        }} />

        <div style={{
          position: 'absolute',
          inset: 0,
          background: theme === 'light' 
            ? 'linear-gradient(to bottom, rgba(248,244,240,0.1), rgba(62,39,35,0.6))' 
            : 'linear-gradient(to bottom, rgba(26,20,18,0.2), rgba(46,27,27,0.7))',
          transition: 'background 0.3s ease'
        }} />

        {/* Currency Badge - Top Right */}
        <div style={{
          position: 'absolute',
          top: isMobile ? '80px' : '100px',
          right: '20px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          padding: '10px 16px',
          borderRadius: '24px',
          border: '2px solid rgba(212, 160, 23, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 20,
          animation: 'slideInRight 0.8s ease-out'
        }}>
          <span style={{ fontSize: '1.3rem' }}>{currencyInfo.flag}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ 
              fontSize: '0.7rem', 
              color: '#D4A017', 
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {currencyInfo.text}
            </div>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#F8F4F0', 
              fontWeight: '600' 
            }}>
              {currencyInfo.symbol}
            </div>
          </div>
        </div>

        {!isSmallMobile && (
          <>
            <div style={{
              position: 'absolute',
              top: '10%',
              right: '5%',
              fontSize: '2rem',
              opacity: 0.3,
              animation: 'float 4s ease-in-out infinite',
              transform: `translateY(${scrollY * 0.3}px)`,
              willChange: 'transform'
            }}>🍫</div>
            <div style={{
              position: 'absolute',
              bottom: '15%',
              left: '8%',
              fontSize: '1.5rem',
              opacity: 0.25,
              animation: 'float 5s ease-in-out infinite 1s',
              transform: `translateY(${scrollY * 0.25}px)`,
              willChange: 'transform'
            }}>✨</div>
          </>
        )}

        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: isMobile ? '1rem' : 'clamp(1rem, 3vw, 1.5rem) clamp(1.5rem, 4vw, 2rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)',
          backdropFilter: 'blur(5px)',
          gap: '0.5rem'
        }}>
          <button
            onClick={toggleLanguage}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `2px solid rgba(255, 255, 255, 0.4)`,
              borderRadius: '30px',
              padding: isMobile ? '0.6rem 1rem' : 'clamp(0.6rem, 2vw, 0.8rem) clamp(1.2rem, 3vw, 1.5rem)',
              cursor: 'pointer',
              fontSize: isMobile ? '0.85rem' : 'clamp(0.9rem, 2.5vw, 1rem)',
              fontWeight: '700',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              color: '#FFFFFF',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              minWidth: isMobile ? '60px' : '75px',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (windowWidth >= 768) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
                e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              if (windowWidth >= 768) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.transform = 'scale(1) translateY(0)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
              }
            }}
          >
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '0.5rem' : 'clamp(0.6rem, 2vw, 0.9rem)'
          }}>
            <Link
              to="/cart"
              style={{
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `2px solid rgba(255, 255, 255, 0.4)`,
                borderRadius: '50%',
                width: isMobile ? '48px' : 'clamp(50px, 12vw, 58px)',
                height: isMobile ? '48px' : 'clamp(50px, 12vw, 58px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: isMobile ? '1.3rem' : 'clamp(1.4rem, 4vw, 1.6rem)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textDecoration: 'none',
                color: '#FFFFFF',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.transform = 'scale(1) translateY(0)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
                }
              }}
            >
              🛒
              {totalItems > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: 'linear-gradient(135deg, #FF3B3B, #DC2626)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: isMobile ? '22px' : 'clamp(24px, 6vw, 28px)',
                  height: isMobile ? '22px' : 'clamp(24px, 6vw, 28px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? '0.65rem' : 'clamp(0.7rem, 2vw, 0.8rem)',
                  fontWeight: 'bold',
                  border: `3px solid #FFFFFF`,
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.5)',
                  animation: 'cartBadgePulse 2s ease-in-out infinite'
                }}>
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '1.5rem 1rem' : 'clamp(2rem, 5vw, 3rem)',
          textAlign: 'center',
          zIndex: 1
        }}>
          <div style={{
            maxWidth: '1000px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isMobile ? '1rem' : 'clamp(1.2rem, 3.5vh, 2.5rem)',
            transform: `translateY(${scrollY * 0.1}px)`,
            willChange: 'transform',
            transition: 'transform 0.05s linear'
          }}>
            <div style={{
              marginTop: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              animation: 'fadeInScale 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: 'relative'
            }}>
              <div style={{
                position: 'relative',
                filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.4))'
              }}>
                <img 
                  src={getImage('logo')} 
                  alt="Louable Logo" 
                  style={{ 
                    height: isMobile ? 'clamp(120px, 22vh, 200px)' : 'clamp(140px, 28vh, 280px)',
                    width: 'auto',
                    maxWidth: '90%',
                    objectFit: 'contain',
                    filter: theme === 'dark' 
                      ? 'brightness(1.15) contrast(1.1)' 
                      : 'brightness(1.05)',
                    transition: 'all 0.4s ease',
                    animation: isMobile ? 'none' : 'floatGentle 5s ease-in-out infinite'
                  }} 
                />
                {!isMobile && (
                  <div style={{
                    position: 'absolute',
                    inset: '-30%',
                    background: 'radial-gradient(circle, rgba(212, 160, 23, 0.4) 0%, transparent 60%)',
                    filter: 'blur(40px)',
                    animation: 'glow 3s ease-in-out infinite',
                    zIndex: -1,
                    pointerEvents: 'none'
                  }}></div>
                )}
              </div>
            </div>

            <h1 style={{
              fontSize: isMobile ? 'clamp(2.5rem, 12vw, 4rem)' : 'clamp(3rem, 9vw, 6rem)',
              fontFamily: 'Georgia, serif',
              color: '#FFFFFF',
              margin: 0,
              fontWeight: 'bold',
              textShadow: '4px 4px 16px rgba(0,0,0,0.7), 0 0 40px rgba(212, 160, 23, 0.3)',
              letterSpacing: isMobile ? '1px' : 'clamp(1px, 0.3vw, 3px)',
              animation: 'fadeInScale 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s backwards',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F5C561 50%, #FFFFFF 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))'
            }}>
              {t('Louable')}
            </h1>

            <div style={{
              width: isMobile ? '80px' : 'clamp(100px, 25vw, 150px)',
              height: '4px',
              background: 'linear-gradient(90deg, transparent, #D4A017 20%, #FFD700 50%, #D4A017 80%, transparent)',
              animation: 'expandWidth 1.2s ease-out 0.6s backwards, shimmer 3s linear infinite',
              borderRadius: '2px',
              boxShadow: '0 0 20px rgba(212, 160, 23, 0.6)'
            }}></div>

            <h2 style={{
              fontSize: isMobile ? 'clamp(1.5rem, 7vw, 2.2rem)' : 'clamp(1.8rem, 5vw, 3rem)',
              fontFamily: 'Georgia, serif',
              color: '#F8F4F0',
              margin: 0,
              fontWeight: '700',
              textShadow: '3px 3px 12px rgba(0,0,0,0.6)',
              letterSpacing: isMobile ? '0.5px' : 'clamp(0.5px, 0.2vw, 1.5px)',
              animation: 'fadeInUp 1.6s ease-out 0.4s backwards'
            }}>
              {t('featuredProducts')}
            </h2>

            <p style={{
              fontSize: isMobile ? 'clamp(0.95rem, 4vw, 1.3rem)' : 'clamp(1.1rem, 3vw, 1.7rem)',
              color: '#F8F4F0',
              margin: 0,
              fontFamily: 'Georgia, serif',
              textShadow: '2px 2px 8px rgba(0,0,0,0.6)',
              fontStyle: 'italic',
              opacity: 0.95,
              animation: 'fadeInUp 1.8s ease-out 0.6s backwards',
              maxWidth: '90%'
            }}>
              {t('discoverPremium')}
            </p>
          </div>
        </div>
      </section>

      {/* ABOUT US SECTION */}
      <section style={{
        background: c.card,
        padding: isMobile ? '3rem 1rem' : 'clamp(4rem, 8vw, 6rem) clamp(1.5rem, 4vw, 2rem)',
        borderTop: `3px solid ${c.secondary}`,
        borderBottom: `3px solid ${c.secondary}`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isMobile && (
          <>
            <div style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              background: `radial-gradient(circle, ${c.secondary}10, transparent)`,
              borderRadius: '50%',
              filter: 'blur(80px)',
              animation: 'float 10s ease-in-out infinite',
              pointerEvents: 'none'
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
              animation: 'float 12s ease-in-out infinite reverse',
              pointerEvents: 'none'
            }}></div>
          </>
        )}

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: isMobile ? '2.5rem' : 'clamp(3rem, 6vw, 4rem)',
            animation: 'fadeInUp 0.8s ease-out'
          }}>
            <h2 style={{
              fontSize: isMobile ? 'clamp(1.8rem, 7vw, 2.5rem)' : 'clamp(2rem, 5vw, 3rem)',
              fontFamily: 'Georgia, serif',
              color: c.textDark,
              fontWeight: '700',
              marginBottom: '1rem',
              letterSpacing: '-1px'
            }}>
              {t('aboutUsTitle')}
            </h2>
            <div style={{
              width: isMobile ? '60px' : 'clamp(80px, 15vw, 100px)',
              height: '4px',
              background: `linear-gradient(90deg, transparent, ${c.secondary}, transparent)`,
              margin: '0 auto',
              borderRadius: '2px'
            }}></div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isSmallMobile || isMobile ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: isMobile ? '1.5rem' : 'clamp(2rem, 5vw, 3rem)',
            marginBottom: isMobile ? '2rem' : 'clamp(2.5rem, 5vw, 3.5rem)'
          }}>
            {/* Mission Card */}
            <div
              ref={missionCardRef}
              data-animate="mission"
              style={{
                background: c.background,
                borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 20px)',
                padding: isMobile ? '24px 20px' : 'clamp(32px, 6vw, 40px)',
                border: `2px solid ${c.border}`,
                boxShadow: theme === 'light'
                  ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                  : '0 8px 24px rgba(0, 0, 0, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                textAlign: isMobile ? 'center' : (lang === 'ar' ? 'right' : 'left'),
                transform: animatedElements.mission 
                  ? 'translateY(0) rotateX(0) scale(1)' 
                  : 'translateY(60px) rotateX(10deg) scale(0.95)',
                opacity: animatedElements.mission ? 1 : 0,
                transition: 'all 0.8s cubic-bezier(0.23, 1, 0.320, 1)',
                cursor: 'default',
                perspective: '1000px',
                transformStyle: 'preserve-3d'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768 && animatedElements.mission) {
                  e.currentTarget.style.transform = 'translateY(-12px) rotateX(-5deg) scale(1.03)'
                  e.currentTarget.style.boxShadow = `0 20px 40px ${theme === 'light' ? 'rgba(62, 39, 35, 0.15)' : 'rgba(0, 0, 0, 0.4)'}`
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = animatedElements.mission ? 'translateY(0) rotateX(0) scale(1)' : 'translateY(60px) rotateX(10deg) scale(0.95)'
                  e.currentTarget.style.boxShadow = theme === 'light'
                    ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                    : '0 8px 24px rgba(0, 0, 0, 0.3)'
                }
              }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                height: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                fontSize: isMobile ? '2.5rem' : 'clamp(3rem, 8vw, 4rem)',
                marginBottom: isMobile ? '16px' : 'clamp(20px, 4vw, 24px)',
                background: c.card,
                borderRadius: '50%',
                border: `3px solid ${c.secondary}40`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                margin: isMobile ? '0 auto 16px' : `0 0 clamp(20px, 4vw, 24px) 0`,
                transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
                animation: animatedElements.mission ? 'iconBounce 0.8s cubic-bezier(0.23, 1, 0.320, 1)' : 'none',
                position: 'relative',
                zIndex: 1
              }}>
                🍫
              </div>
              <h3 style={{
                fontSize: isMobile ? '1.2rem' : 'clamp(1.3rem, 4vw, 1.8rem)',
                fontWeight: '700',
                color: c.textDark,
                marginBottom: isMobile ? '10px' : 'clamp(12px, 3vw, 16px)',
                letterSpacing: '-0.5px',
                margin: 0,
                transition: 'color 0.6s ease',
                position: 'relative',
                zIndex: 1
              }}>
                {t('ourMission')}
              </h3>
              <p style={{
                fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 3vw, 1.1rem)',
                color: c.textLight,
                lineHeight: 1.8,
                margin: 0,
                transition: 'color 0.6s ease',
                position: 'relative',
                zIndex: 1
              }}>
                {t('missionDescription')}
              </p>
            </div>

            {/* Vision Card */}
            <div
              ref={visionCardRef}
              data-animate="vision"
              style={{
                background: c.background,
                borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 20px)',
                padding: isMobile ? '24px 20px' : 'clamp(32px, 6vw, 40px)',
                border: `2px solid ${c.border}`,
                boxShadow: theme === 'light'
                  ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                  : '0 8px 24px rgba(0, 0, 0, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                textAlign: isMobile ? 'center' : (lang === 'ar' ? 'right' : 'left'),
                transform: animatedElements.vision 
                  ? 'translateY(0) rotateX(0) scale(1)' 
                  : 'translateY(60px) rotateX(10deg) scale(0.95)',
                opacity: animatedElements.vision ? 1 : 0,
                transition: 'all 0.8s cubic-bezier(0.23, 1, 0.320, 1)',
                transitionDelay: animatedElements.vision ? '0.15s' : '0s',
                cursor: 'default',
                perspective: '1000px',
                transformStyle: 'preserve-3d'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768 && animatedElements.vision) {
                  e.currentTarget.style.transform = 'translateY(-12px) rotateX(-5deg) scale(1.03)'
                  e.currentTarget.style.boxShadow = `0 20px 40px ${theme === 'light' ? 'rgba(62, 39, 35, 0.15)' : 'rgba(0, 0, 0, 0.4)'}`
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = animatedElements.vision ? 'translateY(0) rotateX(0) scale(1)' : 'translateY(60px) rotateX(10deg) scale(0.95)'
                  e.currentTarget.style.boxShadow = theme === 'light'
                    ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                    : '0 8px 24px rgba(0, 0, 0, 0.3)'
                }
              }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                height: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                fontSize: isMobile ? '2.5rem' : 'clamp(3rem, 8vw, 4rem)',
                marginBottom: isMobile ? '16px' : 'clamp(20px, 4vw, 24px)',
                background: c.card,
                borderRadius: '50%',
                border: `3px solid ${c.secondary}40`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                margin: isMobile ? '0 auto 16px' : `0 0 clamp(20px, 4vw, 24px) 0`,
                transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
                animation: animatedElements.vision ? 'iconBounce 0.8s cubic-bezier(0.23, 1, 0.320, 1) 0.15s' : 'none',
                position: 'relative',
                zIndex: 1
              }}>
                👁️
              </div>
              <h3 style={{
                fontSize: isMobile ? '1.2rem' : 'clamp(1.3rem, 4vw, 1.8rem)',
                fontWeight: '700',
                color: c.textDark,
                marginBottom: isMobile ? '10px' : 'clamp(12px, 3vw, 16px)',
                letterSpacing: '-0.5px',
                margin: 0,
                transition: 'color 0.6s ease',
                position: 'relative',
                zIndex: 1
              }}>
                {t('ourVision')}
              </h3>
              <p style={{
                fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 3vw, 1.1rem)',
                color: c.textLight,
                lineHeight: 1.8,
                margin: 0,
                transition: 'color 0.6s ease',
                position: 'relative',
                zIndex: 1
              }}>
                {t('visionDescription')}
              </p>
            </div>

            {/* Values Card */}
            <div
              ref={valuesCardRef}
              data-animate="values"
              style={{
                background: c.background,
                borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 20px)',
                padding: isMobile ? '24px 20px' : 'clamp(32px, 6vw, 40px)',
                border: `2px solid ${c.border}`,
                boxShadow: theme === 'light'
                  ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                  : '0 8px 24px rgba(0, 0, 0, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                textAlign: isMobile ? 'center' : (lang === 'ar' ? 'right' : 'left'),
                transform: animatedElements.values 
                  ? 'translateY(0) rotateX(0) scale(1)' 
                  : 'translateY(60px) rotateX(10deg) scale(0.95)',
                opacity: animatedElements.values ? 1 : 0,
                transition: 'all 0.8s cubic-bezier(0.23, 1, 0.320, 1)',
                transitionDelay: animatedElements.values ? '0.3s' : '0s',
                cursor: 'default',
                perspective: '1000px',
                transformStyle: 'preserve-3d'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768 && animatedElements.values) {
                  e.currentTarget.style.transform = 'translateY(-12px) rotateX(-5deg) scale(1.03)'
                  e.currentTarget.style.boxShadow = `0 20px 40px ${theme === 'light' ? 'rgba(62, 39, 35, 0.15)' : 'rgba(0, 0, 0, 0.4)'}`
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = animatedElements.values ? 'translateY(0) rotateX(0) scale(1)' : 'translateY(60px) rotateX(10deg) scale(0.95)'
                  e.currentTarget.style.boxShadow = theme === 'light'
                    ? '0 8px 24px rgba(62, 39, 35, 0.08)'
                    : '0 8px 24px rgba(0, 0, 0, 0.3)'
                }
              }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                height: isMobile ? '70px' : 'clamp(80px, 18vw, 100px)',
                fontSize: isMobile ? '2.5rem' : 'clamp(3rem, 8vw, 4rem)',
                marginBottom: isMobile ? '16px' : 'clamp(20px, 4vw, 24px)',
                background: c.card,
                borderRadius: '50%',
                border: `3px solid ${c.secondary}40`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                margin: isMobile ? '0 auto 16px' : `0 0 clamp(20px, 4vw, 24px) 0`,
                transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
                animation: animatedElements.values ? 'iconBounce 0.8s cubic-bezier(0.23, 1, 0.320, 1) 0.3s' : 'none',
                position: 'relative',
                zIndex: 1
              }}>
                💎
              </div>
              <h3 style={{
                fontSize: isMobile ? '1.2rem' : 'clamp(1.3rem, 4vw, 1.8rem)',
                fontWeight: '700',
                color: c.textDark,
                marginBottom: isMobile ? '10px' : 'clamp(12px, 3vw, 16px)',
                letterSpacing: '-0.5px',
                margin: 0,
                transition: 'color 0.6s ease',
                position: 'relative',
                zIndex: 1
              }}>
                {t('ourValues')}
              </h3>
              <p style={{
                fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 3vw, 1.1rem)',
                color: c.textLight,
                lineHeight: 1.8,
                margin: 0,
                transition: 'color 0.6s ease',
                position: 'relative',
                zIndex: 1
              }}>
                {t('valuesDescription')}
              </p>
            </div>
          </div>

          <div style={{
            background: `linear-gradient(135deg, ${c.secondary}15, ${c.secondary}05)`,
            border: `2px solid ${c.secondary}40`,
            borderRadius: isMobile ? '12px' : 'clamp(16px, 3vw, 20px)',
            padding: isMobile ? '24px 20px' : 'clamp(32px, 6vw, 40px)',
            textAlign: 'center',
            animation: 'fadeInUp 0.6s ease-out 0.45s backwards'
          }}>
            <p style={{
              fontSize: isMobile ? '0.95rem' : 'clamp(1rem, 3vw, 1.2rem)',
              color: c.textLight,
              lineHeight: 1.8,
              maxWidth: '800px',
              margin: '0 auto 1.5rem',
              fontStyle: 'italic'
            }}>
              {t('experienceFinest')}
            </p>
            <button
              onClick={() => navigate('/about')}
              style={{
                padding: isMobile ? '12px 28px' : 'clamp(12px, 3vw, 16px) clamp(32px, 7vw, 48px)',
                background: `linear-gradient(135deg, ${c.secondary}, #D4A017)`,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: isMobile ? '10px' : 'clamp(8px, 2vw, 12px)',
                fontSize: isMobile ? '0.95rem' : 'clamp(1rem, 3vw, 1.15rem)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.320, 1)',
                boxShadow: '0 6px 20px rgba(212, 160, 23, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.08)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(212, 160, 23, 0.6)'
                  e.currentTarget.style.letterSpacing = '1px'
                }
              }}
              onMouseLeave={(e) => {
                if (windowWidth >= 768) {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(212, 160, 23, 0.4)'
                  e.currentTarget.style.letterSpacing = '0px'
                }
              }}
            >
              <span>📖</span>
              {t('learnMore')}
            </button>
          </div>
        </div>
      </section>

      {/* PRODUCTS SECTION */}
      <section style={{
        background: c.background,
        padding: isMobile ? '3rem 1rem' : 'clamp(4rem, 8vw, 6rem) clamp(1.5rem, 4vw, 2rem)',
        transition: 'background 0.3s ease',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '200px',
          background: `linear-gradient(to bottom, ${c.background}00, ${c.background})`,
          pointerEvents: 'none'
        }}></div>

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          position: 'relative'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: isMobile ? '2rem' : 'clamp(3rem, 6vw, 4rem)',
            animation: 'fadeInUp 0.8s ease-out'
          }}>
            <h2 style={{
              fontSize: isMobile ? 'clamp(1.8rem, 7vw, 2.5rem)' : 'clamp(2rem, 5vw, 3rem)',
              fontFamily: 'Georgia, serif',
              color: c.textDark,
              fontWeight: '700',
              marginBottom: '1rem',
              letterSpacing: '-1px'
            }}>
              {t('ourCollection')}
            </h2>
            <div style={{
              width: isMobile ? '60px' : 'clamp(60px, 15vw, 80px)',
              height: '4px',
              background: `linear-gradient(90deg, transparent, ${c.secondary}, transparent)`,
              margin: '0 auto',
              borderRadius: '2px'
            }}></div>
            {/* Currency indicator */}
            <div style={{
              marginTop: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: c.card,
              borderRadius: '20px',
              border: `2px solid ${c.border}`,
              fontSize: '0.85rem',
              color: c.textLight
            }}>
              <span>{currencyInfo.flag}</span>
              <span>Showing prices in {currencyInfo.symbol}</span>
            </div>
          </div>

          {products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: isMobile ? '3rem 1rem' : 'clamp(4rem, 8vw, 6rem) clamp(2rem, 4vw, 3rem)',
              color: c.textLight,
              animation: 'fadeIn 0.6s ease-out'
            }}>
              <div style={{ fontSize: isMobile ? '3rem' : 'clamp(4rem, 10vw, 6rem)', marginBottom: 'clamp(1.5rem, 3vw, 2rem)', animation: 'bounce 2s ease-in-out infinite' }}>
                🍫
              </div>
              <p style={{ fontSize: isMobile ? '1.1rem' : 'clamp(1.2rem, 3vw, 1.5rem)', fontFamily: 'Georgia, serif', fontWeight: '600' }}>
                {t('noProductsAvailable')}
              </p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                No products found in {currencyInfo.symbol} store
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isSmallMobile 
                ? '1fr' 
                : isMobile 
                  ? 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' 
                  : 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
              gap: isMobile ? '1.5rem' : 'clamp(1.5rem, 4vw, 2.5rem)',
              animation: 'fadeIn 0.8s ease-in-out'
            }}>
              {products.map((product, index) => (
                <div
                  key={product.id}
                  ref={el => {
                    if (el) productsRef.current[index] = el
                  }}
                  data-animate={`product-${index}`}
                  style={{
                    transform: animatedElements.products.has(index) 
                      ? 'translateY(0) rotateX(0) scale(1)' 
                      : 'translateY(60px) rotateX(15deg) scale(0.9)',
                    opacity: animatedElements.products.has(index) ? 1 : 0,
                    transition: 'all 0.7s cubic-bezier(0.23, 1, 0.320, 1)',
                    transitionDelay: animatedElements.products.has(index) ? `${index * 80}ms` : '0ms',
                    perspective: '1000px',
                    transformStyle: 'preserve-3d',
                    willChange: 'transform, opacity'
                  }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: theme === 'light' 
          ? `linear-gradient(135deg, ${c.primary} 0%, #2E1B1B 50%, ${c.textDark} 100%)`
          : `linear-gradient(135deg, ${c.card} 0%, ${c.background} 100%)`,
        color: theme === 'light' ? '#F8F4F0' : c.textDark,
        padding: isMobile ? '2.5rem 1rem 2rem' : 'clamp(3rem, 6vw, 4rem) clamp(1.5rem, 4vw, 2rem) clamp(2rem, 4vw, 3rem)',
        borderTop: `3px solid ${c.secondary}`,
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isMobile && (
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            background: `radial-gradient(circle, ${c.secondary}20, transparent)`,
            borderRadius: '50%',
            filter: 'blur(40px)',
            pointerEvents: 'none'
          }}></div>
        )}

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isSmallMobile || isMobile
            ? '1fr'
            : 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: isMobile ? '2rem' : 'clamp(2.5rem, 5vw, 4rem)',
          marginBottom: isMobile ? '1.5rem' : 'clamp(2rem, 4vw, 3rem)',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <img src={getImage('logo')} alt="Louable" style={{ height: isMobile ? '40px' : '50px' }} />
              <h3 style={{ fontSize: isMobile ? '1.5rem' : 'clamp(1.6rem, 4vw, 2rem)', fontFamily: 'Georgia, serif', color: c.secondary, marginBottom: 0, fontWeight: 'bold' }}>
                {t('Louable')}
              </h3>
            </div>
            <p style={{ fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 2.5vw, 1.05rem)', lineHeight: '1.7', opacity: 0.9, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              {t('footerTagline')}
            </p>
          </div>

          <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <h4 style={{ fontSize: isMobile ? '1.1rem' : 'clamp(1.2rem, 3vw, 1.4rem)', fontFamily: 'Georgia, serif', color: c.secondary, marginBottom: '1.5rem', fontWeight: '700' }}>
              {t('quickLinks')}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { key: 'aboutUs', label: t('aboutUs'), path: '/about' },
                { key: 'terms', label: t('termsOfService'), path: '/terms-of-service' },
                { key: 'privacy', label: t('privacy'), path: '/privacy' }
              ].map((link) => (
                <li key={link.key} style={{ marginBottom: '1rem' }}>
                  <Link to={link.path} style={{ color: 'inherit', textDecoration: 'none', fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 2.5vw, 1.05rem)', opacity: 0.85, transition: 'all 0.3s ease', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.color = c.secondary
                      e.currentTarget.style.transform = 'translateX(8px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.85'
                      e.currentTarget.style.color = 'inherit'
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}>
                    <span>→</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <h4 style={{ fontSize: isMobile ? '1.1rem' : 'clamp(1.2rem, 3vw, 1.4rem)', fontFamily: 'Georgia, serif', color: c.secondary, marginBottom: '1.5rem', fontWeight: '700' }}>
              {t('contactUs')}
            </h4>
            <div style={{ fontSize: isMobile ? '0.9rem' : 'clamp(0.95rem, 2.5vw, 1.05rem)', lineHeight: '2', opacity: 0.9 }}>
              <p style={{ margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                <span>📧</span>
                louablefactory@gmail.com
              </p>
              <p style={{ margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
  <span>📱</span>
  {/* Add direction: 'ltr' and unicodeBidi: 'embed' to force left-to-right display */}
  <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>
    {t('phoneNumber')}
  </span>
</p>
            </div>
          </div>

          <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <h4 style={{ fontSize: isMobile ? '1.1rem' : 'clamp(1.2rem, 3vw, 1.4rem)', fontFamily: 'Georgia, serif', color: c.secondary, marginBottom: '1.5rem', fontWeight: '700' }}>
              {t('followUs')}
            </h4>
            <div style={{ display: 'flex', gap: isMobile ? '0.8rem' : 'clamp(0.8rem, 2vw, 1.2rem)', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              {[

                { icon: facebookIcon,  name: 'Facebook',  href: 'https://www.facebook.com/profile.php?id=61584722189527&mibextid=ZbWKwL' },
                { icon: instagramIcon, name: 'Instagram', href: 'https://instagram.com/louable' },
                { icon: twitterIcon,   name: 'Twitter',   href: 'https://twitter.com/louable' },
                { icon: whatsappIcon,  name: 'WhatsApp',  href: 'https://wa.me/201234567890' }

              ].map((social, idx) => (
                <a key={social.name} href={social.href} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: isMobile ? '48px' : 'clamp(48px, 11vw, 52px)',
                  height: isMobile ? '48px' : 'clamp(48px, 11vw, 52px)',
                  background: 'rgba(255, 255, 255, 0.15)', borderRadius: '50%',
                  textDecoration: 'none', transition: 'all 0.4s cubic-bezier(0.23, 1, 0.320, 1)',
                  border: `2px solid ${c.secondary}50`, backdropFilter: 'blur(10px)',
                  animation: `socialFloat 0.6s cubic-bezier(0.23, 1, 0.320, 1) ${idx * 0.1}s backwards`
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = c.secondary
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.2) rotate(10deg)'
                    e.currentTarget.style.boxShadow = `0 12px 24px ${c.secondary}60`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.transform = 'translateY(0) scale(1) rotate(0deg)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}>
                  <img src={social.icon} alt={social.name} style={{ width: isMobile ? '24px' : 'clamp(24px, 5vw, 28px)', height: isMobile ? '24px' : 'clamp(24px, 5vw, 28px)', transition: 'filter 0.4s ease' }} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          paddingTop: isMobile ? '1.5rem' : 'clamp(2rem, 4vw, 3rem)',
          marginTop: isMobile ? '1.5rem' : 'clamp(2rem, 4vw, 3rem)',
          borderTop: `1px solid ${theme === 'light' ? 'rgba(255,255,255,0.2)' : c.border}`,
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <p style={{ margin: 0, fontSize: isMobile ? '0.85rem' : 'clamp(0.9rem, 2.5vw, 1rem)', opacity: 0.85 }}>
            © {new Date().getFullYear()} {t('Louable')}. {t('allRightsReserved')}.
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', opacity: 0.6, color: c.textLight }}>
            Operating in {currencyInfo.symbol} • {currencyInfo.text}
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes floatGentle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        @keyframes expandWidth {
          from { width: 0; opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes kenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }

        @keyframes cartBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        @keyframes iconBounce {
          0% { transform: scale(0.8) translateY(10px); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1) translateY(0); }
        }

        @keyframes socialFloat {
          from { opacity: 0; transform: translateY(20px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        .will-animate {
          will-change: transform, opacity;
        }
      `}</style>
    </>
  )
}