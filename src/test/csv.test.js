// Tests for the CSV parser used by the admin import route
// (api/_core/csv.js) - quoted fields, embedded commas/newlines and escaped
// quotes are exactly where hand-rolled parsers break.

import { describe, it, expect } from 'vitest'
import { parseCsv } from '../../server/_core/csv.js'
import { normalizeRow, validateRowPricing } from '../../server/admin/import.js'

const HEADER = 'productSlug,titleEn,titleAr,category,price,compareAt,color,size,stock,imageUrl'

describe('csv parser', () => {
  it('parses the import template header and rows into records', () => {
    const rows = parseCsv(`${HEADER}\nsummer-dress,Summer Dress,فستان صيفي,dresses,450,600,red,M,5,https://img/a.jpg`)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      productSlug: 'summer-dress',
      titleEn: 'Summer Dress',
      price: '450',
      color: 'red',
      size: 'M',
      stock: '5'
    })
  })

  it('keeps commas inside quoted fields', () => {
    const rows = parseCsv(`${HEADER}\n"summer, dress",Dress,,dresses,450,,red,M,5,`)
    expect(rows[0].productSlug).toBe('summer, dress')
  })

  it('keeps newlines inside quoted fields', () => {
    const rows = parseCsv(`${HEADER}\n"summer\ndress",Dress,,dresses,450,,red,M,5,`)
    expect(rows[0].productSlug).toBe('summer\ndress')
  })

  it('unescapes doubled quotes', () => {
    const rows = parseCsv(`${HEADER}\n"say ""hi""",Dress,,dresses,450,,red,M,5,`)
    expect(rows[0].productSlug).toBe('say "hi"')
  })

  it('handles CRLF line endings and a BOM', () => {
    const rows = parseCsv(`\uFEFF${HEADER}\r\nsummer-dress,Dress,,dresses,450,,red,M,5,\r\n`)
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0])[0]).toBe('productSlug')
  })

  it('skips blank lines', () => {
    const rows = parseCsv(`${HEADER}\n\nsummer-dress,D,,d,1,,r,S,1,\n\n`)
    expect(rows).toHaveLength(1)
  })

  it('fills missing trailing cells instead of shifting columns', () => {
    const rows = parseCsv(`${HEADER}\nsummer-dress,Dress`)
    expect(rows[0].productSlug).toBe('summer-dress')
    expect(rows[0].price).toBe('')
  })

  it('refuses a file with no header row', () => {
    expect(() => parseCsv('')).toThrow(/no header row/)
    expect(() => parseCsv('\n\n')).toThrow(/no header row/)
  })
})

describe('import row normalisation', () => {
  it('maps any header casing onto the camelCase names the import reads', () => {
    expect(normalizeRow({ PRODUCTSLUG: 'dress', titleen: 'Dress', CompareAt: '600', IMAGEURL: 'https://img/a.jpg' }))
      .toEqual({ productSlug: 'dress', titleEn: 'Dress', compareAt: '600', imageUrl: 'https://img/a.jpg' })
  })

  it('keeps the canonical casing and drops unknown columns', () => {
    expect(normalizeRow({ productSlug: 'dress', notes: 'ignore me' })).toEqual({ productSlug: 'dress' })
  })
})

describe('import row pricing', () => {
  // The import forces status "active" on every row it writes, so a price that
  // fails here becomes a live, buyable, free product. These are the values the
  // old `Number(row.price ?? 0)` accepted.
  for (const [label, price] of [
    ['missing price', undefined],
    ['empty price', ''],
    ['zero price', '0'],
    ['negative price', '-50'],
    ['non-numeric price', 'abc'],
    ['null price', null]
  ]) {
    it(`refuses a ${label}`, () => {
      const out = validateRowPricing({ productSlug: 'dress', price })
      expect(out.ok, `${label} must be refused`).toBe(false)
      expect(out.error).toBe('BAD_PRICE')
    })
  }

  it('accepts a normal price', () => {
    expect(validateRowPricing({ price: '450' })).toEqual({ ok: true, price: 450, compareAtPrice: null })
  })

  it('accepts a decimal price', () => {
    expect(validateRowPricing({ price: '449.5' })).toEqual({ ok: true, price: 449.5, compareAtPrice: null })
  })

  it('requires a compare-at above the price, when present', () => {
    expect(validateRowPricing({ price: '450', compareAt: '600' }))
      .toEqual({ ok: true, price: 450, compareAtPrice: 600 })
    expect(validateRowPricing({ price: '450', compareAt: '450' }).error).toBe('BAD_COMPARE')
    expect(validateRowPricing({ price: '450', compareAt: '400' }).error).toBe('BAD_COMPARE')
    expect(validateRowPricing({ price: '450', compareAt: 'abc' }).error).toBe('BAD_COMPARE')
  })
})
