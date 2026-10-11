// Inline icons, same 24px / 1.8 stroke style as the design boards.
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

// RTL-aware transform. `tokens.css` defines --pa-flip: scaleX(-1) on html[dir=rtl]
// and it inherits, so a directional icon only needs this to mirror correctly.
const flip = (p) => ({ transform: "var(--pa-flip, none)", ...p.style });

export const IconMenu   = (p) => <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h10" /></svg>;
export const IconSearch = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>;
export const IconBag    = (p) => <svg {...base} {...p}><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
export const IconHeart  = (p) => <svg {...base} {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>;
export const IconHome   = (p) => <svg {...base} {...p}><path d="M4 11l8-7 8 7v9H4z" /></svg>;
export const IconShop   = (p) => <svg {...base} {...p}><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></svg>;

const CHEVRON_D = {
  down:  "M6 9l6 6 6-6",
  up:    "M6 15l6-6 6 6",
  left:  "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6"
};

// "left"/"right" are physical and mirror themselves via flip(); the logical
// "start"/"end" spellings map onto them so the caller never has to reason about
// script direction.
export const IconChevron = ({ dir = "down", ...p }) => {
  const physical = dir === "start" ? "left" : dir === "end" ? "right" : dir;
  const mirrors = physical === "left" || physical === "right";
  return (
    <svg {...base} {...p} style={mirrors ? flip(p) : p.style}>
      <path d={CHEVRON_D[physical]} />
    </svg>
  );
};

// "Back" arrow: flips automatically in RTL. `style` is MERGED, not replaced —
// a caller-supplied style must not silently kill the mirror.
export const IconBack = (p) => (
  <svg {...base} {...p} style={flip(p)}><path d="M15 6l-6 6 6 6" /></svg>
);

export const IconClose = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconTrash = (p) => <svg {...base} {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>;

// --- icons added for the fashion UI pass -------------------------------------

export const IconShare = (p) => (
  <svg {...base} {...p}><path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" /><path d="M6 11v8h12v-8" /></svg>
);

export const IconFilter = (p) => <svg {...base} {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;

export const IconCheck = (p) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;

// Plus/minus are drawn on a 24 box but read small: keep the stroke weight so
// they stay legible at 14px, and let the caller size the box.
export const IconPlus = (p) => <svg {...base} {...p}><path d="M12 6v12M6 12h12" /></svg>;
export const IconMinus = (p) => <svg {...base} {...p}><path d="M6 12h12" /></svg>;

export const IconPhone = (p) => (
  <svg {...base} {...p}><path d="M7 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5L16 12.5l4 1.5v3a2 2 0 0 1-2.2 2A15 15 0 0 1 5 6.2 2 2 0 0 1 7 4z" /></svg>
);

export const IconUser = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
);
