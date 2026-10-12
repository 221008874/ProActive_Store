// Loading, empty, error and offline states.
//
// Every screen needs all four, and the rule that keeps them consistent is that
// a skeleton matches the layout it replaces (card ratio, grid width) so the
// page does not jump when real content lands. The empty and error states are
// the same component with different copy and a retry button on the latter.
//
// No emoji and no illustrations: the board's states are typographic.

/**
 * Skeleton block. `card` is a 3:4 photo well, `line` a text row; anything else
 * takes the explicit width/height given. Pass `count` to repeat one block.
 */
export function Skeleton({ variant = "card", width, height, count = 1, className = "", style = {} }) {
  const cls = variant === "card" ? "pa-skel pa-skel--card" : "pa-skel";
  const inline = {
    ...(variant === "card" ? { aspectRatio: "3 / 4" } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(variant === "line" && !height ? { height: 12 } : {}),
    ...style
  };
  const block = <span className={`${cls} ${className}`} style={inline} aria-hidden="true" />;

  if (count <= 1) return block;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ display: "block" }}>{block}</span>
      ))}
    </>
  );
}

/** A grid of product-card skeletons, for lists that end in a ProductGrid. */
export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="pa-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="pa-skel" style={{ aspectRatio: "3 / 4" }} />
          <span className="pa-skel" style={{ height: 10, width: "70%" }} />
          <span className="pa-skel" style={{ height: 12, width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

/**
 * EmptyState — a title, one line, and one action. The action is optional so a
 * screen with nothing to offer (a filtered list) can still explain itself.
 */
export function EmptyState({ title, body, actionLabel, onAction, as: Tag = "button", to, icon }) {
  const props = Tag === "button" ? { type: "button", onClick: onAction } : { to };
  return (
    <div className="pa-empty" role="status">
      {icon}
      <div className="pa-empty__title">{title}</div>
      {body && <p className="pa-empty__body">{body}</p>}
      {actionLabel && <Tag className="pa-btn pa-btn--outline" {...props}>{actionLabel}</Tag>}
    </div>
  );
}

/**
 * ErrorState — the same shape, but the action is a retry and the tone is the
 * sale colour so it is never mistaken for "nothing here yet".
 *
 * `code` is the diagnosability hook: when /api/catalog answers with an HTML
 * page (the function is not deployed), a 404 (the route is gone) or a 500, the
 * shopkeeper can read "E-API-404" off the screen and quote it in a report
 * instead of describing a screenshot. Kept small and muted so it reads as
 * diagnostics, not as an apology.
 */
export function ErrorState({ title, body, onRetry, retryLabel = "Try again", code, retrying }) {
  return (
    <div className="pa-empty" role="alert">
      <div className="pa-empty__title" style={{ color: "var(--pa-sale)" }}>{title}</div>
      {body && <p className="pa-empty__body">{body}</p>}
      {onRetry && (
        <button type="button" className="pa-btn pa-btn--outline" onClick={onRetry} disabled={retrying}>
          {retryLabel}
        </button>
      )}
      {code && <code className="pa-empty__code">{code}</code>}
    </div>
  );
}

/**
 * StaleNotice — the catalogue resolved from the IndexedDB copy, so the products
 * on screen may be yesterday's. Small, quiet, and never blocking: stale prices
 * are far better than no shop at all, and checkout re-checks money server-side.
 */
export function StaleNotice({ label }) {
  if (!label) return null;
  return (
    <p className="pa-stale-note" role="status">
      {label}
    </p>
  );
}

/**
 * OfflineBanner — shown when the browser is offline and the page is rendering
 * from the IndexedDB catalogue cache, so the shopper knows the prices and
 * stock they see are the saved ones.
 * Slim bar (40px), dismissible, role="status".
 */
export function OfflineBanner({ message, onDismiss }) {
  return (
    <div className="pa-offline" role="status" style={{ height: 40, padding: '0 var(--pa-gutter)' }}>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button type="button" className="pa-icon-btn" style={{ width: 32, height: 32 }} aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}
