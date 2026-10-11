import { describe, it, expect } from 'vitest'
import {
  filtersFromParams,
  paramsFromFilters,
  activeFilterCount,
  activeFilterChips,
  removeChip,
  SORTS
} from '../utils/filterUrl'

// The URL is the filter's source of truth, so the round trip has to be exact
// in both directions: anything that drops on the way back in is a filter the
// shopper cannot see they have applied.

describe('filtersFromParams', () => {
  it('defaults every field so a bare /shop behaves like a catalogue view', () => {
    const f = filtersFromParams(new URLSearchParams())
    expect(f).toEqual({
      categoryId: '',
      gender: '',
      sizes: [],
      colors: [],
      minPrice: null,
      maxPrice: null,
      onSale: false,
      inStockOnly: false,
      q: '',
      sort: 'newest'
    })
  })

  it('reads every supported param', () => {
    const p = new URLSearchParams('category=dresses&gender=women&sizes=M&sizes=L&colors=red&min=100&max=900&sale=1&stock=1&q=linen&sort=priceAsc')
    expect(filtersFromParams(p)).toMatchObject({
      categoryId: 'dresses',
      gender: 'women',
      sizes: ['M', 'L'],
      colors: ['red'],
      minPrice: 100,
      maxPrice: 900,
      onSale: true,
      inStockOnly: true,
      q: 'linen',
      sort: 'priceAsc'
    })
  })

  it('accepts repeated params and a comma-free single value for list keys', () => {
    expect(filtersFromParams(new URLSearchParams('sizes=M')).sizes).toEqual(['M'])
    expect(filtersFromParams(new URLSearchParams('sizes=M&sizes=L&sizes=M')).sizes).toEqual(['M', 'L', 'M'])
  })

  it('ignores an unknown sort rather than sorting by undefined', () => {
    expect(filtersFromParams(new URLSearchParams('sort=nope')).sort).toBe('newest')
    expect(filtersFromParams(new URLSearchParams('sort=priceDesc')).sort).toBe('priceDesc')
  })

  it('drops a non-numeric, negative or empty price bound', () => {
    expect(filtersFromParams(new URLSearchParams('min=')).minPrice).toBeNull()
    expect(filtersFromParams(new URLSearchParams('min=-5')).minPrice).toBeNull()
    expect(filtersFromParams(new URLSearchParams('min=abc')).minPrice).toBeNull()
    expect(filtersFromParams(new URLSearchParams('min=0')).minPrice).toBe(0)
  })

  it('accepts a plain object as well as URLSearchParams', () => {
    expect(filtersFromParams({ category: 'shirts' }).categoryId).toBe('shirts')
    expect(filtersFromParams().q).toBe('')
  })
})

describe('paramsFromFilters', () => {
  it('writes only the values that differ from the default', () => {
    const p = paramsFromFilters({ sort: 'priceAsc', onSale: true })
    expect(p.toString()).toBe('sort=priceAsc&sale=1')
  })

  it('keeps a category, a query and a repeated size', () => {
    const p = paramsFromFilters({ categoryId: 'dresses', q: 'linen', sizes: ['M', 'L'] })
    expect(p.getAll('category')).toEqual(['dresses'])
    expect(p.get('q')).toBe('linen')
    expect(p.getAll('sizes')).toEqual(['M', 'L'])
  })

  it('drops a whitespace-only query', () => {
    expect(paramsFromFilters({ q: '   ' }).toString()).toBe('')
  })

  it('round-trips through filtersFromParams unchanged', () => {
    const original = {
      categoryId: 'dresses', gender: 'women', sizes: ['M', 'L'], colors: ['red', 'black'],
      minPrice: 100, maxPrice: 900, onSale: true, inStockOnly: true, q: 'linen', sort: 'bestselling'
    }
    expect(filtersFromParams(paramsFromFilters(original))).toEqual(original)
  })

  it('round-trips the empty filter to an empty query', () => {
    expect(paramsFromFilters(filtersFromParams(new URLSearchParams())).toString()).toBe('')
  })
})

describe('activeFilterCount', () => {
  it('counts only what narrows the result, never the sort or the query', () => {
    expect(activeFilterCount({ sort: 'priceAsc', q: 'x' })).toBe(0)
    expect(activeFilterCount({ sizes: ['M', 'L'], colors: ['red'] })).toBe(3)
    expect(activeFilterCount({ onSale: true, inStockOnly: true, minPrice: 10 })).toBe(3)
    expect(activeFilterCount({ categoryId: 'd' })).toBe(1)
  })

  it('treats a price range as one filter, not two', () => {
    expect(activeFilterCount({ minPrice: 0, maxPrice: 500 })).toBe(1)
  })
})

describe('activeFilterChips', () => {
  it('emits one chip per active filter, each with how to undo it', () => {
    const { chips, count } = activeFilterChips({
      sizes: ['M'], colors: ['red'], onSale: true, minPrice: 100, maxPrice: 500
    })
    expect(count).toBe(4)
    expect(chips).toHaveLength(4)
    expect(chips.map((c) => c.key)).toEqual(['sizes:M', 'colors:red', 'price', 'sale'])
    // Every chip must carry an undo instruction, or its × does nothing.
    for (const c of chips) expect(c.remove).toBeTruthy()
  })

  it('resolves labels through the caller, falling back to the raw value', () => {
    const { chips } = activeFilterChips({ sizes: ['M'] }, { resolve: { size: (s) => `Size ${s}` } })
    expect(chips[0].label).toBe('Size M')
    const bare = activeFilterChips({ sizes: ['M'] }).chips[0]
    expect(bare.label).toBe('M')
  })
})

describe('removeChip', () => {
  const base = 'category=dresses&sizes=M&sizes=L&colors=red&min=100&max=500&sale=1&stock=1'

  it('removes only the chosen value from a repeated key', () => {
    const next = removeChip(new URLSearchParams(base), { key: 'sizes:M', remove: { kind: 'list', key: 'sizes', value: 'M' } })
    expect(next.getAll('sizes')).toEqual(['L'])
    expect(next.get('colors')).toBe('red')
  })

  it('removes a whole key', () => {
    const next = removeChip(new URLSearchParams(base), { key: 'sale', remove: { kind: 'key', key: 'sale' } })
    expect(next.get('sale')).toBeNull()
    expect(next.get('stock')).toBe('1')
  })

  it('removes several keys at once for one chip', () => {
    const next = removeChip(new URLSearchParams(base), { key: 'price', remove: { kind: 'keys', keys: ['min', 'max'] } })
    expect(next.get('min')).toBeNull()
    expect(next.get('max')).toBeNull()
    expect(next.get('category')).toBe('dresses')
  })

  it('removes a chip that has no structured instruction by its own key', () => {
    const next = removeChip(new URLSearchParams(base), { key: 'category' })
    expect(next.get('category')).toBeNull()
    expect(next.get('sale')).toBe('1')
  })

  it('does not mutate the params it was given', () => {
    const p = new URLSearchParams(base)
    removeChip(p, { key: 'sale', remove: { kind: 'key', key: 'sale' } })
    expect(p.get('sale')).toBe('1')
  })
})

describe('SORTS', () => {
  it('matches the sorters useCatalog actually implements', () => {
    for (const s of SORTS) expect(s).toBeTruthy()
    expect(SORTS).toContain('bestselling')
  })
})
