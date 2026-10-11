// Saved: the wishlist.
//
// Stored in localStorage (context/WishlistContext), so it needs no account and
// survives a reload. It resolves the saved ids back to products from the
// cached catalogue: a product archived after it was saved simply drops out,
// which is better than a dead link.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useWishlist } from '../context/WishlistContext'
import {
  BottomSheet, Button, EmptyState, IconBack, IconBag, IconHeart, SkeletonGrid
} from '../ui'
import { useCatalog } from '../hooks/useCatalog'
import { ProductCard, ProductGrid } from '../ui'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function SavedPage() {
  const { t, lang } = useLanguage()
  const { ids, remove, clear } = useWishlist()
  const { products, loading } = useCatalog()
  const L = label(t, lang)

  // Saved order is the shopper's own, so keep it rather than sorting by date.
  const saved = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }, [ids, products])

  if (loading) {
    return (
      <div style={{ paddingBlock: 24 }}>
        <SkeletonGrid count={6} />
      </div>
    )
  }

  return (
    <div>
      <div className="pa-shop__head">
        <Link to="/home" className="pa-icon-btn" aria-label={L('back', 'Back', 'رجوع')}><IconBack /></Link>
        <div className="pa-shop__title">
          <h1>{L('saved', 'Saved', 'المفضلة')}</h1>
          <span className="pa-subtitle">{L('nItems', '{n} items', '{n} منتج').replace('{n}', saved.length)}</span>
        </div>
        <Link to="/cart" className="pa-icon-btn" aria-label={L('cart', 'Bag', 'العربية')}><IconBag /></Link>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon={<IconHeart width={32} height={32} />}
          title={L('nothingSaved', 'Nothing saved yet', 'مفيش حاجة محفوظة')}
          body={L('nothingSavedBody', 'Tap the heart on a product to keep it here for later.', 'دوس على القلب في أي منتج عشان تحفظه هنا.')}
          actionLabel={L('browseProducts', 'Browse products', 'شوف المنتجات')}
          to="/shop"
          as={Link}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px var(--pa-gutter) 0' }}>
            <button type="button" className="pa-btn pa-btn--sm pa-btn--outline" onClick={clear}>
              {L('clearSaved', 'Clear saved', 'امسح المفضلة')}
            </button>
          </div>
          <ProductGrid style={{ paddingTop: 12 }}>
            {saved.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                lang={lang}
                as={Link}
                href={`/product/${p.id}`}
                saved
                onSave={() => remove(p.id)}
                labels={{
                  onlyLeft: (n) => L('onlyNLeft', `Only ${n} left`, `باقي ${n} بس`),
                  remove: L('remove', 'Remove', 'إزالة')
                }}
              />
            ))}
          </ProductGrid>
          <div style={{ padding: '24px var(--pa-gutter) 48px', display: 'flex', justifyContent: 'center' }}>
            <Button variant="outline" as={Link} href="/shop">
              {L('keepShopping', 'Keep shopping', 'كمل تسوّق')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
