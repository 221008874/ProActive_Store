import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Every component a page renders must actually be bound in that file.
//
// ProductDetail shipped `<IconWhatsApp>` and `<BottomSheet>` with neither name
// imported: a JSX tag that resolves to no binding is a free identifier, so it
// stays in the emitted bundle as a global reference. The bundler does not
// complain, ESLint does not check JSX identifiers without react/jsx-no-undef,
// and renderToString never reached the branch - so the product page, the one
// page every shopper must see, threw ReferenceError in production.
//
// This is the check that would have caught it.

const FILES = [
  '../pages/ProductDetail.jsx',
  '../pages/Home.jsx',
  '../pages/ShopPage.jsx',
  '../pages/CartPage.jsx',
  '../pages/SavedPage.jsx',
  '../pages/OrderSuccess.jsx',
  '../pages/PaymentCancel.jsx',
  '../pages/CouponLanding.jsx',
  '../pages/CountryGate.jsx',
  '../pages/Splash.jsx',
  '../pages/checkout/BagStep.jsx',
  '../pages/checkout/DeliveryStep.jsx',
  '../pages/checkout/ReviewStep.jsx',
  '../pages/checkout/OrderSummary.jsx',
  '../pages/checkout/CouponBox.jsx',
  '../components/StoreChrome.jsx',
  '../components/StoreFooter.jsx',
  '../components/LocationPicker.jsx'
]

/** Strip comments so prose about a tag does not read as a use of it. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Capitalised JSX tags, i.e. components - lowercase ones are host elements. */
function componentsUsedIn(source) {
  const names = new Set()
  for (const match of source.matchAll(/<\/?([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1])
  return names
}

function importBlocks(source) {
  return [...source.matchAll(/import[\s\S]*?from\s*['"][^'"]+['"]/g)].map((m) => m[0])
}

function isBound(source, name, imports) {
  const word = new RegExp(`\\b${name}\\b`)
  if (imports.some((block) => word.test(block))) return true
  if (new RegExp(`function\\s+${name}\\b`).test(source)) return true
  if (new RegExp(`(?:const|let|var|class)\\s+${name}\\b`).test(source)) return true
  // Destructured local, e.g. `const { Component } = step` (CartPage's steps).
  if (new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=`).test(source)) return true
  return false
}

describe('every rendered component is bound', () => {
  for (const file of FILES) {
    it(`${file.split('/').pop()} renders no unbound component`, () => {
      const source = stripComments(readFileSync(new URL(file, import.meta.url), 'utf8'))
      const imports = importBlocks(source)
      const unbound = [...componentsUsedIn(source)].filter((name) => !isBound(source, name, imports))
      expect(unbound, `${file} renders unbound component(s): ${unbound.join(', ')}`).toEqual([])
    })
  }
})

describe('the checkout total matches what the server will charge', () => {
  it('does not compute a total as subtotal + shipping alone', () => {
    // The server (server/_core/orderCore.js) subtracts the coupon discount and
    // zeroes shipping above the free-shipping threshold. A client total of
    // `subtotal + shipping` ignores both, so the amount shown to the shopper
    // can be higher than the amount the order is actually created with.
    for (const file of [
      '../pages/checkout/BagStep.jsx',
      '../pages/checkout/OrderSummary.jsx',
      '../pages/checkout/ReviewStep.jsx'
    ]) {
      const src = stripComments(readFileSync(new URL(file, import.meta.url), 'utf8'))
      expect(src, `${file} computes total = subtotal + shipping`).not.toMatch(
        /total\s*=\s*totalPrice\s*\+\s*\(\s*shipping\??\.?cost/
      )
    }
  })
})