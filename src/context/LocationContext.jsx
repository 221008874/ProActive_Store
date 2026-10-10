import { createContext, useContext, useState, useEffect } from 'react'

const LocationContext = createContext()

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null)
  const [country, setCountry] = useState(null)
  const [currency, setCurrency] = useState('EGP') // Default
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
      const countryCode = data.address?.country_code?.toUpperCase()
      
      setCountry(detectedCountry)
      
      // Determine currency based on country
      if (countryCode === 'EG' || detectedCountry.toLowerCase().includes('egypt')) {
        setCurrency('EGP')
      } else {
        setCurrency('USD') // Dollar for all other countries
      }
      
      return { country: detectedCountry, currency: countryCode === 'EG' ? 'EGP' : 'USD' }
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
      
      if (data.country_code === 'EG') {
        setCurrency('EGP')
      } else {
        setCurrency('USD')
      }
      
      return { country: data.country_name, currency: data.country_code === 'EG' ? 'EGP' : 'USD' }
    } catch (error) {
      console.error('IP detection error:', error)
      // Ultimate fallback: default to EGP
      setCurrency('EGP')
      return { country: 'Egypt', currency: 'EGP' }
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
    currency,
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