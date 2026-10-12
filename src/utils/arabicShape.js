import * as ArabicReshaperModule from 'arabic-reshaper'
import * as bidiModule from 'bidi-js'

// arabic-reshaper is a UMD bundle that assigns to `module.exports`, so the ESM
// namespace can be the exports object itself or a `{ default: exports }`
// wrapper depending on the bundler. A bare default import crashed the admin
// app's coupon PDFs in production for exactly this reason. Unwrap both. (The
// method is `convertArabic`; `reshape` never existed.)
const Reshaper = ArabicReshaperModule?.convertArabic
  ? ArabicReshaperModule
  : ArabicReshaperModule?.default

// bidi-js exports a FACTORY function from both of its builds — the Unicode
// tables are built inside it and the API only exists after calling it. Named
// imports from the package therefore bundle into a runtime lookup on the
// factory that throws. Resolve once, tolerating either interop shape.
const bidiFactory = bidiModule?.default ?? bidiModule
const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory

/**
 * Shape Arabic text for pdfMake rendering.
 * pdfMake renders text left-to-right, so we must:
 *  1. Reshape letters (connect them properly)
 *  2. Apply Unicode Bidi algorithm to reverse RTL segments
 */
export function shapeArabic(text) {
  if (!text) return ''
  // Degrade rather than throw: unshaped Arabic still prints the content.
  if (typeof Reshaper?.convertArabic !== 'function' || typeof bidi?.getEmbeddingLevels !== 'function') {
    console.warn('Arabic shaping unavailable; PDF text will print unshaped')
    return text
  }
  // The base direction is a plain 'rtl' string, not an options object.
  const reshaped = Reshaper.convertArabic(text)
  return bidi.getReorderedString(reshaped, bidi.getEmbeddingLevels(reshaped, 'rtl'))
}

export function hasArabic(str) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '')
}

/**
 * Returns a pdfMake text node with correct font + alignment for the string.
 * If the text contains Arabic, uses Cairo font + RTL alignment.
 * Otherwise uses Roboto (default).
 */
export function smartText(text, extraStyle = {}) {
  if (!text) return { text: '', ...extraStyle }
  if (hasArabic(text)) {
    return {
      text: shapeArabic(text),
      font: 'Cairo',
      alignment: 'right',
      ...extraStyle,
    }
  }
  return { text, ...extraStyle }
}
