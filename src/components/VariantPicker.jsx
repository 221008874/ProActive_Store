// Colour and size picker for the product page.
//
// Presentational: every decision (which sizes exist, whether one is sold out,
// what to do when the colour changes) lives in utils/variantSelection.js and is
// unit tested there. This component only renders the result.

import { useMemo } from 'react'
import {
  colorsOf,
  sizesOf,
  selectionIsComplete,
  isLowStock,
  maxAddableQuantity,
  stockOf
} from '../utils/variantSelection.js'
import { loc } from '../utils/i18n.js'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function VariantPicker({
  product,
  selection,
  onColorChange,
  onSizeChange,
  quantityInCart = 0,
  c,
  t
}) {
  const colors = useMemo(() => colorsOf(product), [product])
  const sizes = useMemo(() => sizesOf(product, selection?.colorId), [product, selection?.colorId])

  if (!colors.length) return null

  const ready = selectionIsComplete(product, selection)
  const low = isLowStock(product, selection)
  const remaining = maxAddableQuantity(product, selection, quantityInCart)

  return (
    <div style={{ marginBottom: '24px' }}>

      {/* ---- colours ---- */}
      <p style={{
        fontWeight: '700', color: c.textDark, margin: '0 0 12px 0',
        fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <span>🎨</span>
        {t('selectColor') || loc(product.colors?.[0]?.name) || 'Colour'}
        {selection?.colorId && (
          <span style={{ color: c.textMuted, fontWeight: '500' }}>
            · {loc(colors.find((x) => x.id === selection.colorId)?.name)}
          </span>
        )}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {colors.map((color) => {
          const active = selection?.colorId === color.id
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onColorChange?.(color.id)}
              disabled={!color.inStock}
              aria-pressed={active}
              aria-label={loc(color.name)}
              title={loc(color.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px',
                background: active ? `linear-gradient(135deg, ${c.secondary}, #B8860B)` : c.background,
                color: active ? '#FFFFFF' : c.textDark,
                border: active ? `2px solid ${c.secondary}` : `2px solid ${c.border}`,
                borderRadius: '20px',
                fontWeight: '700', fontSize: '0.85rem',
                cursor: color.inStock ? 'pointer' : 'not-allowed',
                opacity: color.inStock ? 1 : 0.4,
                transition: 'all 0.2s ease'
              }}
            >
              {color.hex && (
                <span style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: color.hex, border: '1px solid rgba(0,0,0,0.15)',
                  display: 'inline-block'
                }} />
              )}
              {loc(color.name, t?.lang)}
            </button>
          )
        })}
      </div>

      {/* ---- sizes ---- */}
      {selection?.colorId && sizes.length > 0 && (
        <>
          <p style={{
            fontWeight: '700', color: c.textDark, margin: '20px 0 12px 0',
            fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span>📏</span>
            {t('selectSize') || 'Size'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {sizes.map(({ size, stock, inStock }) => {
              const active = selection?.size === size
              const soldOut = !inStock
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onSizeChange?.(size)}
                  disabled={soldOut}
                  aria-pressed={active}
                  style={{
                    minWidth: '52px',
                    padding: '10px 14px',
                    position: 'relative',
                    background: active ? `linear-gradient(135deg, ${c.secondary}, #B8860B)` : c.background,
                    color: active ? '#FFFFFF' : c.textDark,
                    border: active ? `2px solid ${c.secondary}` : `2px solid ${c.border}`,
                    borderRadius: '10px',
                    fontWeight: '700', fontSize: '0.9rem',
                    cursor: soldOut ? 'not-allowed' : 'pointer',
                    opacity: soldOut ? 0.35 : 1,
                    // Crossed out rather than hidden: the shopper still needs
                    // to see that this size exists.
                    textDecoration: soldOut ? 'line-through' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {size}
                  {!soldOut && stock <= 3 && (
                    <span style={{
                      position: 'absolute', top: '-8px', right: '-6px',
                      background: c.warning, color: '#fff',
                      fontSize: '0.6rem', fontWeight: '800',
                      borderRadius: '8px', padding: '2px 6px'
                    }}>
                      {stock}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ---- availability ---- */}
      <div style={{ marginTop: '14px', minHeight: '20px' }}>
        {!ready && selection?.colorId && (
          <p style={{ color: c.danger, fontSize: '0.85rem', fontWeight: '600' }}>
            {t('selectSizeFirst') || 'Please choose an available size.'}
          </p>
        )}

        {ready && remaining <= 0 && (
          <p style={{ color: c.danger, fontSize: '0.85rem', fontWeight: '600' }}>
            {t('maxInCart') || 'You already have all available units in your cart.'}
          </p>
        )}

        {ready && low && remaining > 0 && (
          <p style={{ color: c.warning, fontSize: '0.85rem', fontWeight: '600' }}>
            {t('onlyLeft', { count: stockOf(product, selection) }) ||
              `Only ${stockOf(product, selection)} left!`}
          </p>
        )}
      </div>
    </div>
  )
}