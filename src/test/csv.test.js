// Tests for the CSV parser used by the admin import route
// (api/_core/csv.js) - quoted fields, embedded commas/newlines and escaped
// quotes are exactly where hand-rolled parsers break.

import { describe, it, expect } from 'vitest'
import { parseCsv } from '../../api/_core/csv.js'
import { normalizeRow } from '../../api/admin/import.js'

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
