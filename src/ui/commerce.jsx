import { Badge } from "./primitives";
import { IconHeart } from "./icons";
import { loc, formatEGP, discountPct as calcPct, LOW_STOCK_AT, pickImage, thumb } from "./format";

/** Price with optional struck-through old price. Shows the sale colour only when discounted. */
export function PriceTag({ price, compareAtPrice, lang = "en", large }) {
  const onSale = compareAtPrice > price;
  return (
    <div className="pa-price-row">
      <bdi className={`pa-price ${onSale ? "pa-price--sale" : ""} ${large ? "pa-price--lg" : ""}`}>{formatEGP(price, lang)}</bdi>
      {onSale && <bdi className="pa-was">{formatEGP(compareAtPrice, lang)}</bdi>}
    </div>
  );
}

/** "Only 3 left" (amber). Returns null when stock is fine or zero. `where` e.g. "in red, size M". */
export function StockHint({ stock, where, small, t = (n, w) => `Only ${n} left${w ? " " + w : ""}` }) {
  if (!(stock > 0 && stock <= LOW_STOCK_AT)) return null;
  return <div className={`pa-stock-hint ${small ? "pa-stock-hint--sm" : ""}`} role="status">{t(stock, where)}</div>;
}

/**
 * Size pills. Sold-out sizes stay visible, crossed out and disabled (design rule: "honest stock").
 * sizes: ["XS","S",...]   stockBySize: { S: 4, M: 0 }   (read from the variants of the selected colour)
 */
export function SizePicker({ sizes, value, onChange, stockBySize = {}, small }) {
  return (
    <div className="pa-sizes" role="group" aria-label="Size">
      {sizes.map((s) => {
        const out = (stockBySize[s] ?? 1) <= 0;
        return (
          <button key={s} type="button" disabled={out} aria-pressed={value === s}
            className={`pa-size ${small ? "pa-size--sm" : ""}`} onClick={() => onChange?.(s)}
            aria-label={out ? `${s}, sold out` : s}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

/** Colour dots. colors: [{ id, name:{ar,en}, hex }]. Only colours in `available` are selectable when provided. */
export function ColorSwatches({ colors, value, onChange, lang = "en" }) {
  return (
    <div className="pa-swatches" role="group" aria-label="Colour">
      {colors.map((c) => (
        <button key={c.id} type="button" className="pa-swatch" style={{ "--sw": c.hex }}
          aria-pressed={value === c.id} aria-label={loc(c.name, lang)} onClick={() => onChange?.(c.id)} />
      ))}
    </div>
  );
}

/**
 * Product card for rails and grids. Works with the products_egp shape from the migration doc:
 * { id, title:{ar,en}, price, compareAtPrice, discountPct, images[], colors[], availableColors[], totalStock, isNew }
 * Pass `as={Link}` + `to` builder for your router.
 */
export function ProductCard({ product: p, lang = "en", as: Tag = "a", href, onSave, saved, soldOutLabel = "Sold out", quickSizes, onQuickAdd }) {
  const pct = p.discountPct ?? calcPct(p.price, p.compareAtPrice);
  const soldOut = p.totalStock != null && p.totalStock <= 0;
  const img = pickImage(p);
  const alt = (p.images ?? []).find((i) => i !== img);
  const dots = (p.colors ?? []).filter((c) => !p.availableColors || p.availableColors.includes(c.id)).slice(0, 4);
  const linkProps = Tag === "a" ? { href: href ?? `/product/${p.id}` } : { to: href ?? `/product/${p.id}` };
  return (
    <Tag className="pa-card" {...linkProps}>
      <div className="pa-card__photo">
        {img && <img src={thumb(img.url)} alt={loc(p.title, lang)} loading="lazy" />}
        {alt && <img className="pa-card__alt" src={thumb(alt.url)} alt="" loading="lazy" aria-hidden="true" />}
        {pct > 0 ? <Badge kind="sale" className="pa-card__badge">-{pct}%</Badge>
          : p.isNew ? <Badge className="pa-card__badge">{lang === "ar" ? "جديد" : "NEW"}</Badge> : null}
        {onSave && (
          <button type="button" className="pa-card__save" aria-label="Save to wishlist" aria-pressed={!!saved}
            onClick={(e) => { e.preventDefault(); onSave(p); }}>
            <IconHeart width={20} height={20} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
        {soldOut && <div className="pa-card__soldout">{soldOutLabel}</div>}
        {quickSizes && !soldOut && (
          <div className="pa-card__quick" onClick={(e) => e.preventDefault()}>
            {quickSizes.map((s) => <button key={s} type="button" className="pa-size pa-size--sm" onClick={() => onQuickAdd?.(p, s)}>{s}</button>)}
          </div>
        )}
      </div>
      {dots.length > 0 && <div className="pa-dots">{dots.map((c) => <span key={c.id} className="pa-dot" style={{ "--sw": c.hex }} />)}</div>}
      <div className="pa-card__title">{loc(p.title, lang)}</div>
      <PriceTag price={p.price} compareAtPrice={p.compareAtPrice} lang={lang} />
    </Tag>
  );
}

export const ProductGrid = ({ children }) => <div className="pa-grid">{children}</div>;
export const ProductRail = ({ children }) => <div className="pa-rail">{children}</div>;

/** Home section header: "New in ........ See all" (use tone="sale" for the red Sale heading). */
export function SectionHead({ title, tone, moreLabel = "See all", moreHref = "/shop", as: Tag = "a" }) {
  const props = Tag === "a" ? { href: moreHref } : { to: moreHref };
  return (
    <div className="pa-section__head">
      <h2 className={`pa-section__title ${tone === "sale" ? "pa-section__title--sale" : ""}`}>{title}</h2>
      <Tag className="pa-section__more" {...props}>{moreLabel}</Tag>
    </div>
  );
}

/** "Add 120 EGP more for free shipping" bar. Threshold comes from egp_settings/general (never hard-code 800). */
export function FreeShippingBar({ subtotal, threshold, lang = "en", t }) {
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const text = left > 0
    ? (t?.remaining?.(formatEGP(left, lang)) ?? <>Add <b>{formatEGP(left, lang)}</b> more for free shipping</>)
    : (t?.reached ?? "You get free shipping");
  return (
    <div className="pa-ship-bar">
      <div>{text}</div>
      <div className="pa-ship-bar__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="pa-ship-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** − 1 + stepper. Cap at the variant's live stock via `max`. */
export function QtyStepper({ value, onChange, min = 1, max = 99, labels = { dec: "Decrease quantity", inc: "Increase quantity" } }) {
  return (
    <div className="pa-qty">
      <button type="button" aria-label={labels.dec} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={labels.inc} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

/** Bag line. `issue` renders the red message + children (e.g. a "Change size" button). */
export function BagLine({ line, lang = "en", onQty, onRemove, issue, children }) {
  return (
    <div className="pa-line">
      <div className="pa-line__img" style={line.image ? { backgroundImage: `url(${thumb(line.image, 200)})` } : undefined} />
      <div className="pa-line__body">
        <div className="pa-line__title"><span>{loc(line.title, lang)}</span>
          <button type="button" className="pa-icon-btn" style={{ width: 32, height: 32, margin: "-6px -6px 0 0" }} aria-label="Remove item" onClick={onRemove}>×</button>
        </div>
        <div className="pa-line__meta">{[line.colorName, line.size].filter(Boolean).join(" · ")}</div>
        <PriceTag price={line.unitPrice} compareAtPrice={line.compareAtPrice} lang={lang} />
        {issue ? <div className="pa-error">{issue}</div> : <StockHint stock={line.stock} small />}
        {issue ? <div style={{ marginTop: "auto" }}>{children}</div>
          : <QtyStepper value={line.qty} max={line.stock ?? 99} onChange={onQty} />}
      </div>
    </div>
  );
}

/** Order summary rows. rows: [{ label, value, tone?: "discount" | "total" }] */
export function Summary({ rows }) {
  return (
    <div className="pa-summary">
      {rows.map((r, i) => (
        <div key={i} className={`pa-summary__row ${r.tone ? `pa-summary__row--${r.tone}` : ""}`}>
          <span>{r.label}</span><bdi>{r.value}</bdi>
        </div>
      ))}
    </div>
  );
}
