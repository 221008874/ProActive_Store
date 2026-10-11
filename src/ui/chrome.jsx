// Chrome: the parts of the store that appear on every route.
//
// All presentational; every string and piece of data arrives as a prop from
// StoreChrome, which is where the app's contexts are read. Nothing here knows
// about Firebase, routing or the language table.

import { IconMenu, IconSearch, IconBag, IconHome, IconShop, IconHeart, IconBack, IconChevron } from "./icons";
import { Count, IconButton } from "./primitives";

/** Black strip above the header: free-shipping line, language switch, theme (desktop). */
export function AnnouncementBar({ text, lang, onLang, theme, onTheme, themeLabels = {} }) {
  return (
    <div className="pa-announce">
      <span>{text}</span>
      <span className="pa-lang">
        <span className="pa-announce__sep" aria-hidden="true">·</span>
        <button type="button" onClick={() => onLang("en")} aria-current={lang === "en"} lang="en">EN</button>
        <button type="button" onClick={() => onLang("ar")} aria-current={lang === "ar"} lang="ar">عربي</button>
        <span className="pa-announce__sep" aria-hidden="true">·</span>
        {onTheme && (
          <button type="button" className="pa-announce__theme" onClick={onTheme}
            aria-label={theme === "dark" ? themeLabels.light : themeLabels.dark}>
            {theme === "dark" ? (themeLabels.light ?? "Light") : (themeLabels.dark ?? "Dark")}
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * Store header. Phone: menu | wordmark | search + bag. Desktop >=1024: wordmark,
 * nav (with a category mega-menu on hover/focus), search field, wishlist, bag.
 *
 * nav: [{ label, href, sale?, children?: [{ label, href }] }]
 * A nav entry with `children` renders a mega-menu on desktop.
 *
 * `onSearch` opens the phone search sheet; `onSearchChange`/`onSearchSubmit`
 * drive the desktop search field, which is a real form (submit navigates).
 */
export function Header({
  bagCount = 0, savedCount = 0, nav = [], onMenu, onSearch, onSearchChange, onSearchSubmit,
  searchValue, searchPlaceholder = "Search", logoHref = "/home", bagHref = "/cart", savedHref = "/saved",
  as: Tag = "a", labels = {}
}) {
  const to = (href) => (Tag === "a" ? { href } : { to: href });
  return (
    <header className="pa-header">
      <IconButton label={labels.menu ?? "Open menu"} onClick={onMenu}><IconMenu /></IconButton>
      <Tag className="pa-logo" {...to(logoHref)}>PROACTIVE</Tag>

      <nav className="pa-header__nav" aria-label="Main">
        {nav.map((n) => (
          // An entry with children opens a mega-menu; the link itself is the
          // section landing page, so it works without the menu too.
          <span key={n.href} className="pa-navitem">
            <Tag {...to(n.href)} className={`pa-navlink ${n.sale ? "pa-navlink--sale" : ""}`}>{n.label}</Tag>
            {n.children?.length > 0 && (
              <div className="pa-mega">
                {n.children.map((c) => (
                  <Tag key={c.href} {...to(c.href)}>{c.label}</Tag>
                ))}
              </div>
            )}
          </span>
        ))}
      </nav>

      {onSearchSubmit ? (
        <form
          className="pa-header__search"
          role="search"
          onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.(searchValue ?? ""); }}
        >
          <IconSearch width={18} height={18} />
          <input
            type="search"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={labels.search ?? "Search"}
          />
        </form>
      ) : (
        <button type="button" className="pa-header__search" onClick={onSearch}>{searchPlaceholder}</button>
      )}

      <div style={{ display: "flex", alignItems: "center" }}>
        <IconButton label={labels.search ?? "Search"} onClick={onSearch} className="pa-header__search-icon">
          <IconSearch />
        </IconButton>
        <Tag className="pa-icon-btn" aria-label={`${labels.saved ?? "Saved"}, ${savedCount}`} {...to(savedHref)}>
          <IconHeart />
          {savedCount > 0 && <Count n={savedCount} />}
        </Tag>
        <Tag className="pa-icon-btn" aria-label={`${labels.bag ?? "Bag"}, ${bagCount}`} {...to(bagHref)}>
          <IconBag /><Count n={bagCount} />
        </Tag>
      </div>
    </header>
  );
}

/**
 * Phone bottom tab bar (hidden >=768px by CSS). `active` is a route prefix;
 * "menu" is special — it opens the drawer rather than navigating.
 * items: [{ key, label, href, Icon }] built by the caller so labels are localised.
 */
export function TabBar({ items = [], active, as: Tag = "a", onSelect }) {
  return (
    <nav className="pa-tabbar" aria-label="Tabs">
      {items.map((it) => {
        const isActive = active === it.key;
        // "menu" is an action, not a route: it must not move focus to a page.
        const click = it.key === "menu"
          ? (e) => { e.preventDefault(); onSelect?.(it.key); }
          : () => onSelect?.(it.key);
        return (
          <Tag
            key={it.key}
            {...(it.key === "menu" ? { href: "#menu", role: "button" } : Tag === "a" ? { href: it.href } : { to: it.href })}
            aria-current={isActive ? "page" : undefined}
            aria-label={it.key === "menu" ? (it.label ?? "Menu") : undefined}
            onClick={click}
          >
            <it.Icon width={22} height={22} />
            <span>{it.label}</span>
          </Tag>
        );
      })}
    </nav>
  );
}

/**
 * Title bar for the sub-pages (product, checkout steps, order detail): back
 * arrow, title, and an optional right-hand slot for "Step 2 of 3" or a status.
 */
export function StepHeader({ title, step, of = 3, stepLabel, onBack, backHref, right }) {
  return (
    <div className="pa-page-head">
      {backHref ? <a className="pa-icon-btn" href={backHref} aria-label="Back"><IconBack /></a>
        : onBack ? <IconButton label="Back" onClick={onBack}><IconBack /></IconButton>
          : <span style={{ width: 48 }} />}
      <h1>{title}</h1>
      {right ?? (step != null ? <div className="pa-page-head__step">{stepLabel ?? `Step ${step} of ${of}`}</div> : <span style={{ width: 48 }} />)}
    </div>
  )
}

/** Back arrow row for the sub-pages (shop, product, checkout steps). */
export function BackLink({ href, label = "Back", as: Tag = "a" }) {
  return (
    <Tag className="pa-drawer__row" {...(Tag === "a" ? { href } : { to: href })} style={{ gap: 8 }}>
      <IconBack width={20} height={20} />
      <span>{label}</span>
    </Tag>
  );
}

export { IconChevron };
