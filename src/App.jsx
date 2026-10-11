import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { LocationProvider } from './context/LocationContext'
import StoreChrome from './components/StoreChrome'
import Home from './pages/Home'
import { SkeletonGrid } from './ui'

// Route-level code splitting.
//
// Home is eager because it is the landing page and the shell already needs the
// catalogue for it. Everything else splits, so a shopper who never opens the
// bag never downloads pdfmake, and one who never opens a product page never
// downloads the product page.
const ShopPage = lazy(() => import('./pages/ShopPage'))
const SavedPage = lazy(() => import('./pages/SavedPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const AboutUs = lazy(() => import('./pages/AboutUs'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'))
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'))
const CouponLanding = lazy(() => import('./pages/CouponLanding'))

// The two full-viewport entry screens are tiny and must not flash, so they
// stay eager: a country gate that freezes for a chunk download looks broken.
const CountryGate = lazy(() => import('./pages/CountryGate'))
const Splash = lazy(() => import('./pages/Splash'))

// Dev-only gallery of the design system. Imported behind a DEV guard so the
// route, its components and its strings are dropped from the production build.
// Delete this block and src/pages/UiGallery.jsx together.
const UiGallery = lazy(() => import('./pages/UiGallery'))

/** Shown while a route chunk downloads. A grid of card skeletons, so the hole
 *  matches what is about to land instead of a centred spinner. */
function RouteFallback() {
  return (
    <div style={{ paddingTop: 24 }} role="status" aria-live="polite">
      <SkeletonGrid count={6} />
      <span className="pa-sr">Loading…</span>
    </div>
  )
}

// Everything under here shares the announcement bar, header and phone tab bar.
function StoreLayout() {
  return (
    <StoreChrome>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </StoreChrome>
  )
}

function App() {
  return (
    <LocationProvider>
      <Routes>
        {/* The country gate owns the whole viewport: no header, no tab bar.
            /splash follows it, also full-viewport, because the store is not
            on screen yet. */}
        <Route path="/" element={<Suspense fallback={null}><CountryGate /></Suspense>} />
        <Route path="/splash" element={<Suspense fallback={null}><Splash /></Suspense>} />

        <Route element={<StoreLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/coupon/:code" element={<CouponLanding />} />

          {import.meta.env.DEV && <Route path="/_ui" element={<UiGallery />} />}
        </Route>
      </Routes>
    </LocationProvider>
  )
}

export default App
