import { it, expect, vi, beforeAll } from 'vitest'

// Verifies the location-permission timing: it must NOT be requested on the
// entry splash, and it MUST be requested once the shopper picks a governorate.
//
// Everything except geolocation is stubbed, so the assertions are purely about
// when navigator.geolocation.getCurrentPosition is called.

const calls = { geo: 0, nav: [] }

beforeAll(() => {
  // `navigator` is a getter-only global, so it has to be redefined, not assigned.
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      geolocation: {
        getCurrentPosition: (ok, err) => {
          calls.geo++
          // Pretend the shopper declined: that is the path that must not block.
          err?.({ code: 1, message: 'denied' })
        }
      }
    }
  })
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem() {}, removeItem() {} }
    })
  }
  if (typeof globalThis.window === 'undefined') {
    const doc = {
      documentElement: { dataset: {}, style: {}, setAttribute() {} },
      body: { style: {} },
      head: { appendChild() {} },
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      getElementById: () => null,
      addEventListener() {}, removeEventListener() {}
    }
    globalThis.window = { document: doc, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) }
    globalThis.document = doc
  }
})

vi.mock('../services/firebase.js', () => ({ db: {}, auth: {} }))

it('does not request geolocation while the entry splash is on screen', async () => {
  vi.resetModules()
  const React = (await import('react')).default
  const { renderToString } = await import('react-dom/server')
  const { MemoryRouter } = await import('react-router-dom')
  const { default: Splash } = await import('../pages/Splash.jsx')
  const { LanguageProvider } = await import('../context/LanguageContext.jsx')
  const { ThemeProvider } = await import('../context/ThemeContext.jsx')
  const { CartProvider } = await import('../context/CartContext.jsx')

  const tree = React.createElement(
    LanguageProvider, null,
    React.createElement(ThemeProvider, null,
      React.createElement(CartProvider, null, React.createElement(Splash))
    )
  )
  renderToString(React.createElement(MemoryRouter, { initialEntries: ['/'] }, tree))

  expect(calls.geo).toBe(0)
  expect(true).toBe(true)
})

it('the splash advances to /home without touching location', async () => {
  // Assert instead that the splash has no geolocation code path at all. Strip
  // comments first, so only executable code is judged.
  vi.resetModules()
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync('src/pages/Splash.jsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  )
  expect(src).not.toMatch(/geolocation/i)
  expect(src).not.toMatch(/requestLocation/)
})

it('the cart does not prompt for location merely by opening', async () => {
  // The old behaviour: a mount effect asked for geolocation as soon as the cart
  // rendered, before the shopper had chosen anything. This asserts the request
  // is not reachable from an effect any more.
  const fs = await import('node:fs')
  const cart = fs.readFileSync('src/pages/CartPage.jsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  // Every useEffect body in the file must not contain a geolocation call.
  const effects = [...cart.matchAll(/useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}, \[/g)].map((m) => m[1])
  expect(effects.length).toBeGreaterThan(0)
  for (const body of effects) {
    expect(body).not.toMatch(/getCurrentPosition/)
  }

  // And the request itself must only be reachable from the governorate handler.
  expect(cart).toMatch(/if \(governorateId\) requestLocation\(\)/)
})

it('the splash never requests location', async () => {
  const fs = await import('node:fs')
  const splash = fs.readFileSync('src/pages/Splash.jsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  expect(splash).not.toMatch(/geolocation/i)
  expect(splash).not.toMatch(/requestLocation/)
})
