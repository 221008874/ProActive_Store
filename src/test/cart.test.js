import { describe, it, expect } from 'vitest'
import {
  lineKey,
  sameLine,
  findLine,
  quantityOf,
  addLine,
  removeLine,
  setLineQuantity,
  reconcileCart,
  cartSubtotal,
  cartCount,
  CART_STORAGE_KEY
} from '../utils/cartLogic'

const line = (over = {}) => ({
  id: 'dress:red_M',
  productId: 'dress',
  variantId: 'red_M',
  title: { en: 'Dress', ar: 'فستان' },
  color: 'Red',
  size: 'M',
  price: 450,
  stock: 5,
  quantity: 1,
  ...over
})

describe('cartLogic - line keys', () => {
  it('combines product and variant', () => {
    expect(lineKey('dress', 'red_M')).toBe('dress:red_M')
  })

  it('falls back to the product alone when there is no variant (legacy lines)', () => {
    expect(lineKey('dress')).toBe('dress')
    expect(lineKey('dress', '')).toBe('dress')
  })

  it('keeps sizes of the same product as separate lines', () => {
    expect(lineKey('dress', 'red_M')).not.toBe(lineKey('dress', 'red_L'))
  })

  it('compares lines by key', () => {
    expect(sameLine({ id: 'a' }, { id: 'a' })).toBe(true)
    expect(sameLine({ id: 'a' }, { id: 'b' })).toBe(false)
  })
})

describe('cartLogic - adding', () => {
  it('appends a new line', () => {
    const { items, error } = addLine([], line(), 1)
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(1)
    expect(error).toBeNull()
  })

  it('merges a repeat of the same variant', () => {
    const first = addLine([], line(), 2)
    const second = addLine(first.items, line(), 3)
    expect(second.items).toHaveLength(1)
    expect(second.items[0].quantity).toBe(5)
  })

  it('keeps different variants of one product apart', () => {
    const a = addLine([], line(), 1)
    const b = addLine(a.items, line({ id: 'dress:red_L', variantId: 'red_L', size: 'L' }), 1)
    expect(b.items).toHaveLength(2)
  })

  it('refuses to exceed the live stock', () => {
    const first = addLine([], line(), 3)
    const second = addLine(first.items, line(), 3)
    expect(second.error.type).toBe('STOCK_LIMIT')
    expect(second.items[0].quantity).toBe(3)
  })

  it('refuses a new line larger than stock', () => {
    const { items, error } = addLine([], line({ stock: 2 }), 5)
    expect(error.type).toBe('STOCK_LIMIT')
    expect(items).toHaveLength(0)
  })

  it('ignores a non-positive quantity', () => {
    const { items } = addLine([], line(), 0)
    expect(items).toHaveLength(0)
  })
})

describe('cartLogic - updating and removing', () => {
  it('sets a quantity within stock', () => {
    const start = addLine([], line(), 1).items
    const { items, error } = setLineQuantity(start, 'dress:red_M', 3, 5)
    expect(items[0].quantity).toBe(3)
    expect(error).toBeNull()
  })

  it('refuses a quantity above stock and leaves the line alone', () => {
    const start = addLine([], line(), 1).items
    const { items, error } = setLineQuantity(start, 'dress:red_M', 9, 5)
    expect(error.type).toBe('STOCK_LIMIT')
    expect(items[0].quantity).toBe(1)
  })

  it('drops the line when the quantity reaches zero', () => {
    const start = addLine([], line(), 2).items
    expect(setLineQuantity(start, 'dress:red_M', 0, 5).items).toHaveLength(0)
  })

  it('treats a negative quantity as zero and drops the line', () => {
    const start = addLine([], line(), 2).items
    expect(setLineQuantity(start, 'dress:red_M', -3, 5).items).toHaveLength(0)
  })

  it('removes a line by key without touching siblings', () => {
    const a = addLine([], line(), 1).items
    const b = addLine(a, line({ id: 'dress:red_L', variantId: 'red_L' }), 1).items
    const after = removeLine(b, 'dress:red_M')
    expect(after).toHaveLength(1)
    expect(after[0].id).toBe('dress:red_L')
  })

  it('finds a line and its quantity', () => {
    const items = addLine([], line(), 3).items
    expect(findLine(items, 'dress:red_M').quantity).toBe(3)
    expect(findLine(items, 'nope')).toBeNull()
    expect(quantityOf(items, 'nope')).toBe(0)
  })
})

describe('cartLogic - reconcile against live data', () => {
  const items = [
    { ...line(), quantity: 2 },
    { id: 'shirt:blue_L', productId: 'shirt', variantId: 'blue_L', title: { en: 'Shirt' }, color: 'Blue', size: 'L', price: 300, stock: 5, quantity: 1 }
  ]

  it('keeps a healthy line as-is', () => {
    const { items: out, issues } = reconcileCart(items, {
      'dress:red_M': { stock: 5, price: 450, active: true },
      'shirt:blue_L': { stock: 5, price: 300, active: true }
    })
    expect(out).toHaveLength(2)
    expect(out[0].quantity).toBe(2)
    expect(issues).toHaveLength(0)
  })

  it('drops a line whose variant no longer exists', () => {
    const { items: out, issues } = reconcileCart(items, {})
    expect(out).toHaveLength(0)
    expect(issues.map((i) => i.reason)).toEqual(['unavailable', 'unavailable'])
  })

  it('drops a deactivated variant', () => {
    const { items: out, issues } = reconcileCart(items, {
      'dress:red_M': { stock: 5, price: 450, active: false },
      'shirt:blue_L': { stock: 5, price: 300, active: true }
    })
    expect(out).toHaveLength(1)
    expect(issues[0].reason).toBe('unavailable')
  })

  it('clamps a line that is now over stock and says so', () => {
    const { items: out, issues } = reconcileCart(items, {
      'dress:red_M': { stock: 1, price: 450, active: true },
      'shirt:blue_L': { stock: 5, price: 300, active: true }
    })
    expect(out[0].quantity).toBe(1)
    expect(issues[0].reason).toBe('reduced')
  })

  it('removes a line that sold out completely', () => {
    const { items: out, issues } = reconcileCart(items, {
      'dress:red_M': { stock: 0, price: 450, active: true },
      'shirt:blue_L': { stock: 5, price: 300, active: true }
    })
    expect(out).toHaveLength(1)
    expect(issues[0].reason).toBe('sold_out')
  })

  it('reprices a line whose price changed', () => {
    const { items: out } = reconcileCart(items, {
      'dress:red_M': { stock: 5, price: 500, active: true },
      'shirt:blue_L': { stock: 5, price: 300, active: true }
    })
    expect(out[0].price).toBe(500)
  })

  it('produces a readable message including colour and size', () => {
    const { issues } = reconcileCart(items, {})
    expect(issues[0].message).toContain('Dress')
    expect(issues[0].message).toContain('Red / M')
  })

  it('leaves the input untouched', () => {
    const input = [{ ...line(), quantity: 2 }]
    const snapshot = JSON.stringify(input)
    reconcileCart(input, { 'dress:red_M': { stock: 9, price: 1, active: true } })
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('cartLogic - totals', () => {
  const items = [
    { ...line(), price: 450, quantity: 2 },
    { id: 'shirt:blue_L', productId: 'shirt', variantId: 'blue_L', price: 300, quantity: 1 }
  ]

  it('sums price x quantity across lines', () => {
    expect(cartSubtotal(items)).toBe(1200)
  })

  it('counts units, not lines', () => {
    expect(cartCount(items)).toBe(3)
    expect(cartCount(items)).not.toBe(items.length)
  })

  it('handles an empty cart', () => {
    expect(cartSubtotal([])).toBe(0)
    expect(cartCount([])).toBe(0)
  })

  it('uses a versioned storage key so old carts are dropped', () => {
    expect(CART_STORAGE_KEY).toBe('cart_v2')
    expect(CART_STORAGE_KEY).not.toBe('cart')
  })
})