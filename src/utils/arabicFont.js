// src/utils/arabicFont.js
//
// Cairo TTF for pdfMake (which cannot use WOFF2). Fetched lazily and cached
// for the session; the app UI itself uses the self-hosted @fontsource
// packages, so this only affects generated PDFs.
let _cachedFont = null

export async function loadCairoFontB64() {
  if (_cachedFont) return _cachedFont
  // pdfMake requires TTF, not WOFF2 — fetch the TTF from Google APIs
  const ttfRes = await fetch(
    'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvalIhTp2mxdt0UX8.ttf'
  )
  const buf = await ttfRes.arrayBuffer()
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  _cachedFont = b64
  return b64
}