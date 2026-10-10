// Shared colour palettes — the JS mirror of the Foundations-board tokens in
// src/tokens.css. Every page imports this instead of carrying its own literal
// copy, which is how CouponLanding and Home drifted apart in the first place.
//
// Why literals and not `var(--pa-ink)`: several call sites build alpha variants
// with string concatenation (`c.success + '40'`), which only works on a 6-digit
// hex. Keep the hexes here and let tokens.css own the CSS side. Values below
// MUST stay in sync with tokens.css.

const TOKENS = {
  light: {
    ink: '#121212',
    paper: '#FFFFFF',
    stone: '#F4F2EE',
    line: '#E4E1DA',
    muted: '#5B5B5B',
    disabled: '#8A8780',
    sale: '#C8102E',
    instock: '#1B7F4B',
    low: '#B45309'
  },
  dark: {
    ink: '#F4F2EE',
    paper: '#121212',
    stone: '#1C1C1C',
    line: '#2E2D2B',
    muted: '#A8A59E',
    disabled: '#6B6963',
    sale: '#FF5C73',
    instock: '#4CC38A',
    low: '#F0A04B'
  }
}

function buildPalette(mode) {
  const t = TOKENS[mode]
  return {
    primary: t.ink,
    secondary: t.ink,
    accent: t.muted,
    background: t.paper,
    surface: t.stone,
    card: t.paper,
    textDark: t.ink,
    textLight: t.muted,
    textMuted: t.muted,
    text: t.ink,
    heading: t.ink,
    link: t.ink,
    border: t.line,
    disabled: t.disabled,
    success: t.instock,
    danger: t.sale,
    warning: t.low,
    overlay: mode === 'dark' ? 'rgba(244, 242, 238, 0.06)' : 'rgba(18, 18, 18, 0.05)'
  }
}

export const COLORS = {
  light: buildPalette('light'),
  dark: buildPalette('dark')
}

// The board has no gold accent, so secondary collapses onto ink. Any component
// still reaching for it gets the primary button colour rather than a stale hue.
export function getColors(theme) {
  return COLORS[theme] || COLORS.light
}

// Reference form, for new code that doesn't concatenate alpha suffixes.
export function token(name) {
  return `var(--pa-${name})`
}

// Gold-era code spelled alpha variants as hand-written rgb() triplets. This
// keeps them derived from the board hex instead of a second set of literals.
export function withAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return hex
  let h = m[1]
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const n = parseInt(h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default COLORS