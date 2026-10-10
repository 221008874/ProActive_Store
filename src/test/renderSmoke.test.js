import { it, expect, vi } from 'vitest'

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

const routes = [
  '/home',
  '/cart',
  '/product/nope',
  '/about',
  '/privacy',
  '/terms-of-service',
  '/coupon/EGP-TEST',
  '/order-success'
]

it('every route renders design-system markup', () => {
  const failures = []
  for (const r of routes) {
    try {
      const tree = React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(CartProvider, null, React.createElement(App))
        )
      )
      const html = renderToString(
        React.createElement(MemoryRouter, { initialEntries: [r] }, tree)
      )
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

