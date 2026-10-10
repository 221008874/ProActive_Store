// src/utils/arabicFont.js
let _cachedFont = null

export async function loadCairoFontB64() {
  if (_cachedFont) return _cachedFont
  // Use jsDelivr CDN which allows cross-origin fetch
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5/files/cairo-arabic-400-normal.woff2'
  )
  // pdfMake requires TTF, not WOFF2 — fetch the TTF from Google APIs
  const ttfRes = await fetch(
    'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvalIhTp2mxdt0UX8.ttf'
  )
  const buf = await ttfRes.arrayBuffer()
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  _cachedFont = b64
  return b64
}