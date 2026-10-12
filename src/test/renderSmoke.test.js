import { it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import fs from 'node:fs'

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

/** Render a page component directly, bypassing App's lazy routes. */
const page = (Page) =>
  renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/'] },
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
              React.createElement(CartProvider, null, React.createElement(Page))
            )
          )
        )
      )
    )
  )

/** The full app shell through App (for routes that are NOT lazy). */
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
  '/payment/cancel',
  // Added with the shell pass: the browse grid, with filters in the URL, and
  // the wishlist page. Both must render through the same chrome as /home.
  '/shop',
  '/shop?category=dresses&sizes=M&colors=red&sale=1&sort=priceAsc&min=100&max=900',
  '/saved'
]

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

/* ---------------------------------------------------------------------------
 * Fix round 3 structural guards.
 *
 * Each of these was a defect the review found in the *rendered* output, and
 * each is cheap to assert on the server-rendered HTML. Asserting them here means
 * a regression fails `npm test` in CI rather than waiting for the next round of
 * screenshots to notice.
 * ------------------------------------------------------------------------ */

/** Every route that renders inside StoreChrome, i.e. the ones a footer bug
 *  would show up on. The country gate and splash own the whole viewport and
 *  legitimately render no footer. */
const chromeRoutes = routes.filter(
  (r) => r !== '/' && r !== '/splash'
)

it('every route renders exactly ONE footer', () => {
  // About, Privacy and Terms each rendered their own <StoreFooter/> on top of
  // the one StoreChrome already renders, so those three pages stacked two
  // identical footers. The chrome owns the footer; a page that renders its own
  // is the bug.
  const failures = []
  for (const r of chromeRoutes) {
    const count = (shell(r).match(/<footer/g) || []).length
    if (count !== 1) failures.push(`${r} rendered ${count} footers`)
  }
  expect(failures).toEqual([])
})

it('no page under src/pages renders its own StoreFooter', () => {
  // The structural half of the guard above: it fails at `npm test` on the
  // offending file rather than only on the route that happens to include it.
  // StoreChrome.jsx is the single legal owner and is not under src/pages.
  const dir = new URL('../pages/', import.meta.url)
  const offenders = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsx'))
    .filter((f) => /<StoreFooter\s*\/>/.test(stripComments(fs.readFileSync(new URL(f, dir), 'utf8'))))

  expect(offenders).toEqual([])
})

it('no page imports StoreFooter directly', () => {
  const dir = new URL('../pages/', import.meta.url)
  const offenders = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsx'))
    .filter((f) => /from\s+['"]\.\.\/components\/StoreFooter['"]/.test(
      fs.readFileSync(new URL(f, dir), 'utf8')
    ))

  expect(offenders).toEqual([])
})

it('renders no emoji anywhere in the Store', () => {
  // The spec forbids emoji. They render differently on every platform, cannot
  // be sized with the type, and screen readers announce them as their own words
  // ("party popper"). Rather than enumerate a blocklist that will rot, this
  // scans the rendered HTML for anything in the pictograph ranges.
  //
  // Ranges: U+1F000–U+1FAFF (symbols & pictographs), U+2600–U+27BF (misc symbols
  // + dingbats), U+2B00–U+2BFF. Arrows are deliberately NOT included: a bare →
  // in a sentence is typography, not a pictograph.
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu
  // U+FE0F (VARIATION SELECTOR-16) is a combining mark that only ever follows a
  // pictograph, so it is matched outside the class rather than inside it —
  // a class containing a combining character is a misleading character class.
  const VARIATION_SELECTOR = /\uFE0F/gu

  const failures = []
  for (const r of chromeRoutes) {
    const html = shell(r)
    const hits = [
      ...[...html.matchAll(EMOJI)].map((m) => m[0]),
      ...[...html.matchAll(VARIATION_SELECTOR)].map(() => 'U+FE0F')
    ]
    if (hits.length) failures.push(`${r}: ${JSON.stringify(hits)}`)
  }
  expect(failures).toEqual([])
})

/** Strip JS/CSS comments so a guard that scans source is not tripped by a
 *  comment *describing* the emoji it exists to prevent — which is exactly the
 *  kind of false positive that gets a guard switched off. */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')

it('no source file under src/ carries a literal emoji', () => {
  // The source half of the guard: catches an emoji in a string table or a
  // component that has not reached a route the smoke test covers yet.
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === 'test' || entry.name === 'node_modules') return []
      const full = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
      return entry.isDirectory() ? walk(full) : [full]
    })

  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
  const offenders = []
  for (const file of walk(new URL('../', import.meta.url))) {
    if (!/\.(jsx?|css|html)$/.test(file.pathname)) continue
    stripComments(fs.readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line, i) => {
        if (EMOJI.test(line)) offenders.push(`${file.pathname}:${i + 1}`)
      })
  }
  expect(offenders).toEqual([])
})

it('the footer carries no stray bag-count line and no bag link in "Help"', () => {
  // P1.4: the delivery column ended with a hardcoded "0 في العربية", and the
  // help column ended with a link whose Arabic label is "العربية" — the same
  // word as the language toggle — pointing at /cart. Between them they read as
  // two language controls, one of which navigated to the bag.
  const html = shell('/home')
  expect(html).not.toContain('في العربية')
  // The bag is reachable from the header, the tab bar and /cart; the help
  // column is for help.
  const helpColumn = html.slice(html.indexOf('pa-footer__title'))
  expect(helpColumn).not.toContain('href="/cart"')
})

it('the language and theme toggles name their action and expose their state', () => {
  const html = shell('/home')
  // aria-pressed so the theme toggle announces which mode it is in …
  expect(html).toContain('aria-pressed="false"')
  // … and a label that says what pressing it will do.
  expect(html).toMatch(/aria-label="[^"]*(Light mode|Dark mode|الوضع [^"]*)"/)
})

it('the info pages put the heading inside the same container as the body', async () => {
  // P0.3: the <h1> used to sit outside .pa-container while the prose sat
  // inside it, so in RTL the title's start edge was flush with the viewport and
  // the first glyphs were clipped. Both must now be inside .pa-info__col.
  const { default: PrivacyPolicy } = await import('../pages/PrivacyPolicy.jsx')
  const { default: AboutUs } = await import('../pages/AboutUs.jsx')
  const { default: TermsOfService } = await import('../pages/TermsOfService.jsx')
  for (const [name, Page] of [
    ['/privacy', PrivacyPolicy],
    ['/about', AboutUs],
    ['/terms-of-service', TermsOfService]
  ]) {
    const html = page(Page)
    expect(html, name).toContain('pa-info__col')
    const col = html.slice(html.indexOf('pa-info__col'))
    expect(col.indexOf('<h1'), `${name}: no h1 inside the reading column`).toBeGreaterThan(-1)
  }
})

it('the info pages render a localised date, not a hand-written literal', async () => {
  // The old markup hardcoded "February 1, 2026" / "February 13, 2026" as text,
  // so an Arabic page showed an English month name and neither could be
  // localised. Now it goes through Intl and lands in a <time datetime="...">.
  const { default: PrivacyPolicy } = await import('../pages/PrivacyPolicy.jsx')
  const { default: AboutUs } = await import('../pages/AboutUs.jsx')
  const { default: TermsOfService } = await import('../pages/TermsOfService.jsx')
  for (const [name, Page] of [
    ['/privacy', PrivacyPolicy],
    ['/about', AboutUs],
    ['/terms-of-service', TermsOfService]
  ]) {
    const html = page(Page)
    // SSR serializes the React prop `dateTime` not the HTML attr `datetime`
    expect(html, name).toMatch(/<time dateTime="\d{4}-\d{2}-\d{2}T[^"]*">/)
    expect(html, name).not.toMatch(/>\s*February\s+\d/)
  }
})

it('the back link is a text link above the title, not a button beside it', async () => {
  const { default: PrivacyPolicy } = await import('../pages/PrivacyPolicy.jsx')
  const { default: AboutUs } = await import('../pages/AboutUs.jsx')
  const { default: TermsOfService } = await import('../pages/TermsOfService.jsx')
  for (const [name, Page] of [
    ['/privacy', PrivacyPolicy],
    ['/about', AboutUs],
    ['/terms-of-service', TermsOfService]
  ]) {
    const html = page(Page)
    expect(html, name).toContain('pa-info__back')
    // It must precede the heading: a control in the flex row beside the title is
    // what landed flush against the screen edge in RTL.
    expect(html.indexOf('pa-info__back'), `${name}: back link after the title`).toBeLessThan(
      html.indexOf('<h1')
    )
  }
})

it('the size facet offers no 2XL', async () => {
  // P1.6: XXL and 2XL are the same size, so the facet showed it twice and both
  // entries filtered identically.
  const { CANONICAL_SIZES } = await import('../services/catalog.js')
  expect(CANONICAL_SIZES).not.toContain('2XL')
  expect(new Set(CANONICAL_SIZES).size).toBe(CANONICAL_SIZES.length)
})

