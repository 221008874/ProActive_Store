// Colour maths for swatches.
//
// Deliberately dependency-free and pure: `src/ui` needs this to paint a legible
// swatch edge, and the design system must not import a service (catalog.js
// pulls in the Firebase SDK, which would then ship with every component that
// renders a colour dot).

// Relative luminance above which a colour is treated as "light" and needs a
// darker edge to be distinguishable from paper. 0.86 sits above beige (#F4F2EE)
// and below every mid-tone, which is the behaviour we want: only the near-whites
// get the heavy border.
const NEAR_WHITE_LUMINANCE = 0.86;

/** True when a hex colour is light enough that its edge disappears on paper. */
export function swatchNeedsBorder(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > NEAR_WHITE_LUMINANCE;
}
