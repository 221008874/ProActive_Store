// src/components/ProductCard.jsx
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useCart } from '../context/CartContext'
import { useLocation } from '../context/LocationContext'
import { Link } from 'react-router-dom'
import { useState } from 'react'

// Safe translation helper
const safeT = (t, key, fallback = '') => {
  if (typeof t === 'function') {
    try {
      return t(key) || fallback
    } catch (e) {
      return fallback
    }
  }
  return fallback
}

export default function ProductCard({ product }) {
  const [isHovering, setIsHovering] = useState(false)

  // FIX: Hooks must be called unconditionally at the top level.
  // Wrapping hooks in try/catch violates React's Rules of Hooks and
  // causes "Rendered more/fewer hooks than during the previous render" crashes.
  const { t, lang } = useLanguage()
  const { theme } = useTheme()
  const { addToCart } = useCart()
  const { currency } = useLocation()  // FIX: Added missing currency context

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
      border: '#E8DDD4',
      overlay: 'rgba(46, 27, 27, 0.95)'
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
      border: '#3E2723',
      overlay: 'rgba(0, 0, 0, 0.8)'
    }
  }

  const c = colors[theme] || colors.light

  // FIX: Dynamic currency formatting instead of hardcoded 'EGP'
  const formatPrice = (price) => {
    if (price == null) return ''
    if (currency === 'USD') return `$${price.toFixed(2)}`
    return `${price.toFixed(2)} EGP`
  }

  // Stock calculations
  const stock = product?.stock || 0
  const isOutOfStock = stock <= 0
  const isLowStock = stock > 0 && stock < 10
  const rating = product?.rating || 0
  const reviews = product?.reviews || 0

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (isOutOfStock) return

    addToCart(product)

    // Show success message
    const successMsg = document.createElement('div')
    successMsg.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 1.5rem;">✓</span>
        <span>${safeT(t, 'addedToCart', 'Added to cart')}</span>
      </div>
    `
    successMsg.style.cssText = `
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #8BC34A, #7CB342);
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 700;
      box-shadow: 0 8px 24px rgba(139, 195, 74, 0.5);
      z-index: 1000;
      animation: slideInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-size: 1rem;
      max-width: 90%;
    `
    document.body.appendChild(successMsg)
    setTimeout(() => {
      successMsg.style.animation = 'slideOut 0.3s ease-out forwards'
      setTimeout(() => successMsg.remove(), 300)
    }, 2000)
  }

  // Safe translation calls
  const outOfStockText = safeT(t, 'outOfStock', 'Out of Stock')
  const onlyLeftText = safeT(t, 'onlyLeft', 'Only {count} left!').replace('{count}', stock)
  const inStockText = safeT(t, 'inStock', 'In Stock: {count}').replace('{count}', stock)
  const piecesText = safeT(t, 'pieces', 'pieces')
  const addText = safeT(t, 'add', 'Add')

  return (
    <Link
      to={`/product/${product.id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        height: '100%'
      }}
    >
      <div
        style={{
          background: c.card,
          borderRadius: '16px',
          overflow: 'hidden',
          border: `2px solid ${c.border}`,
          boxShadow: theme === 'light'
            ? '0 8px 24px rgba(62, 39, 35, 0.08)'
            : '0 8px 24px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: isOutOfStock ? 'not-allowed' : 'pointer'
        }}
        onMouseEnter={(e) => {
          setIsHovering(true)
          if (!isOutOfStock) {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
            e.currentTarget.style.boxShadow = theme === 'light'
              ? '0 16px 48px rgba(62, 39, 35, 0.16)'
              : '0 16px 48px rgba(0, 0, 0, 0.5)'
            e.currentTarget.style.borderColor = c.secondary
          }
        }}
        onMouseLeave={(e) => {
          setIsHovering(false)
          e.currentTarget.style.transform = 'translateY(0) scale(1)'
          e.currentTarget.style.boxShadow = theme === 'light'
            ? '0 8px 24px rgba(62, 39, 35, 0.08)'
            : '0 8px 24px rgba(0, 0, 0, 0.3)'
          e.currentTarget.style.borderColor = c.border
        }}
      >
        {/* Stock Badge */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: lang === 'ar' ? 'auto' : '12px',
          left: lang === 'ar' ? '12px' : 'auto',
          zIndex: 20,
          animation: isLowStock ? 'pulse 2s ease-in-out infinite' : 'none'
        }}>
          {isOutOfStock ? (
            <span style={{
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
              display: 'inline-block'
            }}>
              {outOfStockText}
            </span>
          ) : isLowStock ? (
            <span style={{
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
              display: 'inline-block'
            }}>
              {onlyLeftText}
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
              display: 'inline-block'
            }}>
              {inStockText}
            </span>
          )}
        </div>

        {/* Product Image Container */}
        <div style={{
          position: 'relative',
          height: '220px',
          overflow: 'hidden',
          background: c.background,
          borderBottom: `1px solid ${c.border}`
        }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.5s ease',
                filter: isOutOfStock ? 'grayscale(0.6)' : 'none',
                transform: isHovering && !isOutOfStock ? 'scale(1.1)' : 'scale(1)'
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: theme === 'light'
                ? 'linear-gradient(135deg, #E8DDD4 0%, #D4C4B8 100%)'
                : 'linear-gradient(135deg, #3E2723 0%, #5D4037 100%)',
              fontSize: '4rem'
            }}>
              <span style={{ animation: 'bounce 2s ease-in-out infinite' }}>🍫</span>
            </div>
          )}

          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: c.overlay,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}>
              <span style={{
                background: '#EF4444',
                color: '#FFFFFF',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '1rem',
                transform: 'rotate(-10deg)',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)'
              }}>
                {outOfStockText}
              </span>
            </div>
          )}

          {/* Quick Add Button - Shows on Hover */}
          {!isOutOfStock && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px',
              background: `linear-gradient(to top, ${c.overlay}, transparent)`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              opacity: isHovering ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: isHovering ? 'auto' : 'none'
            }}>
              <button
                onClick={handleAddToCart}
                style={{
                  background: `linear-gradient(135deg, ${c.secondary} 0%, #B8860B 100%)`,
                  color: '#FFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(212, 160, 23, 0.3)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(212, 160, 23, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 160, 23, 0.3)'
                }}
              >
                <span>🛒</span>
                {addText}
              </button>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div style={{
          padding: '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Product Name */}
          <h3 style={{
            fontSize: '1.1rem',
            fontWeight: '700',
            color: isOutOfStock ? c.textLight : c.textDark,
            margin: 0,
            lineHeight: 1.3,
            textDecoration: isOutOfStock ? 'line-through' : 'none',
            transition: 'color 0.3s ease'
          }}>
            {product.name}
          </h3>

          {/* Rating Section */}
          {rating > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: c.secondary, fontWeight: '700' }}>⭐ {rating.toFixed(1)}</span>
              {reviews > 0 && (
                <span style={{ color: c.textLight }}>
                  ({reviews} {reviews === 1 ? safeT(t, 'review', 'review') : safeT(t, 'reviews', 'reviews')})
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p style={{
              fontSize: '0.8rem',
              color: c.textLight,
              margin: '4px 0',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {product.description}
            </p>
          )}

          {/* Flavors/Variants */}
          {product.flavors && product.flavors.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: c.textLight,
              flexWrap: 'wrap'
            }}>
              <span>🍬</span>
              {product.flavors.slice(0, 2).map((flavor, idx) => (
                <span key={idx} style={{
                  background: c.background,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  color: c.textDark,
                  fontWeight: '600'
                }}>
                  {flavor}
                </span>
              ))}
              {product.flavors.length > 2 && (
                <span style={{ color: c.textLight, fontWeight: '600' }}>+{product.flavors.length - 2}</span>
              )}
            </div>
          )}

          {/* Price & Details Section */}
          <div style={{
            marginTop: 'auto',
            borderTop: `1px solid ${c.border}`,
            paddingTop: '10px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              {/* FIX: Dynamic currency display — reads from LocationContext */}
              <span style={{
                color: c.secondary,
                fontSize: '1.4rem',
                fontWeight: '800'
              }}>
                {formatPrice(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span style={{
                  color: c.textLight,
                  fontSize: '0.8rem',
                  textDecoration: 'line-through'
                }}>
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {/* Pieces per box info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              color: c.textLight
            }}>
              <span>📦</span>
              <span>{product.piecesPerBox} {piecesText}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
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
        @keyframes slideOut {
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-30px);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </Link>
  )
}