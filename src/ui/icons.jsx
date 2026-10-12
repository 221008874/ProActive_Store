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

// Sort: two rows of decreasing length, the smallest control that says "order".
export const IconSort = (p) => <svg {...base} {...p}><path d="M4 7h12M4 12h9M4 17h6" /><path d="M17 5v14m0 0 3-3m-3 3-3-3" /></svg>;

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

// Added in fix round 3 to replace the emoji that were sitting in the terms
// contact block (📧 📱 📍). Same 24/1.8 stroke style as the rest of the set.

export const IconMail = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 5.5L20 7" /></svg>
);

export const IconPin = (p) => (
  <svg {...base} {...p}><path d="M12 21s6.5-5.7 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.3 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.3" /></svg>
);

/* --- About page: mission / vision / values (fix round 3, replacing 👗 👁️ 💎) --- */

// A garment on a hanger — "our mission".
export const IconHanger = (p) => (
  <svg {...base} {...p}><path d="M12 8.5a2 2 0 1 1 2-2" /><path d="M12 8.5L4 16.5a1.6 1.6 0 0 0 1 3h14a1.6 1.6 0 0 0 1-3z" /></svg>
);

// An eye — "our vision".
export const IconEye = (p) => (
  <svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
);

// A cut diamond — "our values".
export const IconDiamond = (p) => (
  <svg {...base} {...p}><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9 4l-3 5 6 11M15 4l3 5-6 11" /></svg>
);

// A small burst, for the "join our story" banner (replacing 🎉).
export const IconSpark = (p) => (
  <svg {...base} {...p}><path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z" /><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>
);

/* --- P1.4: icon + label on the language and theme toggles ------------------ */

// Globe: the language toggle, in both locales. Not the flag of the *other*
// language — that convention breaks as soon as a third language exists, and it
// gives no clue what the control does.
export const IconGlobe = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z" /></svg>
);

// Sun / moon: shown as the mode you are switching TO, matching the button's
// label. A moon next to "الوضع النهاري" would contradict the text beside it.
export const IconSun = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></svg>
);

export const IconMoon = (p) => (
  <svg {...base} {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg>
);

// WhatsApp: contact link in footer and checkout. Green brand colour in SVG.
export const IconWhatsApp = (p) => (
  <svg {...base} {...p} viewBox="0 0 24 24">
    <path d="M17.5 1.5c-4.5 0-8.1 3.6-8.1 8.1 0 3.2 2.2 5.9 5.2 7.4.3.1.4.3.5.5l1.8 1.4c.4.3.8.3 1.1 0l1.5-1.1c.2-.2.3-.4.3-.7 0-4.5-3.6-8.1-8.1-8.1S3 6.6 3 11.1s3.6 8.1 8.1 8.1 8.1-3.6 8.1-8.1zm-6.7 7.4c-.3-.1-.6-.1-.9-.2-.2 0-.4 0-.6.1-.6.2-1.5.7-2.1 1.1-.2.1-.3.2-.5.2-.2 0-.4-.1-.6-.2-.4-.2-1.2-.5-1.6-1.2-.2-.2-.4-.4-.4-.5 0-.1.1-.3.3-.5.4-.3.7-.9 1-1.2.1-.1.3-.2.4-.3.5-.3 1.6-.8 2.2-1.4.2-.2.4-.2.6 0 .2.2.2.4.2.6 0 .2-.1.4-.3.5-.2.1-.4.1-.6.1-.2 0-.4-.1-.6-.2l-.6-.2-1.5 3.5c-.1.3-.1.6 0 .7.1.2.2.3.4.4.2.1.4.2.6.2.2 0 .4 0 .6-.1.2-.1.4-.3.5-.4.3-.3.4-.7.4-1.1 0-.2-.1-.4-.3-.6-.2-.2-.5-.3-.7-.4l-.3-.1-.3-.1-.2-.1z" fill="#25D366"/>
  </svg>
);

/* --- Fix round 3: the icons that replaced the last emoji ------------------- */

// A circled cross: the invalid-coupon state (was a red cross emoji).
export const IconInvalid = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
);

// A warning triangle: the "already applied" state (was a warning-sign emoji).
export const IconAlert = (p) => (
  <svg {...base} {...p}><path d="M12 4.5l8.5 15h-17z" /><path d="M12 10v4M12 16.8v.2" /></svg>
);

// An information mark for the coupon "tip" callout (was a light-bulb emoji).
export const IconInfo = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></svg>
);

// A downward arrow into a tray: the download-PDF action (was a down-arrow
// emoji). It sits inline with the label, so it inherits currentColor.
export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 4v10m0 0l-4-4m4 4l4-4" /><path d="M5 17.5v1.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" /></svg>
);
