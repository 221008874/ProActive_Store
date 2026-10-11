// Home.
//
// Phone, top to bottom: hero, category circles, New in rail, Sale rail, About.
// Desktop: a 2fr/1fr hero grid (big banner + two category tiles), then New in
// and Sale as five-column grids, About in three columns.
//
// Data: New in is `isNew` or the newest ten by createdAt; Sale is everything
// discounted, ordered by discount so the deepest cut leads. Both come from the
// snapshot through the same service the shop uses, so the two pages cannot
// disagree about what is on offer.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useWishlist } from '../context/WishlistContext'
import { useCatalog } from '../hooks/useCatalog'
import { fetchCategories, fetchCollections } from '../services/catalog'
import { getFreeShippingThreshold } from '../services/settings'
import { formatEGP, loc, discountPct } from '../ui'
import heroImage from '../assets/mainBG.webp'
import {
  Button, EmptyState, ErrorState, IconChevron, ProductCard, ProductGrid, ProductRail,
  SectionHead, SkeletonGrid
} from '../ui'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

const seconds = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Number(ts) || 0)

export default function Home() {
  const { t, lang } = useLanguage()
  const { has, toggle: toggleSave } = useWishlist()
  const navigate = useNavigate()
  const { products, loading, error } = useCatalog()

  const [categories, setCategories] = useState([])
  const [hero, setHero] = useState(null)
  const [threshold, setThreshold] = useState(null)
  const [slide, setSlide] = useState(0)

  const L = label(t, lang)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      fetchCategories(),
      fetchCollections(),
      getFreeShippingThreshold()
    ]).then(([cats, cols, thr]) => {
      if (!alive) return
      if (cats.status === 'fulfilled') setCategories(cats.value)
      // The hero comes from the first active collection with a banner; a store
      // with no collections keeps the built-in artwork rather than an empty gap.
      const withBanner = cols.status === 'fulfilled'
        ? cols.value.find((c) => c.banner) ?? cols.value[0]
        : null
      if (withBanner) setHero(withBanner)
      if (thr.status === 'fulfilled') setThreshold(thr.value)
    })
    return () => { alive = false }
  }, [])

  // New in: flagged products first, then the newest. Both rails are capped, so
  // the shelf shows a curated slice and /shop shows everything.
  const newIn = useMemo(() => {
    const flagged = products.filter((p) => p.isNew)
    const pool = flagged.length >= 5 ? flagged
      : [...flagged, ...products.slice().sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt))]
    const seen = new Set()
    return pool.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, 10)
  }, [products])

  const sale = useMemo(() => products
    .map((p) => ({ p, pct: p.discountPct ?? discountPct(p.price, p.compareAtPrice) }))
    .filter((x) => x.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10)
    .map((x) => x.p), [products])

  const circles = useMemo(() => categories
    .filter((c) => !c.parentId || !categories.some((p) => p.id === c.parentId))
    .slice(0, 10), [categories])

  const catName = (c) => (c?.name ? loc(c.name, lang) : '')

  const cardLabels = {
    onlyLeft: (n) => L('onlyNLeft', `Only ${n} left`, `باقي ${n} بس`),
    soldOut: L('soldOut', 'Sold out', 'نفذت الكمية'),
    new: L('newIn', 'New', 'جديد'),
    save: L('save', 'Save', 'حفظ'),
    add: L('add', 'Add', 'إضافة'),
    size: L('size', 'size', 'مقاس')
  }

  return (
    <>
      <Hero
        hero={hero}
        catName={catName}
        lang={lang}
        L={L}
        threshold={threshold}
        slide={slide}
        onSlide={setSlide}
      />

      {circles.length > 0 && (
        <nav className="pa-cats" aria-label={L('categories', 'Categories', 'الأقسام')}>
          {circles.map((c) => (
            <Link key={c.id} className="pa-cat" to={`/shop?category=${encodeURIComponent(c.id)}`}>
              <span className="pa-cat__img" style={c.image ? { backgroundImage: `url(${c.image})` } : undefined} />
              <span>{catName(c)}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* With nothing new in, this section rendered its heading and an empty
          grid: a "New in" shelf with no products reads as a broken carousel
          rather than as a shop that has not stocked anything yet. */}
      {newIn.length > 0 && (
        <section className="pa-section" aria-labelledby="home-new">
          <div id="home-new">
            <SectionHead
              title={L('newIn', 'New in', 'وصل حديثاً')}
              moreHref="/shop?sort=newest"
              moreLabel={L('seeAll', 'See all', 'شوف الكل')}
              as={Link}
            />
          </div>
          {/* Phone/tablet: a rail. Desktop: a grid, switched in CSS by the same
              breakpoints the shop uses, so the page reflows without JS. */}
          <div className="pa-home__shelf">
            <ProductRail>
              {newIn.map((p) => (
                <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`}
                  saved={has(p.id)} onSave={() => toggleSave(p.id)} labels={cardLabels} />
              ))}
            </ProductRail>
            <ProductGrid className="pa-home__grid">
              {newIn.map((p) => (
                <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`}
                  saved={has(p.id)} onSave={() => toggleSave(p.id)} labels={cardLabels} />
              ))}
            </ProductGrid>
          </div>
        </section>
      )}

      {sale.length > 0 && (
        <section className="pa-section" aria-labelledby="home-sale">
          <div id="home-sale">
            <SectionHead
              title={L('sale', 'Sale', 'تخفيضات')}
              tone="sale"
              moreHref="/shop?sale=1"
              moreLabel={L('seeAll', 'See all', 'شوف الكل')}
              as={Link}
            />
          </div>
          <div className="pa-home__shelf">
            <ProductRail>
              {sale.map((p) => (
                <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`}
                  saved={has(p.id)} onSave={() => toggleSave(p.id)} labels={cardLabels} />
              ))}
            </ProductRail>
            <ProductGrid className="pa-home__grid">
              {sale.map((p) => (
                <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`}
                  saved={has(p.id)} onSave={() => toggleSave(p.id)} labels={cardLabels} />
              ))}
            </ProductGrid>
          </div>
        </section>
      )}

      {loading && <SkeletonGrid count={6} />}
      {!loading && error && (
        <ErrorState
          title={L('loadFailed', 'Could not load products', 'تحميل المنتجات فشل')}
          body={L('checkConnection', 'Check your connection and try again.', 'راجع الاتصال وجرب تاني.')}
          onRetry={() => navigate(0)}
          retryLabel={L('retry', 'Try again', 'جرب تاني')}
        />
      )}
      {!loading && !error && products.length === 0 && (
        <EmptyState
          title={L('noProducts', 'Nothing here yet', 'مفيش منتجات لسه')}
          body={L('noProductsBody', 'The first pieces are on their way.', 'أول قطع في طريقها.')}
        />
      )}

      <section className="pa-about">
        <h2 style={{ fontSize: 22 }}>{L('aboutUsTitle', 'Why Proactive', 'ليه برو أكتيف')}</h2>
        {[
          {
            key: 'ourMission',
            title: L('ourMission', 'Our mission', 'مهمتنا'),
            body: L('missionDescription', 'Chosen pieces, honest prices, delivered across Egypt.', 'قطع مختارة، أسعار واضحة، وبتوصل لكل مصر.')
          },
          {
            key: 'ourVision',
            title: L('ourVision', 'Our vision', 'رؤيتنا'),
            body: L('visionDescription', 'A wardrobe you can reach from your phone.', 'دولاب تقدر توصله من موبايلك.')
          },
          {
            key: 'ourValues',
            title: L('ourValues', 'Our values', 'قيمنا'),
            body: L('valuesDescription', 'Quality you can feel, service you can trust.', 'جودة تحس بيها، وخدمة تثق بيها.')
          }
        ].map((card) => (
          <div key={card.key} className="pa-about__card">
            <b>{card.title}</b>
            <span>{card.body}</span>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <Button variant="outline" as={Link} href="/about">
            {L('learnMore', 'Learn more', 'اعرف أكثر')}
          </Button>
        </div>
      </section>
    </>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Hero. Phone: one full-width slide, 320px tall, left-aligned text at the
 * bottom with pagination bars. Desktop: a 2fr/1fr grid — the banner beside two
 * category tiles — because a lone 520px-tall banner wastes the right half of a
 * laptop screen.
 */
function Hero({ hero, catName, lang, L, threshold, slide, onSlide }) {
  const billing = lang === 'ar' ? 'الدفع عند الاستلام' : 'Cash on delivery'
  return (
    <section className="pa-hero-wrap">
      <div
        className="pa-hero"
        style={{
          backgroundImage: hero?.banner
            ? `linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,.15)), url(${hero.banner})`
            : `linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,.15)), url(${heroImage})`,
          // Deterministic slide offset so re-renders do not jump.
          backgroundPosition: `${slide * 50}% center`
        }}
      >
        <div className="pa-hero__eyebrow">{L('newIn', 'New in', 'وصل حديثاً')}</div>
        <h1 className="pa-hero__title">{hero ? catName(hero) : L('newSeason', 'New season', 'الموسم الجديد')}</h1>
        <p className="pa-hero__line">
          {billing} · {L('freeShippingOver', 'Free shipping over', 'شحن مجاني فوق')}{' '}
          <bdi>{threshold ? formatEGP(threshold, lang) : '800 EGP'}</bdi>
        </p>
        <Button size="lg" as={Link} href="/shop">{L('shopNow', 'Shop now', 'تسوّق الآن')}</Button>

        {/* Pagination bars: decorative, so the live region is the slide itself. */}
        <div className="pa-hero__dots" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" data-on={i === slide} onClick={() => onSlide(i)}
              style={{ width: i === slide ? 24 : 12 }} />
          ))}
        </div>
      </div>

      {/* Desktop-only category tiles beside the banner. */}
      <div className="pa-hero__side">
        {[0, 1].map((i) => (
          <Link key={i} className="pa-hero__tile" to={`/shop?sort=newest`}>
            <span className="pa-hero__tile-label">
              {i === 0 ? L('newIn', 'New in', 'وصل حديثاً') : L('sale', 'Sale', 'تخفيضات')}
            </span>
            <IconChevron dir="end" width={22} height={22} />
          </Link>
        ))}
      </div>
    </section>
  )
}
