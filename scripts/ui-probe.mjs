// Ad-hoc DOM probe used while fixing the review items. Not part of the build.
import { chromium } from 'playwright'
import { buildSnapshot } from './ui-fixture.mjs'

const snapshot = buildSnapshot()
const browser = await chromium.launch()

async function shot(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ar-EG' })
  await ctx.addInitScript(() => { localStorage.setItem('language', 'ar'); localStorage.setItem('theme', 'light') })
  await ctx.route('**/api/catalog*', (r) => r.fulfill({ json: snapshot }))
  await ctx.route('https://ipapi.co/**', (r) => r.fulfill({ json: { country_code: 'EG' } }))
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => document.querySelectorAll('.pa-sheet').length)
  const sidebar = await page.evaluate(() => document.querySelectorAll('.pa-sidebar-filters').length)
  const filterBtn = page.getByRole('button', { name: /تصفية|Filter/ }).first()
  const hasFilterBtn = await filterBtn.count()
  let after = 'n/a (desktop: no filter button)'
  if (hasFilterBtn) {
    await filterBtn.click()
    await page.waitForTimeout(400)
    after = await page.evaluate(() => document.querySelectorAll('.pa-sheet').length)
  }
  await page.screenshot({ path: `shots/probe-sheet-${width}.png` })
  let closed = 'n/a'
  if (hasFilterBtn) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    closed = await page.evaluate(() => document.querySelectorAll('.pa-sheet').length)
  }
  console.log(`${width}px  sidebar=${sidebar}  sheet closed=${before}  open=${after}  after Escape=${closed}`)
  await ctx.close()
}

await shot(390)
await shot(1440)
await browser.close()