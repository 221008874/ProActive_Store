import { Count } from "./primitives";
import { loc, stockLevel } from "./format";

/**
 * Admin layout: black sidebar on desktop, bottom bar on phones, content on the right.
 * items: [{ key, label, href, badge?, badgeTone? }]   e.g. Orders 12, Low stock 5 (badgeTone: "low")
 * onNavigate: optional (key) => void. When given, an item's click selects it in
 * app state instead of following href — the nav is a router-less tab set.
 */
export function AdminShell({ items, active, email, onSignOut, children, as: Tag = "a", onNavigate }) {
  return (
    <div className="pa-shell">
      <aside className="pa-side">
        <div className="pa-side__brand"><div className="pa-logo">PROACTIVE</div><small>Admin</small></div>
        {items.map((it) => {
          const p = Tag === "a" ? { href: it.href } : { to: it.href };
          const onClick = onNavigate
            ? (e) => { e.preventDefault(); onNavigate(it.key); }
            : undefined;
          return (
            <Tag key={it.key} aria-current={active === it.key ? "page" : undefined} onClick={onClick} {...p}>
              {it.label}<Count n={it.badge} tone={it.badgeTone} large />
            </Tag>
          );
        })}
        <div className="pa-side__foot">
          <div style={{ fontSize: 12, color: "var(--pa-on-dark-2)" }}>{email}</div>
          <a href="#signout" onClick={(e) => { e.preventDefault(); onSignOut?.(); }} style={{ padding: 0, height: "auto", color: "#fff", fontWeight: 700 }}>Sign out</a>
        </div>
      </aside>
      <main className="pa-content">{children}</main>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div><h1>{title}</h1>{subtitle && <div className="pa-subtitle">{subtitle}</div>}</div>
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}

/**
 * Colour × size stock grid (the key admin control).
 * colors:   [{ id, name:{ar,en}, hex }]        sizes: ["XS","S",...]
 * stock:    { "red_M": 3, ... }                 keys use the SAME variantId format as the migration plan: "<colorId>_<size>"
 * onChange: (variantId, newStock) => void
 * Convert to/from the `variants` array with variantsToStock / stockToVariants below.
 */
export function StockGrid({ colors, sizes, stock, onChange, lang = "en", totalLabel }) {
  const total = Object.values(stock).reduce((s, n) => s + (Number(n) || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Stock by colour and size</div>
        <div className="pa-subtitle" style={{ fontSize: 12 }}>{totalLabel ?? `Total ${total} · 0 = sold out`}</div>
      </div>
      <div className="pa-stock" style={{ "--cols": sizes.length }}>
        <span />
        {sizes.map((s) => <span key={s} className="pa-stock__col">{s}</span>)}
        {colors.map((c) => (
          <Row key={c.id} color={c} sizes={sizes} stock={stock} onChange={onChange} lang={lang} />
        ))}
      </div>
    </div>
  );
}
function Row({ color, sizes, stock, onChange, lang }) {
  return (
    <>
      <span className="pa-stock__row-label"><span className="pa-dot pa-dot--sm" style={{ "--sw": color.hex }} />{loc(color.name, lang)}</span>
      {sizes.map((s) => {
        const id = `${color.id}_${s}`;
        const n = Number(stock[id] ?? 0);
        return (
          <input key={id} inputMode="numeric" pattern="[0-9]*" aria-label={`${loc(color.name, lang)} ${s} stock`}
            value={stock[id] ?? 0} data-level={stockLevel(n)}
            onChange={(e) => onChange(id, Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))} />
        );
      })}
    </>
  );
}

/** variants[] (Firestore subcollection) -> { "red_M": 3 } for the grid */
export const variantsToStock = (variants) => Object.fromEntries(variants.map((v) => [`${v.colorId}_${v.size}`, v.stock]));

/** grid state -> variants[] for saveProduct() in services/products.js (migration 6.2) */
export function stockToVariants(colors, sizes, stock, prev = []) {
  const old = Object.fromEntries(prev.map((v) => [`${v.colorId}_${v.size}`, v]));
  return colors.flatMap((c) => sizes.map((s) => {
    const id = `${c.id}_${s}`;
    return { ...(old[id] ?? { priceOverride: null, active: true }), colorId: c.id, color: c.name?.en ?? c.id, size: s, stock: Number(stock[id] ?? 0) };
  }));
}
