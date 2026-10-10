import Reshaper from 'arabic-reshaper'
import { bidiTransform } from 'bidi-js'

/**
 * Shape Arabic text for pdfMake rendering.
 * pdfMake renders text left-to-right, so we must:
 *  1. Reshape letters (connect them properly)
 *  2. Apply Unicode Bidi algorithm to reverse RTL segments
 */
export function shapeArabic(text) {
  if (!text) return ''
  const reshaped = Reshaper.reshape(text)
  const bidi = bidiTransform(reshaped, { defaultDirection: 'rtl' })
  return bidi
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