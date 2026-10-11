import { Routes, Route, Outlet } from 'react-router-dom'
import { LocationProvider } from './context/LocationContext'
import StoreChrome from './components/StoreChrome'
import Splash from './pages/Splash'
import Home from './pages/Home'
import ShopPage from './pages/ShopPage'
import CartPage from './pages/CartPage'
import ProductDetail from './pages/ProductDetail'
import AboutUs from './pages/AboutUs'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import OrderSuccess from './pages/OrderSuccess'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentCancel from './pages/PaymentCancel'
import CouponLanding from './pages/CouponLanding'
import SavedPage from './pages/SavedPage'
import CountryGate from './pages/CountryGate'

// Dev-only gallery of the design system. Imported behind a DEV guard so the
// route, its components and its strings are dropped from the production build.
// Delete this block and src/pages/UiGallery.jsx together.
import UiGallery from './pages/UiGallery'

// Everything under here shares the announcement bar, header and phone tab bar.
function StoreLayout() {
  return (
    <StoreChrome>
      <Outlet />
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
        <Route path="/" element={<CountryGate />} />
        <Route path="/splash" element={<Splash />} />

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
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/coupon/:code" element={<CouponLanding />} />

          {import.meta.env.DEV && <Route path="/_ui" element={<UiGallery />} />}
        </Route>
      </Routes>
    </LocationProvider>
  )
}

export default App
