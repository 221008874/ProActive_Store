import { createContext, useContext, useState } from 'react'

// The store sells in Egypt only, so the currency is fixed rather than
// detected. `currency` stays on the context because pages still read it.
const CURRENCY = 'EGP'

const LocationContext = createContext()

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null)
  const [country, setCountry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [permissionStatus, setPermissionStatus] = useState('prompt') // 'prompt', 'granted', 'denied'

  // Detect country from coordinates using reverse geocoding
  const detectCountryFromCoords = async (lat, lng) => {
    try {
      // Using OpenStreetMap Nominatim (free, no API key needed for basic usage)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3`
      )
      const data = await response.json()
      const detectedCountry = data.address?.country || 'Unknown'

      setCountry(detectedCountry)

      return { country: detectedCountry, currency: CURRENCY }
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      // Fallback to IP-based detection
      return await detectCountryFromIP()
    }
  }

  // Fallback: Detect country from IP
  const detectCountryFromIP = async () => {
    try {
      // Using ipapi.co (free tier: 30,000 requests/month, no key needed)
      const response = await fetch('https://ipapi.co/json/')
      const data = await response.json()
      
      setCountry(data.country_name)

      return { country: data.country_name, currency: CURRENCY }
    } catch (error) {
      console.error('IP detection error:', error)
      // Ultimate fallback: Egypt
      return { country: 'Egypt', currency: CURRENCY }
    }
  }

  // Request browser geolocation
  const requestLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setPermissionStatus('denied')
        resolve(detectCountryFromIP())
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ lat: latitude, lng: longitude })
          setPermissionStatus('granted')
          const result = await detectCountryFromCoords(latitude, longitude)
          resolve(result)
        },
        async (error) => {
          console.warn('Geolocation error:', error)
          setPermissionStatus('denied')
          // Fallback to IP detection if permission denied
          const result = await detectCountryFromIP()
          resolve(result)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  const value = {
    location,
    country,
    currency: CURRENCY,
    loading,
    permissionStatus,
    requestLocation,
    setLoading
  }

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