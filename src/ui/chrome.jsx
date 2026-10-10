import { IconMenu, IconSearch, IconBag, IconHome, IconShop, IconHeart, IconBack } from "./icons";
import { Count, IconButton } from "./primitives";

/** Black strip above the header: "Free shipping over 800 EGP" + EN | عربي switch. */
export function AnnouncementBar({ text, lang, onLang }) {
  return (
    <div className="pa-announce">
      <span>{text}</span>
      <span className="pa-lang">
        <a href="#en" aria-current={lang === "en"} onClick={(e) => { e.preventDefault(); onLang("en"); }}>EN</a>
        <a href="#ar" aria-current={lang === "ar"} lang="ar" onClick={(e) => { e.preventDefault(); onLang("ar"); }}>عربي</a>
      </span>
    </div>
  );
}

/**
 * Store header. Phone: menu | logo | search + bag. Tablet/desktop: logo, nav, search field, bag.
 * nav: [{ label, href }] (New in, Women, Men, Kids, Sale)
 */
export function Header({ bagCount = 0, nav = [], onMenu, onSearch, searchPlaceholder = "Search dresses, tops, trousers", logoHref = "/", bagHref = "/cart", as: Tag = "a", labels = {} }) {
  const to = (href) => (Tag === "a" ? { href } : { to: href });
  return (
    <header className="pa-header">
      <IconButton label={labels.menu ?? "Open menu"} onClick={onMenu}><IconMenu /></IconButton>
      <Tag className="pa-logo" {...to(logoHref)}>PROACTIVE</Tag>
      <nav className="pa-header__nav" aria-label="Main">
        {nav.map((n) => <Tag key={n.href} {...to(n.href)}>{n.label}</Tag>)}
      </nav>
      <button type="button" className="pa-header__search" onClick={onSearch}>{searchPlaceholder}</button>
      <div style={{ display: "flex" }}>
        <IconButton label={labels.search ?? "Search"} onClick={onSearch} className="pa-header__search-icon"><IconSearch /></IconButton>
        <Tag className="pa-icon-btn" aria-label={`${labels.bag ?? "Bag"}, ${bagCount}`} {...to(bagHref)}>
          <IconBag /><Count n={bagCount} />
        </Tag>
      </div>
    </header>
  );
}

/** Phone bottom tab bar (hidden ≥768px by CSS). `active`: "home" | "shop" | "saved" | "bag" | "menu". */
export function TabBar({ active, hrefs = {}, labels = {}, as: Tag = "a" }) {
  // Named objects rather than [key, Icon, label, href] tuples: a tuple element
  // used only as a JSX tag reads as "unused" to no-unused-vars.
  const items = [
    { key: "home", Icon: IconHome, label: labels.home ?? "Home", href: hrefs.home ?? "/home" },
    { key: "shop", Icon: IconShop, label: labels.shop ?? "Shop", href: hrefs.shop ?? "/shop" },
    { key: "saved", Icon: IconHeart, label: labels.saved ?? "Saved", href: hrefs.saved ?? "/saved" },
    { key: "bag", Icon: IconBag, label: labels.bag ?? "Bag", href: hrefs.bag ?? "/cart" },
    { key: "menu", Icon: IconMenu, label: labels.menu ?? "Menu", href: hrefs.menu ?? "#menu" },
  ];
  return (
    <nav className="pa-tabbar" aria-label="Tabs">
      {/* Destructure into locals: an identifier used only as a JSX tag reads as
          "unused" to no-unused-vars when it comes straight from the params. */}
      {items.map((it) => {
        const { key, Icon, label, href } = it
        const p = Tag === "a" ? { href } : { to: href };
        return <Tag key={key} aria-current={active === key ? "page" : undefined} {...p}><Icon width={22} height={22} />{label}</Tag>;
      })}
    </nav>
  );
}

/** Title bar for Bag / Delivery / Review: back arrow, title, "Step 1 of 3", and the 3-segment progress strip. */
export function StepHeader({ title, step, of = 3, stepLabel, onBack, backHref }) {
  return (
    <>
      <div className="pa-page-head">
        {backHref ? <a className="pa-icon-btn" href={backHref} aria-label="Back"><IconBack /></a>
          : <IconButton label="Back" onClick={onBack}><IconBack /></IconButton>}
        <h1>{title}</h1>
        <div className="pa-page-head__step">{stepLabel ?? `Step ${step} of ${of}`}</div>
      </div>
      <div className="pa-steps" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => <span key={i} data-done={i < step} />)}
      </div>
    </>
  );
}
