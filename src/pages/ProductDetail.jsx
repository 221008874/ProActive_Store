// src/pages/ProductDetail.jsx
// Enhanced version with improved responsive design, STOCK MANAGEMENT, and premium aesthetics
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useTheme } from '../context/ThemeContext'
import { useLocation } from '../context/LocationContext'
import { db } from '../services/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { addToCart } = useCart()
  const { theme, getImage } = useTheme()
  const { currency } = useLocation()
  
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedFlavor, setSelectedFlavor] = useState(null)
  const [showAddedNotification, setShowAddedNotification] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  const isMobile = windowWidth < 768
  const isSmallMobile = windowWidth < 480

  // Define colors FIRST, before using them
  const colors = {
    light: {
      primary: '#3E2723',
      secondary: '#D4A017',
      background: '#F8F4F0',
      card: '#FCFAF8',
      textDark: '#2E1B1B',
      textLight: '#6B5E57',
      success: '#8BC34A',
      danger: '#EF4444',
      warning: '#F59E0B',
      accent: '#5D4037',
      border: '#E8DDD4'
    },
    dark: {
      primary: '#2E1B1B',
      secondary: '#D4A017',
      background: '#1A1412',
      card: '#2E1B1B',
      textDark: '#F8F4F0',
      textLight: '#C4B5AD',
      success: '#8BC34A',
      danger: '#EF4444',
      warning: '#F59E0B',
      accent: '#5D4037',
      border: '#3E2723'
    }
  }

  const c = theme === 'light' ? colors.light : colors.dark

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!id) {
      navigate('/home')
      return
    }

    const fetchProduct = async () => {
      try {
        // Use currency-specific collection
        const collectionName = currency === 'USD' ? 'products_dollar' : 'products_egp'
        const docRef = doc(db, collectionName, id)

        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          setProduct({ id: docSnap.id, ...data })
          if (data.flavors && data.flavors.length > 0) {
            setSelectedFlavor(data.flavors[0])
          }
        } else {
          navigate('/home')
        }
      } catch (err) {
        console.error('Error fetching product:', err)
        navigate('/home')
      }
    }
    
    if (currency) {
      fetchProduct()
    }
  }, [id, navigate, currency]) // Refetch when currency changes

  // Stock calculations
  const stock = product?.stock || 0
  const isOutOfStock = stock <= 0
  const isLowStock = stock > 0 && stock < 10
  const canAddToCart = stock >= quantity
  const rating = product?.rating || 4.8
  const reviews = product?.reviews || 245

  // Get currency symbol for display
  const getCurrencySymbol = () => currency === 'USD' ? '$' : 'EGP'

  if (!product) {
    return (
      <div style={{ 
        padding: isMobile ? '1.5rem' : '24px', 
        textAlign: 'center',
        background: c.background,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px'
      }}>
        <div style={{
          width: isMobile ? '70px' : '80px',
          height: isMobile ? '70px' : '80px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: `6px solid ${c.border}`,
            borderRadius: '50%'
          }}></div>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '6px solid transparent',
            borderTopColor: c.secondary,
            borderRightColor: c.secondary,
            borderRadius: '50%',
            animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
          }}></div>
        </div>
        <p style={{
          color: c.textDark,
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: '600',
          padding: '0 1rem'
        }}>
          {t('loadingProductDetails')}
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  const handleAddToCart = () => {
    if (isOutOfStock || !canAddToCart) return
    
    for (let i = 0; i < quantity; i++) {
      addToCart({ ...product, selectedFlavor, currency })
    }
    
    setShowAddedNotification(true)
    setTimeout(() => setShowAddedNotification(false), 2500)
  }

  return (
    <div style={{ 
      padding: isMobile ? '1rem' : '2rem',
      backgroundColor: c.background,
      minHeight: '100vh',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Added to Cart Notification */}
      {showAddedNotification && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '80px' : '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${c.success}, #7CB342)`,
          color: 'white',
          padding: isMobile ? '12px 24px' : '16px 32px',
          borderRadius: '12px',
          fontWeight: '700',
          boxShadow: '0 8px 24px rgba(139, 195, 74, 0.5)',
          zIndex: 1000,
          animation: 'slideInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: isMobile ? '0.9rem' : '1rem'
        }}>
          <span>✓</span>
          <span>{quantity} {quantity === 1 ? t('item') : t('items')} {t('addedToCart')}</span>
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? '1.5rem' : '2.5rem',
          gap: isMobile ? '12px' : '20px',
          flexWrap: 'wrap',
          animation: 'fadeInDown 0.6s ease-out'
        }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              background: `linear-gradient(135deg, ${c.primary}15, ${c.primary}05)`,
              border: `2px solid ${c.primary}`,
              color: c.primary,
              cursor: 'pointer',
              fontSize: isMobile ? '0.85rem' : '0.95rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '6px' : '10px',
              padding: isMobile ? '10px 16px' : '12px 24px',
              borderRadius: '10px',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (windowWidth >= 768) {
                e.currentTarget.style.background = c.primary
                e.currentTarget.style.color = '#FFFFFF'
                e.currentTarget.style.transform = 'translateX(-6px)'
              }
            }}
            onMouseLeave={(e) => {
              if (windowWidth >= 768) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${c.primary}15, ${c.primary}05)`
                e.currentTarget.style.color = c.primary
                e.currentTarget.style.transform = 'translateX(0)'
              }
            }}
          >
            <span>←</span>
            {t('backToProducts')}
          </button>
          
          <div style={{
            height: isMobile ? '45px' : '60px'
          }}>
            <img 
              src={getImage('logo')} 
              alt="Louable" 
              style={{ 
                height: '100%',
                filter: theme === 'dark' ? 'brightness(1.1)' : 'none'
              }} 
            />
          </div>
        </div>

        {/* Main Product Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? '2rem' : '3rem',
          animation: 'fadeInUp 0.6s ease-out 0.1s backwards'
        }}>
          {/* Product Image Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {product?.imageUrl ? (
              <div style={{ 
                position: 'relative', 
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: theme === 'light'
                  ? '0 12px 40px rgba(62, 39, 35, 0.15)'
                  : '0 12px 40px rgba(0, 0, 0, 0.5)',
                backgroundColor: c.background,
                aspectRatio: '1/1',
                animation: imageLoaded ? 'none' : 'pulse 2s ease-in-out infinite'
              }}>
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '16px',
                    filter: isOutOfStock ? 'grayscale(0.6)' : 'brightness(1)',
                    transition: 'transform 0.5s ease'
                  }}
                />
                
                {/* Premium Badge */}
                <div style={{
                  position: 'absolute',
                  top: isMobile ? '12px' : '16px',
                  left: isMobile ? '12px' : '16px',
                  background: 'linear-gradient(135deg, #FFD700, #D4A017)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '24px',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  boxShadow: '0 6px 20px rgba(212, 160, 23, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  animation: 'badgeGlow 2s ease-in-out infinite'
                }}>
                  <span>✨</span>
                  {t('premiumQuality')}
                </div>

                {/* Stock Badge */}
                <div style={{
                  position: 'absolute',
                  top: isMobile ? '12px' : '16px',
                  right: isMobile ? '12px' : '16px'
                }}>
                  {isOutOfStock ? (
                    <span style={{
                      background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                      color: '#FFFFFF',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>❌</span>
                      {t('outOfStock')}
                    </span>
                  ) : isLowStock ? (
                    <span style={{
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      color: '#FFFFFF',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      animation: 'pulse 2s ease-in-out infinite'
                    }}>
                      <span>⚡</span>
                      {t('onlyLeft', { count: stock })}
                    </span>
                  ) : (
                    <span style={{
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#FFFFFF',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>✓</span>
                      {t('inStock', { count: stock })}
                    </span>
                  )}
                </div>

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px'
                  }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                      color: '#FFFFFF',
                      padding: '16px 32px',
                      borderRadius: '12px',
                      fontWeight: '800',
                      fontSize: '1.3rem',
                      transform: 'rotate(-10deg)',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '2px'
                    }}>
                      {t('outOfStock')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                background: theme === 'light' 
                  ? 'linear-gradient(135deg, #E8DDD4 0%, #D4C4B8 100%)'
                  : 'linear-gradient(135deg, #3E2723 0%, #5D4037 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                aspectRatio: '1/1',
                fontSize: '4rem',
                position: 'relative',
                boxShadow: theme === 'light'
                  ? '0 12px 40px rgba(62, 39, 35, 0.15)'
                  : '0 12px 40px rgba(0, 0, 0, 0.5)',
                border: `2px solid ${c.border}`
              }}>
                <span style={{ animation: 'bounce 2s ease-in-out infinite' }}>🍫</span>
                <p style={{ 
                  fontSize: '1rem', 
                  color: c.textLight, 
                  marginTop: '20px',
                  fontWeight: '600'
                }}>
                  {t('productImage')}
                </p>
              </div>
            )}

            {/* Image Info */}
            <div style={{
              background: `${c.secondary}15`,
              padding: '12px 16px',
              borderRadius: '12px',
              border: `2px solid ${c.secondary}40`,
              textAlign: 'center'
            }}>
              <p style={{
                margin: 0,
                fontSize: '0.85rem',
                color: c.textLight,
                fontWeight: '600'
              }}>
                📦 {t('packingStandard')}: {product.piecesPerBox} {t('pieces')}
              </p>
            </div>
          </div>

          {/* Product Info Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {/* Title and Price */}
            <div>
              <h1 style={{ 
                fontSize: isMobile ? '1.8rem' : '2.5rem',
                margin: '0 0 0.5rem 0',
                color: c.textDark,
                fontWeight: '800',
                letterSpacing: '-0.5px',
                lineHeight: 1.2,
                fontFamily: 'Georgia, serif'
              }}>
                {product.name}
              </h1>
              
              {/* Rating */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: c.background,
                  borderRadius: '20px',
                  border: `2px solid ${c.border}`
                }}>
                  <span style={{ fontSize: '1rem' }}>⭐</span>
                  <span style={{ 
                    fontWeight: '700',
                    color: c.textDark,
                    fontSize: '0.95rem'
                  }}>
                    {rating.toFixed(1)}
                  </span>
                </div>
                {reviews > 0 && (
                  <span style={{
                    fontSize: '0.85rem',
                    color: c.textLight,
                    fontWeight: '600'
                  }}>
                    ({reviews} {reviews === 1 ? t('review') : t('reviews')})
                  </span>
                )}
              </div>

              {/* Price Display - DYNAMIC CURRENCY */}
              <div style={{
                background: `linear-gradient(135deg, ${c.secondary}20, ${c.secondary}10)`,
                padding: '16px 20px',
                borderRadius: '12px',
                border: `2px solid ${c.secondary}40`,
                boxShadow: theme === 'light'
                  ? '0 4px 16px rgba(212, 160, 23, 0.2)'
                  : '0 4px 16px rgba(212, 160, 23, 0.4)',
                marginBottom: '1.5rem'
              }}>
                <p style={{ 
                  color: c.textLight,
                  fontSize: '0.85rem',
                  margin: '0 0 6px 0',
                  fontWeight: '600'
                }}>
                  {t('price')}
                </p>
                <p style={{ 
                  color: c.secondary,
                  fontSize: '2.2rem',
                  fontWeight: '800', 
                  margin: 0
                }}>
                  {getCurrencySymbol()} {product.price.toFixed(2)}
                </p>
                {currency === 'USD' && product.originalPriceUSD && (
                  <p style={{
                    fontSize: '0.85rem',
                    color: c.textLight,
                    margin: '4px 0 0 0',
                    textDecoration: 'line-through'
                  }}>
                    Was ${product.originalPriceUSD.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div style={{
                background: c.card,
                padding: '16px',
                borderRadius: '12px',
                border: `2px solid ${c.border}`
              }}>
                <p style={{ 
                  color: c.textLight, 
                  lineHeight: 1.8,
                  fontSize: '0.95rem',
                  margin: 0
                }}>
                  {product.description}
                </p>
              </div>
            )}

            {/* Flavors Selection */}
            {product.flavors && product.flavors.length > 0 && (
              <div>
                <p style={{
                  fontWeight: '700',
                  color: c.textDark,
                  margin: '0 0 12px 0',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>🍬</span>
                  {t('selectFlavor')}
                </p>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '10px'
                }}>
                  {product.flavors.map((flavor, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedFlavor(flavor)}
                      style={{
                        padding: '10px 16px',
                        background: selectedFlavor === flavor
                          ? `linear-gradient(135deg, ${c.secondary}, #B8860B)`
                          : c.background,
                        color: selectedFlavor === flavor ? '#FFFFFF' : c.textDark,
                        border: selectedFlavor === flavor
                          ? `2px solid ${c.secondary}`
                          : `2px solid ${c.border}`,
                        borderRadius: '20px',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedFlavor === flavor
                          ? `0 6px 20px rgba(212, 160, 23, 0.4)`
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedFlavor !== flavor && windowWidth >= 768) {
                          e.currentTarget.style.borderColor = c.secondary
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFlavor !== flavor && windowWidth >= 768) {
                          e.currentTarget.style.borderColor = c.border
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      {flavor}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Status */}
            <div style={{
              background: isOutOfStock 
                ? 'linear-gradient(135deg, #FEE2E2, #FECACA)'
                : isLowStock
                  ? 'linear-gradient(135deg, #FEF3C7, #FDE68A)'
                  : 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${isOutOfStock ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>
                  {isOutOfStock ? '❌' : isLowStock ? '⚡' : '✓'}
                </span>
                <div>
                  <p style={{
                    margin: 0,
                    fontWeight: '800',
                    fontSize: '1rem',
                    color: isOutOfStock ? '#991B1B' : isLowStock ? '#92400E' : '#065F46'
                  }}>
                    {isOutOfStock ? t('outOfStock') : isLowStock ? t('lowStockAlert') : t('availableInStock')}
                  </p>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.9rem',
                    color: isOutOfStock ? '#B91C1C' : isLowStock ? '#B45309' : '#047857'
                  }}>
                    {isOutOfStock 
                      ? t('currentlyUnavailable') 
                      : t('inStock', { count: stock })}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            {!isOutOfStock && (
              <div style={{
                background: c.card,
                padding: '16px',
                borderRadius: '12px',
                border: `2px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <span style={{
                  fontWeight: '700',
                  color: c.textDark,
                  fontSize: '0.95rem'
                }}>
                  {t('quantity')}
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: c.background,
                  padding: '8px',
                  borderRadius: '10px'
                }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: 'none',
                      background: quantity <= 1 ? '#E5E7EB' : c.primary,
                      color: quantity <= 1 ? '#9CA3AF' : '#FFFFFF',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    −
                  </button>
                  <span style={{
                    fontSize: '1.2rem',
                    fontWeight: '800',
                    minWidth: '40px',
                    textAlign: 'center',
                    color: c.textDark
                  }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    disabled={quantity >= stock}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: 'none',
                      background: quantity >= stock ? '#E5E7EB' : c.primary,
                      color: quantity >= stock ? '#9CA3AF' : '#FFFFFF',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      cursor: quantity >= stock ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || !canAddToCart}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  background: isOutOfStock 
                    ? '#9CA3AF'
                    : !canAddToCart
                      ? '#F59E0B'
                      : `linear-gradient(135deg, ${c.success} 0%, #7CB342 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '800',
                  cursor: (isOutOfStock || !canAddToCart) ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? '0.95rem' : '1.05rem',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isOutOfStock 
                    ? 'none'
                    : '0 6px 20px rgba(139, 195, 74, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  opacity: (isOutOfStock || !canAddToCart) ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (windowWidth >= 768 && !isOutOfStock && canAddToCart) {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(139, 195, 74, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (windowWidth >= 768) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = isOutOfStock 
                      ? 'none'
                      : '0 6px 20px rgba(139, 195, 74, 0.4)'
                  }
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>
                  {isOutOfStock ? '🚫' : !canAddToCart ? '⚠️' : '✓'}
                </span>
                {isOutOfStock 
                  ? t('outOfStock') 
                  : !canAddToCart 
                    ? t('onlyAvailable', { count: stock })
                    : `${t('addToCart')} (${quantity})`}
              </button>
              
              <button
                onClick={() => navigate('/cart')}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: 'transparent',
                  color: c.primary,
                  border: `2px solid ${c.primary}`,
                  borderRadius: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  fontSize: isMobile ? '0.95rem' : '1.05rem',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (windowWidth >= 768) {
                    e.currentTarget.style.backgroundColor = c.primary
                    e.currentTarget.style.color = '#FFFFFF'
                    e.currentTarget.style.transform = 'translateY(-4px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (windowWidth >= 768) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = c.primary
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                🛒 {t('goToCart')}
              </button>
            </div>

            {/* Additional Info */}
            
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
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

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        @keyframes badgeGlow {
          0%, 100% {
            box-shadow: 0 6px 20px rgba(212, 160, 23, 0.6);
          }
          50% {
            box-shadow: 0 8px 30px rgba(212, 160, 23, 0.8);
          }
        }

        @keyframes slideInBounce {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
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