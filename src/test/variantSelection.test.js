import { describe, it, expect } from 'vitest'
import {
  colorsOf,
  sizesOf,
  initialSelection,
  selectColor,
  selectSize,
  selectedVariant,
  selectionIsComplete,
  stockOf,
  maxAddableQuantity,
  imagesForColor,
  primaryImage,
  isLowStock,
  buildOrderLine,
  purchasableVariants,
  LOW_STOCK_THRESHOLD
} from '../utils/variantSelection'

const product = {
  id: 'dress',
  price: 450,
  compareAtPrice: 600,
  colors: [
    { id: 'red', name: { en: 'Red', ar: 'أحمر' }, hex: '#dd1111' },
    { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#111111' }
  ],
  sizes: ['S', 'M', 'L'],
  images: [
    { url: 'red-1', color: 'red', isPrimary: true },
    { url: 'red-2', color: 'red' },
    { url: 'black-1', color: 'black' }
  ],
  variants: [
    { id: 'red_M', colorId: 'red', color: 'Red', size: 'M', stock: 5, active: true },
    { id: 'red_L', colorId: 'red', color: 'Red', size: 'L', stock: 2, active: true },
    { id: 'red_S', colorId: 'red', color: 'Red', size: 'S', stock: 0, active: true },
    { id: 'black_M', colorId: 'black', color: 'Black', size: 'M', stock: 1, active: true },
    { id: 'black_L', colorId: 'black', color: 'Black', size: 'L', stock: 4, active: false }
  ]
}

describe('variantSelection - colours and sizes', () => {
  it('lists colours from the product definition with stock flags', () => {
    const colors = colorsOf(product)
    expect(colors.map((c) => c.id)).toEqual(['red', 'black'])
    expect(colors[0].name).toEqual({ en: 'Red', ar: 'أحمر' })
    expect(colors[0].hex).toBe('#dd1111')
    expect(colors.every((c) => c.inStock)).toBe(true)
  })

  it('falls back to the colours the variants declare', () => {
    const colors = colorsOf({ variants: [{ colorId: 'red', size: 'M', stock: 1, active: true }] })
    expect(colors).toEqual([{ id: 'red', name: { en: 'red', ar: 'red' }, hex: null, inStock: true }])
  })

  it('marks a colour with no purchasable variant as out of stock', () => {
    const colors = colorsOf({
      colors: [{ id: 'red', name: { en: 'Red' } }, { id: 'gone', name: { en: 'Gone' } }],
      variants: [{ colorId: 'red', size: 'M', stock: 2, active: true }]
    })
    expect(colors[0].inStock).toBe(true)
    expect(colors[1].inStock).toBe(false)
  })

  it('lists the sizes of one colour with per-size stock', () => {
    const sizes = sizesOf(product, 'red')
    expect(sizes.map((s) => s.size)).toEqual(['M', 'L', 'S'])
    expect(sizes.find((s) => s.size === 'S').inStock).toBe(false)
    expect(sizes.find((s) => s.size === 'L').stock).toBe(2)
  })

  it('returns no sizes without a colour', () => {
    expect(sizesOf(product, null)).toEqual([])
    expect(colorsOf(null)).toEqual([])
  })

  it('keeps only purchasable variants in the helper', () => {
    expect(purchasableVariants(product).map((v) => v.id)).toEqual(['red_M', 'red_L', 'black_M'])
  })
})

describe('variantSelection - choosing', () => {
  it('starts on the first purchasable colour and size', () => {
    expect(initialSelection(product)).toEqual({ colorId: 'red', size: 'M' })
  })

  it('skips a sold-out first size', () => {
    const p = {
      colors: [{ id: 'red', name: { en: 'Red' } }],
      variants: [
        { colorId: 'red', size: 'S', stock: 0, active: true },
        { colorId: 'red', size: 'M', stock: 3, active: true }
      ]
    }
    expect(initialSelection(p)).toEqual({ colorId: 'red', size: 'M' })
  })

  it('starts unselected when nothing is purchasable', () => {
    const soldOut = { colors: [{ id: 'red', name: { en: 'R' } }], variants: [{ colorId: 'red', size: 'M', stock: 0, active: true }] }
    expect(initialSelection(soldOut)).toEqual({ colorId: null, size: null })
  })

  it('keeps the size when the new colour still has it', () => {
    expect(selectColor(product, { colorId: 'red', size: 'M' }, 'red')).toEqual({ colorId: 'red', size: 'M' })
    expect(selectColor(product, { colorId: 'red', size: 'L' }, 'red')).toEqual({ colorId: 'red', size: 'L' })
  })

  it('picks a valid size when switching colour invalidates the old one', () => {
    // red/L does not exist in black, so it must fall back to black's first
    // purchasable size
    expect(selectColor(product, { colorId: 'red', size: 'L' }, 'black')).toEqual({
      colorId: 'black',
      size: 'M'
    })
  })

  it('clears the size when a colour has no variants at all', () => {
    const p = { colors: [{ id: 'red', name: { en: 'R' } }], variants: [{ colorId: 'red', size: 'M', stock: 1, active: true }] }
    expect(selectColor(p, { colorId: 'red', size: 'M' }, 'blue')).toEqual({ colorId: 'blue', size: null })
  })

  it('does not let a sold-out size be selected', () => {
    expect(selectSize(product, 'red', 'S').size).toBe('S')
    expect(selectionIsComplete(product, selectSize(product, 'red', 'S'))).toBe(false)
    expect(selectionIsComplete(product, selectSize(product, 'red', 'M'))).toBe(true)
  })

  it('reports completeness and stock for a selection', () => {
    expect(selectionIsComplete(product, { colorId: 'red', size: 'M' })).toBe(true)
    expect(selectionIsComplete(product, { colorId: null, size: null })).toBe(false)
    expect(stockOf(product, { colorId: 'red', size: 'L' })).toBe(2)
  })

  it('resolves the selected variant document', () => {
    expect(selectedVariant(product, { colorId: 'red', size: 'M' }).id).toBe('red_M')
    expect(selectedVariant(product, { colorId: 'red', size: null })).toBeNull()
  })
})

describe('variantSelection - quantity limits', () => {
  it('caps the quantity at the remaining stock', () => {
    expect(maxAddableQuantity(product, { colorId: 'red', size: 'M' })).toBe(5)
    expect(maxAddableQuantity(product, { colorId: 'red', size: 'M' }, 2)).toBe(3)
  })

  it('allows nothing once the stock is already in the cart', () => {
    expect(maxAddableQuantity(product, { colorId: 'black', size: 'M' }, 1)).toBe(0)
  })

  it('flags low stock up to the threshold', () => {
    expect(isLowStock(product, { colorId: 'black', size: 'M' })).toBe(true)
    expect(isLowStock(product, { colorId: 'red', size: 'L' })).toBe(true)
    expect(isLowStock(product, { colorId: 'red', size: 'M' })).toBe(false)
    expect(LOW_STOCK_THRESHOLD).toBe(3)
  })

  it('never reports low stock for a sold-out variant', () => {
    expect(isLowStock(product, { colorId: 'red', size: 'S' })).toBe(false)
  })
})

describe('variantSelection - gallery', () => {
  it('narrows to the selected colour', () => {
    expect(imagesForColor(product, 'red').map((i) => i.url)).toEqual(['red-1', 'red-2'])
    expect(imagesForColor(product, 'black').map((i) => i.url)).toEqual(['black-1'])
  })

  it('falls back to every image when none match the colour', () => {
    expect(imagesForColor(product, 'green')).toHaveLength(3)
    expect(imagesForColor(product, null)).toHaveLength(3)
  })

  it('picks the primary image within the colour', () => {
    expect(primaryImage(product, 'red')).toBe('red-1')
    expect(primaryImage(product, 'black')).toBe('black-1')
  })

  it('returns null when there are no images', () => {
    expect(primaryImage({ images: [] }, 'red')).toBeNull()
    expect(primaryImage({}, 'red')).toBeNull()
  })
})

describe('variantSelection - order line', () => {
  it('builds the productId / variantId / qty the transaction expects', () => {
    expect(buildOrderLine(product, { colorId: 'red', size: 'L' }, 3)).toEqual({
      productId: 'dress',
      variantId: 'red_L',
      qty: 3
    })
  })

  it('sanitises the quantity', () => {
    expect(buildOrderLine(product, { colorId: 'red', size: 'M' }, 0).qty).toBe(1)
    expect(buildOrderLine(product, { colorId: 'red', size: 'M' }, '2').qty).toBe(2)
    expect(buildOrderLine(product, { colorId: 'red', size: 'M' }, 2.9).qty).toBe(2)
  })
})