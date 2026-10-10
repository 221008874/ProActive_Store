// Home. Data logic is unchanged (session-cached, currency-scoped product fetch);
// every pixel of presentation moved to the design system: .pa-hero, .pa-about,
// .pa-section__head and the ProductGrid / ProductCard pair.
//
// What was removed on purpose, because the design system already does it:
//   * windowWidth state        -> CSS media queries own the breakpoints
//   * scroll parallax          -> .pa-hero is a fixed block, not a scroll effect
//   * IntersectionObserver     -> no entrance animations to trigger
//   * its own header / cart / language buttons -> now the app-level StoreChrome
//   * its own footer            -> StoreFooter

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useLocation } from '../context/LocationContext'
import { db } from '../services/firebase'
import { productsCollection } from '../config'
import { collection, getDocs } from 'firebase/firestore'
import heroImage from '../assets/mainBG.webp'
import StoreFooter from '../components/StoreFooter'
import { ProductGrid, ProductCard, SectionHead } from '../ui'
import { ProductRail } from '../ui'

const PRODUCT_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

const getCachedProducts = (currency) => {
  try {
    const key = `products_${currency}`
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > PRODUCT_CACHE_TTL) return null
    return data
  } catch (e) {
    return null
  }
}

const setCachedProducts = (currency, data) => {
  try {
    const key = `products_${currency}`
    sessionStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.warn('Failed to cache products:', e)
  }
}

export default function Home() {
  const { t, lang } = useLanguage()
  const { currency } = useLocation()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  useEffect(() => {
    const fetchProducts = async () => {
      if (!currency) return

      const cached = getCachedProducts(currency)
      if (cached) {
        setProducts(cached)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const collectionName = productsCollection(currency)
        const querySnapshot = await getDocs(collection(db, collectionName))
        const productList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        setProducts(productList)
        setCachedProducts(currency, productList)
      } catch (err) {
        console.error('Failed to load products:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [currency])

  if (loading) {
    return (
      <div className="pa-container" style={{ paddingBlock: 48, minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <p className="pa-subtitle" role="status">{L('loadingPremiumChocolates', 'Loading…', 'جاري التحميل…')}</p>
      </div>
    )
  }

  // "New in" is the horizontal rail (the first eight), the rest fall through to
  // the responsive grid below. .pa-grid reflows itself via --pa-grid-cols.
  const cards = products.map((p) => (
    <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`} />
  ))
  return (
    <>
      <section
        className="pa-hero"
        style={{
          // .pa-hero paints var(--pa-tint-6) as a placeholder; the real artwork
          // and the scrim that keeps the white type legible are applied here.
          backgroundImage: `linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,.15)), url(${heroImage})`
        }}
      >
        <div className="pa-hero__eyebrow">{L('featuredProducts', 'New season', 'الموسم الجديد')}</div>
        <h1 className="pa-hero__title">{L('ProActive Store', 'Proactive', 'برو أكتيف')}</h1>
        <Link className="pa-btn pa-btn--lg" to="/home#collection">
          {L('ourCollection', 'Shop the collection', 'تسوّق التشكيلة')}
        </Link>
      </section>

      <section className="pa-section">
        <SectionHead
          title={L('newIn', 'New in', 'وصل حديثاً')}
          moreHref="#collection"
          moreLabel={L('seeAll', 'See all', 'شوف الكل')}
          as={Link}
        />
        {products.length > 0 && (
          <ProductRail>
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} lang={lang} as={Link} href={`/product/${p.id}`} />
            ))}
          </ProductRail>
        )}
      </section>

      <section className="pa-section" id="collection">
        <SectionHead
          title={L('ourCollection', 'Our collection', 'تشكيلتنا')}
          moreHref="/about"
          moreLabel={L('learnMore', 'See all', 'اعرف أكثر')}
          as={Link}
        />

        {products.length === 0 ? (
          <div className="pa-container" style={{ paddingBlock: 48, textAlign: 'center' }}>
            <p className="pa-subtitle">{L('noProductsAvailable', 'No products found', 'مفيش منتجات لسه')}</p>
          </div>
        ) : (
          <ProductGrid>{cards}</ProductGrid>
        )}
      </section>

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
          <button type="button" className="pa-btn pa-btn--outline" onClick={() => navigate('/about')}>
            {L('learnMore', 'Learn more', 'اعرف أكثر')}
          </button>
        </div>
      </section>

      <StoreFooter />
    </>
  )
}
