// Localised "last updated" formatting for the legal / info pages.
//
// Split out of components/InfoPage.jsx so the date logic is testable on its
// own and so the component file exports only components (react-refresh requires
// that: a file that exports both a component and a helper forces a full reload
// on every edit in dev).

/** 720px is the comfortable measure for a 16px body face — roughly 75
 *  characters per line in both Latin and Arabic script. Wider and the eye
 *  loses the line return on a long paragraph. Mirrors --pa-info-measure in
 *  tokens.css, which is what the CSS actually reads. */
export const READING_MAX = 720;

/**
 * Localised, unambiguous date.
 *
 * `Intl.DateTimeFormat` with an explicit locale is the only way this is right
 * in both languages: an Arabic page wants "١ فبراير ٢٠٢٦" and an English page
 * wants "February 1, 2026", and neither should be hand-written as a literal in
 * the markup — that is how the two drifted apart in the first place.
 *
 * The argument is the *content* language, not the UI language: these pages can
 * be viewed in an Arabic UI while the document itself is still the English
 * revision, and a date is a fact about the document, not about the interface
 * around it.
 */
export function formatPolicyDate(value, lang) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const options = { day: 'numeric', month: 'long', year: 'numeric' };

  try {
    // `calendar: 'gregory'` is explicit because ar-EG falls back to Hijri on
    // some platforms, which would silently relabel a Gregorian date as 1447.
    return new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }
}

/** ISO string for the <time dateTime> attribute, or '' if the input is not a
 *  date. Guards against `new Date(undefined).toISOString()` throwing, which
 *  would take the whole page down over a missing metadata field. */
export function policyDateMachine(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
