// Ad-hoc DOM probe used while fixing the review items. Not part of the build.
import { chromium } from 'playwright'
import { buildSnapshot } from './ui-fixture.mjs'

const routes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/home', '/shop', '/cart']

const snapshot = buildSnapshot()
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 }, locale: 'ar-EG' })
await ctx.addInitScript(() => { localStorage.setItem('language', 'ar'); localStorage.setItem('theme', 'light') })
await ctx.route('**/api/catalog*', (r) => r.fulfill({ json: snapshot }))
await ctx.route('**/api/product*', (r) => r.fulfill({ json: snapshot.products[0] }))
await ctx.route('**/api/geocode*', (r) => r.fulfill({ json: [] }))
await ctx.route('https://ipapi.co/**', (r) => r.fulfill({ json: { country_code: 'EG' } }))
const page = await ctx.newPage()

const measure = () => page.evaluate(() => {
  const box = (s) => {
    const e = document.querySelector(s)
    if (!e) return s + ': MISSING'
    const r = e.getBoundingClientRect()
    return s + ': ' + Math.round(r.left) + '..' + Math.round(r.right) + ' (w ' + Math.round(r.width) + ')'
  }
  return [
    box('.pa-announce .pa-container'),
    box('.pa-header .pa-container'),
    box('.pa-hero-wrap'),
    box('.pa-cats'),
    box('.pa-grid'),
    box('.pa-section__head'),
    box('.pa-about'),
    box('.pa-layout-shop'),
    box('.pa-sidebar-filters'),
    box('.pa-footer__inner')
  ]
})

for (const r of routes) {
  await page.goto('http://localhost:5173' + r, { waitUntil: 'networkidle' })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(250)
  console.log('=== ' + r)
  console.log((await measure()).join('\n'))
}

await browser.close()