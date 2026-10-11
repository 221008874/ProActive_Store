import { it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Runtime smoke test: renders each route and asserts real .pa-* markup comes
// out. Catches what the bundler cannot (missing props, undefined components, a
// design-system export that stopped existing).
//
// Leaflet and Firestore are mocked: they are hard browser/network dependencies
// and are not what this test is about.

if (typeof window === 'undefined') {
  const mkEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} })
  const doc = {
    documentElement: { dataset: {}, style: {}, setAttribute() {}, lang: '', dir: '' },
    body: { style: {}, appendChild() {}, className: '' },
    head: { appendChild() {} },
    createElement: mkEl,
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {}
  }
  globalThis.window = {
    document: doc,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280, innerHeight: 800,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  }
  globalThis.document = doc
  globalThis.localStorage = window.localStorage
}
if (typeof requestAnimationFrame === 'undefined') globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)

vi.mock('leaflet', () => ({
  default: {
    map: () => ({ setView() {}, remove() {}, on() {}, addLayer() {} }),
    tileLayer: () => ({ addTo() {} }),
    marker: () => ({ addTo() {}, on() {}, setLatLng() {} }),
    icon: () => ({}),
    Marker: { prototype: { options: {} } }
  }
}))
vi.mock('leaflet/dist/leaflet.css', () => ({ default: '' }))
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: '' }))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: '' }))
vi.mock('../services/firebase.js', () => ({ db: {}, auth: {} }))

const { MemoryRouter } = await import('react-router-dom')
const React = (await import('react')).default
const { renderToString } = await import('react-dom/server')
const { default: App } = await import('../App.jsx')
const { LanguageProvider } = await import('../context/LanguageContext.jsx')
const { ThemeProvider } = await import('../context/ThemeContext.jsx')
const { CartProvider } = await import('../context/CartContext.jsx')
const { WishlistProvider } = await import('../context/WishlistContext.jsx')
const { ToastProvider } = await import('../ui/overlays.jsx')

const routes = [
  '/',
  '/splash',
  '/home',
  '/cart',
  '/product/nope',
  '/about',
  '/privacy',
  '/terms-of-service',
  '/coupon/EGP-TEST',
  '/order-success',
  '/payment/success',
  '/payment/cancel',
  // Added with the shell pass: the browse grid, with filters in the URL, and
  // the wishlist page. Both must render through the same chrome as /home.
  '/shop',
  '/shop?category=dresses&sizes=M&colors=red&sale=1&sort=priceAsc&min=100&max=900',
  '/saved'
]

// The shell reads settings and categories from Firestore, which is mocked away
// above, so those reads reject. That must not stop a route from rendering: the
// chrome falls back to the store's default threshold and an empty mega-menu.
const shell = (r) =>
  renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [r] },
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(
              WishlistProvider,
              null,
              React.createElement(CartProvider, null, React.createElement(App))
            )
          )
        )
      )
    )
  )

it('every route renders design-system markup', () => {
  const failures = []
  for (const r of routes) {
    try {
      const html = shell(r)
      const pa = (html.match(/class="[^"]*pa-/g) || []).length
      console.log(`${pa > 0 ? 'OK  ' : 'FAIL'} ${r}  (${html.length} bytes, ${pa} .pa-* nodes)`)
      if (pa === 0) failures.push(r)
    } catch (e) {
      console.log(`FAIL ${r}: ${e.message}`)
      failures.push(r)
    }
  }
  expect(failures).toEqual([])
})

it('does not claim the shopper is offline when the browser is online', () => {
  // The banner used to render unconditionally, so every page announced "you are
  // offline" while sitting on a live connection. navigator.onLine is true in the
  // test environment and the hook starts optimistic, so the banner must be
  // absent here.
  const html = shell('/home')
  expect(html).not.toContain('pa-offline')
  expect(html).not.toContain('offline')
})

it('the offline message is fully Arabic, with no English word inside it', () => {
  // The Arabic copy had the literal English word "offline" spliced into the
  // middle of the sentence: "انت offline. بنعرض...".
  const source = readFileSync(new URL('../components/StoreChrome.jsx', import.meta.url), 'utf8')
  expect(source).not.toMatch(/انت\s+offline/)
  expect(source).toContain('انت غير متصل')
})

