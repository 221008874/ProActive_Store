import { createContext, useContext } from 'react'

// The store sells in Egypt only, so the currency is fixed rather than detected.
//
// The browser's geolocation used to be requested here, on the entry splash
// screen. That meant a permission dialog fired before the shopper had done
// anything — the single worst moment to ask, and the reason people denied it and
// then could not set a delivery address. It is now requested by the cart page,
// and only when the shopper picks a governorate: the point at which a location
// actually matters to the order.
//
// `currency` stays on the context because every page reads it.

const CURRENCY = 'EGP'

const LocationContext = createContext()

export function LocationProvider({ children }) {
  const value = { currency: CURRENCY }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}

export const useLocation = () => {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider')
  }
  return context
}
