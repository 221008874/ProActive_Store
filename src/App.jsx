import { Routes, Route } from 'react-router-dom'
import { LocationProvider } from './context/LocationContext'
import LocationSplash from './pages/LocationSplash'
import Splash from './pages/Splash'
import Home from './pages/Home'
import CartPage from './pages/CartPage'
import ProductDetail from './pages/ProductDetail'
import AboutUs from './pages/AboutUs'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import OrderSuccess from './pages/OrderSuccess'      // ← MAKE SURE THIS IS IMPORTED
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentCancel from './pages/PaymentCancel'
import CouponLanding from './pages/CouponLanding'

function App() {
  return (
    <LocationProvider>
      <Routes>
        <Route path="/" element={<LocationSplash />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/home" element={<Home />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        
        {/* THESE ARE THE IMPORTANT ONES: */}
        <Route path="/order-success" element={<OrderSuccess />} />      // ← COD orders
        <Route path="/payment/success" element={<PaymentSuccess />} /> // ← Card payments
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="/coupon/:code" element={<CouponLanding />} />

      </Routes>
    </LocationProvider>
  )
}

export default App