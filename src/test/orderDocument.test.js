// Tests for the document store: path allowlist, GitHub client, the
// order-document pipeline and the server-side invoice renderer.
//
// The pipeline tests run against the same fake Firestore as the order tests,
// with the GitHub client replaced by a recording stub - so they prove what
// gets archived (path, bytes, sha, metadata row) without touching a network.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { createFakeFirestore } from './fakeFirestore'
import { isValidDocumentPath, parseDocumentPath, safeFileName, buildRepositoryPath } from '../../server/_core/documentPath.js'
import { githubStore, DocumentStoreNotConfiguredError } from '../../server/_core/githubStore.js'
import { applyCors, handlePreflight } from '../../server/_core/cors.js'
import { generateOrderDocument, getOrderDocumentMeta, DOC_TYPES, documentRepositoryPath } from '../../server/_core/orderDocumentCore.js'
import { buildInvoiceDoc, renderInvoice, securityHashFor, toMillis } from '../../server/_core/invoiceDoc.js'

const ORDER = {
  orderNumber: 'PA-LZ3K9X2',
  status: 'pending',
  paymentMethod: 'cod',
  source: 'web',
  customer: { name: 'Jane Doe', phone: '01012345678', email: 'jane@example.com' },
  address: {
    governorate: 'Cairo',
    city: 'Giza',
    street: '12 Elm Street',
    building: '3B',
    lat: 30.04,
    lng: 31.23,
    notes: 'call on arrival'
  },
  items: [
    { productId: 'dress', variantId: 'red_M', title: 'Summer Dress', color: 'Red', size: 'M', unitPrice: 450, qty: 2, lineTotal: 900 }
  ],
  subtotal: 900,
  discount: 90,
  shippingCost: 60,
  total: 870,
  coupon: { code: 'SAVE10', type: 'fixed', value: 90 },
  createdAt: 1728000000000
}

function seedOrder(db, id = 'o1', overrides = {}) {
  db.__seed(`orders_egp/${id}`, { ...ORDER, ...overrides })
  return id
}

function makeStoreStub() {
  const puts = []
  return {
    puts,
    putFile: async (path, content, message) => {
      puts.push({ path, content, message })
      return { commit: { sha: 'COMMITSHA' }, content: { sha: 'BLOBSHA' } }
    }
  }
}

describe('documentPath - allowlist', () => {
  it('accepts the four-segment shape this app writes', () => {
    expect(isValidDocumentPath('orders_egp/invoice/PA-LZ3K9X2/1728000000000-INV-PA-LZ3K9X2.pdf')).toBe(true)
  })

  it('rejects traversal, absolute paths and wrong segment names', () => {
    expect(isValidDocumentPath('../etc/passwd/x/1-a.pdf')).toBe(false)
    expect(isValidDocumentPath('/orders_egp/invoice/PA-1/1-a.pdf')).toBe(false)
    expect(isValidDocumentPath('orders_egp/invoice/PA-1/a.pdf')).toBe(false) // stamp must be numeric
    expect(isValidDocumentPath('Orders_EGP/invoice/PA-1/1-a.pdf')).toBe(false) // module is lowercase
    expect(isValidDocumentPath('orders_egp/invoice/PA-1/1-')).toBe(false) // empty file name
    expect(isValidDocumentPath('orders_egp/invoice/PA-1/1-a b.pdf')).toBe(false) // space in name
    expect(isValidDocumentPath('a/b/c/1-' + 'x'.repeat(201))).toBe(false)
  })

  it('rejects an over-long path but accepts a long document reference', () => {
    expect(isValidDocumentPath('a'.repeat(501))).toBe(false)
    expect(isValidDocumentPath('orders_egp/invoice/' + 'PA-'.padEnd(128, 'X') + '/1-a.pdf')).toBe(true)
  })

  it('parses the four segments back out', () => {
    const parsed = parseDocumentPath('orders_egp/invoice/PA-LZ3K9X2/1728000000000-INV-PA-LZ3K9X2.pdf')
    expect(parsed).toEqual({
      module: 'orders_egp',
      referenceType: 'invoice',
      referenceId: 'PA-LZ3K9X2',
      stamp: '1728000000000',
      fileName: 'INV-PA-LZ3K9X2.pdf'
    })
    expect(parseDocumentPath('nope')).toBeNull()
  })

  it('sanitises file names instead of trusting them', () => {
    expect(safeFileName('INV PA-1 .pdf')).toBe('INV_PA-1_.pdf')
    expect(safeFileName('.hidden')).toBe('_hidden')
    expect(safeFileName('')).toBe('file')
    expect(safeFileName('x'.repeat(400)).length).toBe(200)

    // traversal survives nowhere: no slash, no dot-run, only safe characters
    const dangerous = safeFileName('../../etc/passwd')
    expect(dangerous).not.toContain('/')
    expect(dangerous).not.toContain('..')
    expect(dangerous).toContain('etc_passwd')
  })

  it('builds the repository path from the parts', () => {
    const path = buildRepositoryPath({
      module: 'orders_egp',
      referenceType: 'invoice',
      referenceId: 'PA-LZ3K9X2',
      fileName: 'INV PA-LZ3K9X2.pdf',
      now: 1728000000000
    })
    expect(path).toBe('orders_egp/invoice/PA-LZ3K9X2/1728000000000-INV_PA-LZ3K9X2.pdf')
  })
})

describe('githubStore - Contents API client', () => {
  const originalEnv = { ...process.env }
  let fetchMock

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'tok'
    process.env.GITHUB_OWNER = 'owner'
    process.env.GITHUB_REPO = 'repo'
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    delete globalThis.fetch
  })

  it('reports configuration from the environment', () => {
    expect(githubStore.isConfigured()).toBe(true)
    delete process.env.GITHUB_REPO
    expect(githubStore.isConfigured()).toBe(false)
  })

  it('puts base64 content to the right repo path', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: { sha: 'x' } }) })
    await githubStore.putFile('orders_egp/invoice/PA-1/1-a.pdf', 'QUJD', 'msg')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/owner/repo/contents/orders_egp/invoice/PA-1/1-a.pdf')
    expect(init.method).toBe('PUT')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ message: 'msg', content: 'QUJD', branch: 'main' })
  })

  it('reads bytes back as base64', async () => {
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode('hello').buffer })
    const out = await githubStore.getFile('orders_egp/invoice/PA-1/1-a.pdf')
    expect(out).toBe(Buffer.from('hello').toString('base64'))
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe('application/vnd.github.v3.raw')
  })

  it('treats deleting a missing file as idempotent success', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' })
    await expect(githubStore.deleteFile('orders_egp/invoice/PA-1/1-a.pdf')).resolves.toEqual({
      deleted: false,
      reason: 'not_found'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deletes by sha after a metadata read', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'SHA123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const result = await githubStore.deleteFile('orders_egp/invoice/PA-1/1-a.pdf')
    expect(result).toEqual({ deleted: true })
    const [, second] = fetchMock.mock.calls[1]
    expect(second.method).toBe('DELETE')
    expect(JSON.parse(second.body).sha).toBe('SHA123')
  })

  it('refuses to run without configuration', async () => {
    delete process.env.GITHUB_TOKEN
    await expect(githubStore.putFile('a/b/c/1-a.pdf', 'x')).rejects.toThrow(DocumentStoreNotConfiguredError)
  })

  it('surfaces GitHub failures', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    await expect(githubStore.putFile('a/b/c/1-a.pdf', 'x')).rejects.toThrow(/GitHub write failed \(500\)/)
  })
})

describe('orderDocumentCore - archive pipeline', () => {  let db

  beforeEach(() => {
    db = createFakeFirestore()
  })

  it('renders, uploads and writes the metadata row', async () => {
    const store = makeStoreStub()
    const result = await generateOrderDocument(db, seedOrder(db), { store, now: 1728000000123 })

    expect(result.status).toBe('ready')
    const [put] = store.puts
    expect(put.path).toBe('orders_egp/invoice/PA-LZ3K9X2/1728000000123-INV-PA-LZ3K9X2.pdf')
    expect(put.message).toContain('PA-LZ3K9X2')

    const meta = await getOrderDocumentMeta(db, 'o1', 'invoice')
    expect(meta).toMatchObject({
      docType: 'invoice',
      format: 'pdf',
      status: 'ready',
      repositoryPath: put.path,
      orderNumber: 'PA-LZ3K9X2',
      invoiceNumber: 'PA-LZ3K9X2',
      customerName: 'Jane Doe',
      commitSha: 'COMMITSHA'
    })
    expect(meta.bytes).toBeGreaterThan(1000)
    // the row's sha is the hash of the exact bytes that were uploaded
    const uploadedSha = createHash('sha256').update(Buffer.from(put.content, 'base64')).digest('hex')
    expect(meta.sha256).toBe(uploadedSha)
  })

  it('writes an admin audit row alongside', async () => {
    const store = makeStoreStub()
    await generateOrderDocument(db, seedOrder(db), { store })
    const logs = await db.collection('admin_logs').where('action', '==', 'order_document_archived').get()
    expect(logs.docs).toHaveLength(1)
    expect(logs.docs[0].data().target).toBe('o1')
  })

  it('is idempotent: a second run skips, uploads nothing', async () => {
    const store = makeStoreStub()
    seedOrder(db)
    await generateOrderDocument(db, 'o1', { store })
    const second = await generateOrderDocument(db, 'o1', { store })
    expect(second.status).toBe('skipped')
    expect(second.reason).toBe('exists')
    expect(store.puts).toHaveLength(1)
  })

  it('records a failure and throws when the store refuses', async () => {
    const store = { putFile: async () => { throw new Error('GitHub write failed (500): boom') } }
    seedOrder(db)
    await expect(generateOrderDocument(db, 'o1', { store })).rejects.toThrow(/GitHub write failed/)
    const meta = await getOrderDocumentMeta(db, 'o1', 'invoice')
    expect(meta.status).toBe('failed')
    expect(meta.lastError).toContain('boom')
  })

  it('retries a previously failed document on the next run', async () => {
    const failing = { putFile: async () => { throw new Error('down') } }
    const working = makeStoreStub()
    seedOrder(db)
    await expect(generateOrderDocument(db, 'o1', { store: failing })).rejects.toThrow()
    const retried = await generateOrderDocument(db, 'o1', { store: working })
    expect(retried.status).toBe('ready')
    expect(working.puts).toHaveLength(1)
  })

  it('refuses an unknown order and an unknown document type', async () => {
    const store = makeStoreStub()
    await expect(generateOrderDocument(db, 'nope', { store })).rejects.toThrow('ORDER_NOT_FOUND')
    seedOrder(db)
    await expect(generateOrderDocument(db, 'o1', { store, docType: 'delivery_slip' })).rejects.toThrow(
      /UNKNOWN_DOC_TYPE/
    )
  })

  it('builds repository paths per document type', () => {
    expect(DOC_TYPES.invoice.referenceType).toBe('invoice')
    const path = documentRepositoryPath('invoice', ORDER, 5)
    expect(path).toBe('orders_egp/invoice/PA-LZ3K9X2/5-INV-PA-LZ3K9X2.pdf')
  })
})

describe('invoiceDoc - server-side invoice content', () => {
  it('derives the security hash from the order id, deterministically', () => {
    const expected = createHash('sha256').update('o1').digest('hex').slice(0, 8).toUpperCase()
    expect(securityHashFor('o1')).toBe(expected)
    expect(securityHashFor('o1')).toBe(securityHashFor('o1'))
  })

  it('reads epoch millis from every timestamp shape', () => {
    expect(toMillis(1728000000000)).toBe(1728000000000)
    expect(toMillis(new Date(1728000000000))).toBe(1728000000000)
    expect(toMillis({ toMillis: () => 7 })).toBe(7)
    expect(toMillis({ toDate: () => new Date(1728000000000) })).toBe(1728000000000)
    expect(toMillis(null)).toBeNull()
    expect(toMillis('2024-01-01')).toBeNull()
  })

  it('carries the real order number, date, address, coupon and totals', () => {
    const { doc, meta } = buildInvoiceDoc({ order: ORDER, orderId: 'o1' })
    const body = JSON.stringify(doc.content)

    expect(meta.invoiceNumber).toBe('PA-LZ3K9X2')
    expect(meta.createdAtMs).toBe(1728000000000) // the order's date, not render time
    expect(doc.info.creationDate.toISOString()).toBe(new Date(1728000000000).toISOString())

    expect(body).toContain('PA-LZ3K9X2') // order number
    expect(body).toContain('Jane Doe') // customer name
    expect(body).toContain('01012345678') // phone
    expect(body).toContain('12 Elm Street') // street (the browser copy dropped it)
    expect(body).toContain('Giza, Cairo') // city + governorate
    expect(body).toContain('3B') // building
    expect(body).toContain('call on arrival') // notes
    expect(body).toContain('30.04000') // pin latitude
    expect(body).toContain('Discount (SAVE10)') // coupon code on the discount row
    expect(body).toContain('870 EGP') // total due
    expect(body).toContain('60 EGP') // shipping is charged
    // "FREE" only appears as its own text node when shipping was waived
    expect(body).not.toContain('"FREE"')
  })

  it('marks a pending COD order as payment pending', () => {
    const { doc } = buildInvoiceDoc({ order: ORDER, orderId: 'o1' })
    expect(JSON.stringify(doc.content)).toContain('PAYMENT PENDING')
  })

  it('marks a delivered order as payment confirmed', () => {
    const { doc } = buildInvoiceDoc({ order: { ...ORDER, status: 'delivered' }, orderId: 'o1' })
    expect(JSON.stringify(doc.content)).toContain('PAYMENT CONFIRMED')
  })

  it('switches Arabic text to the Cairo font', () => {
    const { doc } = buildInvoiceDoc({
      order: { ...ORDER, customer: { name: 'محمد أحمد', phone: '01012345678' } },
      orderId: 'o1'
    })
    const billedTo = JSON.stringify(doc.content[4])
    expect(billedTo).toContain('Cairo')
  })

  it('renders a real PDF with the committed font', async () => {
    const { buffer, securityHash } = await renderInvoice({
      order: { ...ORDER, customer: { name: 'محمد أحمد', phone: '01012345678' } },
      orderId: 'o1'
    })
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(5000)
    expect(buffer.includes(Buffer.from('Cairo'))).toBe(true) // the font is embedded
    expect(securityHash).toBe(securityHashFor('o1'))
  })
})

// The admin panel is deployed on its own domain, so these are the headers
// that let its authenticated call through a browser preflight at all.
describe('cors - admin panel origins', () => {
  const originalEnv = { ...process.env }
  let res

  beforeEach(() => {
    process.env.ADMIN_ALLOWED_ORIGINS = 'https://pro-active-admin.vercel.app'
    res = {
      headers: {},
      statusCode: null,
      body: null,
      ended: false,
      setHeader(key, value) { this.headers[key.toLowerCase()] = value },
      status(code) { this.statusCode = code; return this },
      end() { this.ended = true; return this }
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('echoes an allowlisted origin and lists the admin needs', () => {
    expect(applyCors({ headers: { origin: 'https://pro-active-admin.vercel.app' } }, res)).toBe(true)
    expect(res.headers['access-control-allow-origin']).toBe('https://pro-active-admin.vercel.app')
    expect(res.headers['access-control-allow-headers']).toContain('authorization')
    expect(res.headers['access-control-allow-methods']).toContain('GET')
    expect(res.headers.vary).toBe('Origin')
  })

  it('refuses any origin that is not on the allowlist', () => {
    expect(applyCors({ headers: { origin: 'https://evil.example' } }, res)).toBe(false)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('refuses everything when no origin is configured (fail closed)', () => {
    delete process.env.ADMIN_ALLOWED_ORIGINS
    expect(applyCors({ headers: { origin: 'https://pro-active-admin.vercel.app' } }, res)).toBe(false)
  })

  it('answers the preflight with 204 and the allowed methods', () => {
    const handled = handlePreflight(
      { method: 'OPTIONS', headers: { origin: 'https://pro-active-admin.vercel.app' } },
      res,
      'GET, OPTIONS'
    )
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
    expect(res.headers.allow).toBe('GET, OPTIONS')
  })
})
