import { createElement } from "react";

/**
 * Button. `as` lets you pass your router's <Link> (e.g. as={Link} to="/cart").
 * variant: "solid" (primary) | "outline" (secondary) | "danger".
 * size: "lg" (52px sticky bars) | "compact" (44px) | "sm" (40px admin rows).
 */
export function Button({ as: Tag = "button", variant = "solid", size, block, className = "", ...rest }) {
  const cls = ["pa-btn",
    variant === "outline" && "pa-btn--outline",
    variant === "danger" && "pa-btn--danger",
    size && `pa-btn--${size}`, block && "pa-btn--block", className]
    .filter(Boolean).join(" ");
  return createElement(Tag, { className: cls, ...(Tag === "button" ? { type: "button" } : {}), ...rest });
}

export function IconButton({ label, box, children, className = "", ...rest }) {
  return (
    <button type="button" aria-label={label} className={`pa-icon-btn ${box ? "pa-icon-btn--box" : ""} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Corner badge on product photos. kind: "new" | "sale". For sale pass the text, e.g. "-25%". */
export function Badge({ kind = "new", children, className = "" }) {
  return <span className={`pa-badge ${kind === "sale" ? "pa-badge--sale" : ""} ${className}`}>{children}</span>;
}

/** Round counter (bag count, admin Orders / Low stock). tone: "sale" | "low". */
export function Count({ n, tone = "sale", large, className = "" }) {
  if (!n) return null;
  return <span className={`pa-count ${large ? "pa-count--lg" : ""} ${tone === "low" ? "pa-count--low" : ""} ${className}`}>{n}</span>;
}

/** Order / product status pill. status: pending|confirmed|shipped|delivered|cancelled|returned. */
const PRODUCT_STATUS_TONE = { active: "delivered", draft: "pending", archived: "cancelled" };
const KNOWN_TONES = new Set([
  "pending", "confirmed", "shipped", "delivered", "cancelled", "returned", "neutral"
]);
export function StatusPill({ status, label }) {
  const tone = PRODUCT_STATUS_TONE[status] ?? status;
  // Unknown status falls back to the neutral tone rather than emitting a class
  // with no CSS rule (which renders a transparent, unstyled pill).
  const cls = KNOWN_TONES.has(tone) ? `pa-status--${tone}` : "pa-status--neutral";
  return <span className={`pa-status ${cls}`}>{label ?? status}</span>;
}

/** Label + input. Use `admin` for the lighter admin look. */
export function Field({ id, label, hint, error, admin, className = "", ...input }) {
  return (
    <div className={`pa-field ${className}`}>
      {label && <label className="pa-label" htmlFor={id}>{label}</label>}
      <input id={id} className={`pa-input ${admin ? "pa-input--admin" : ""}`} aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined} {...input} />
      {(error || hint) && <div id={`${id}-msg`} className={error ? "pa-error" : "pa-subtitle"}>{error || hint}</div>}
    </div>
  );
}

/**
 * Accordion row. A real <details> so it works without JS and is keyboard
 * operable for free; `open` only sets the initial state.
 *
 * items: [{ id, title, body }] — body is rendered verbatim, so it can carry
 * the styled content a product page needs (lists, <bdi>, links).
 */
export function Accordion({ items, openId, className = "" }) {
  return (
    <div className={`pa-acc ${className}`}>
      {items.map((item) => (
        <details key={item.id} open={item.id === openId || item.open}>
          <summary>{item.title}</summary>
          <div className="pa-acc__body">{item.body}</div>
        </details>
      ))}
    </div>
  );
}

