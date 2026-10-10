// Shared colour palettes. Previously each page carried its own literal copy,
// which is how CouponLanding ended up with only 8 of the 13 keys and started
// rendering undefined colours. One palette, one source.

export const COLORS = {
  light: {
    primary: '#2C1810',
    secondary: '#D4A574',
    accent: '#E8B4A0',
    background: '#FAFAF8',
    surface: '#FFFFFF',
    card: '#FCFBF9',
    textDark: '#1A1410',
    textMuted: '#8B7D73',
    success: '#6B9E5F',
    danger: '#C84B31',
    warning: '#E8A840',
    border: '#E8DDD4',
    overlay: 'rgba(44, 24, 16, 0.05)'
  },
  dark: {
    primary: '#E8B4A0',
    secondary: '#D4A574',
    accent: '#C49080',
    background: '#0F0E0C',
    surface: '#1A1410',
    card: '#2C1810',
    textDark: '#F5F3F0',
    textMuted: '#A8968B',
    success: '#8FC178',
    danger: '#E67052',
    warning: '#F0B956',
    border: '#3E2723',
    overlay: 'rgba(232, 180, 160, 0.05)'
  }
}

export function getColors(theme) {
  return COLORS[theme] || COLORS.light
}

export default COLORS