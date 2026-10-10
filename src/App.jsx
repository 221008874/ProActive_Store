import { Routes, Route, Outlet } from 'react-router-dom'
import { LocationProvider } from './context/LocationContext'
import StoreChrome from './components/StoreChrome'
import LocationSplash from './pages/LocationSplash'
import Splash from './pages/Splash'
import Home from './pages/Home'
import CartPage from './pages/CartPage'
import ProductDetail from './pages/ProductDetail'
import AboutUs from './pages/AboutUs'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import OrderSuccess from './pages/OrderSuccess'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentCancel from './pages/PaymentCancel'
import CouponLanding from './pages/CouponLanding'

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
        {/* Splash / intro routes own the whole viewport: no header, no tab bar. */}
        <Route path="/" element={<LocationSplash />} />
        <Route path="/splash" element={<Splash />} />

        <Route element={<StoreLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/coupon/:code" element={<CouponLanding />} />
        </Route>
      </Routes>
    </LocationProvider>
  )
}

export default App
