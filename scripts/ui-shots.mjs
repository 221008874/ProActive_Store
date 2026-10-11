// UI screenshot harness.
//
//   node scripts/ui-shots.mjs [--out shots] [--only 1,3] [--tag before]
//
// Drives the dev server in a real Chromium at every width the review calls out,
// in RTL and LTR and in both themes, and writes one PNG per (screen, width,
// dir, theme). The catalogue is stubbed at the network layer so a layout bug is
// reproducible without a populated database.
//
// Screens: home, shop, product, bag, gate.
//
// Usage:
//   npm run dev                     # in another shell
//   node scripts/ui-shots.mjs --tag before
//   node scripts/ui-shots.mjs --only 1 --tag after

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { buildSnapshot, buildEmptySnapshot } from './ui-fixture.mjs'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const BASE_URL = arg('base', 'http://localhost:5173')
const OUT = arg('out', 'shots')
const TAG = arg('tag', 'run')
const ONLY = arg('only', '') ? arg('only', '').split(',') : null
const WIDTHS = arg('widths', '1920,1440,1024,768,390').split(',').map(Number)
const DIRS = ['ar', 'en']
const THEMES = ['light', 'dark']

const SCREENS = {
  1: ['shop'],
  2: ['shop'],
  3: ['home'],
  4: ['home', 'shop'],
  5: ['home'],
  6: ['home'],
  7: ['home'],
  8: ['shop'],
  9: ['gate'],
  10: ['home'],
  11: ['home'],
  12: ['home', 'shop', 'product', 'bag']
}

function screensFor(item) {
  if (ONLY) return ONLY.flatMap((n) => SCREENS[n] ?? [])
  return ['home', 'shop', 'product', 'bag', 'gate']
}

const problems = []

const browser = await chromium.launch()
await mkdir(OUT, { recursive: true })

for (const width of WIDTHS) {
  for (const dir of DIRS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width, height: width >= 1024 ? 1000 : 844 },
        deviceScaleFactor: 1,
        locale: dir === 'ar' ? 'ar-EG' : 'en-EG',
        colorScheme: theme
      })

      await context.addInitScript(
        ({ lang, theme }) => {
          localStorage.setItem('language', lang)
          localStorage.setItem('theme', theme)
        },
        { lang: dir === 'ar' ? 'ar' : 'en', theme }
      )

      const snapshot = buildSnapshot()
      const emptySnapshot = buildEmptySnapshot()

      // The catalogue is the only network dependency the layout needs.
      await context.route('**/api/catalog*', async (route) => {
        const url = route.request().url()
        if (url.includes('empty=1')) {
          return route.fulfill({ json: emptySnapshot })
        }
        return route.fulfill({ json: snapshot })
      })
      await context.route('**/api/product*', async (route) => {
        const product = snapshot.products.find((p) => route.request().url().includes(p.id)) ?? snapshot.products[0]
        return route.fulfill({ json: product })
      })
      await context.route('**/api/geocode*', (route) => route.fulfill({ json: [] }))
      await context.route('https://ipapi.co/**', (route) => route.fulfill({ json: { country_code: 'EG' } }))
      // The real Firebase config is not reachable from the harness; stub the
      // auth surface so nothing throws on a sign-in check.
      await context.route('**/identitytoolkit.googleapis.com/**', (route) =>
        route.fulfill({ status: 400, json: { error: { message: 'stub' } } }))

      const page = await context.newPage()
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !/firebase|Failed to load resource|net::/i.test(msg.text())) {
          problems.push(`[console ${width}/${dir}/${theme}] ${msg.text()}`)
        }
      })

      const routes = {
        home: '/home',
        shop: '/shop',
        product: `/product/${snapshot.products[0].id}`,
        bag: '/cart',
        gate: '/'
      }

      for (const screen of screensFor('all')) {
        if (!routes[screen]) continue
        await page.goto(`${BASE_URL}${routes[screen]}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(350)

        const name = `${OUT}/${TAG}-${screen}-${width}-${dir}-${theme}.png`
        await page.screenshot({ path: name, fullPage: false })

        // Measurements the review asks for, recorded next to the picture.
        const audit = await page.evaluate(() => {
          const doc = document.documentElement

          // An element wider than the viewport is only a defect when nothing
          // between it and the root scrolls: rails and the filter sheet are
          // meant to overflow their own box.
          const inScroller = (el) => {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const ox = getComputedStyle(p).overflowX
              if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true
            }
            return false
          }

          const overflowing = [...document.querySelectorAll('body *')]
            .filter((el) => {
              const r = el.getBoundingClientRect()
              if (r.width === 0 || inScroller(el)) return false
              return r.right > window.innerWidth + 1 || r.left < -1
            })
            .slice(0, 6)
            .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`)

          return {
            hScroll: doc.scrollWidth > doc.clientWidth ? `${doc.scrollWidth}>${doc.clientWidth}` : null,
            overflowing
          }
        })
        if (audit.hScroll) problems.push(`[h-scroll ${screen} ${width}/${dir}/${theme}] ${audit.hScroll}`)
        if (audit.overflowing.length) {
          problems.push(`[overflow ${screen} ${width}/${dir}/${theme}] ${audit.overflowing.join(', ')}`)
        }
      }

      await context.close()
    }
  }
}

await browser.close()

const report = problems.length ? problems.join('\n') : 'no layout problems detected'
await writeFile(`${OUT}/${TAG}-report.txt`, report, 'utf8')
console.log(report)