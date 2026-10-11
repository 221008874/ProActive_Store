import { useEffect, useState } from 'react'

/**
 * Tracks browser connectivity.
 *
 * navigator.onLine only says whether there is a network connection, not whether
 * anything actually loads — a captive portal or a dead backend both report
 * "online". It is still the right signal for the banner, because the thing it
 * predicts is real: if this flips to false the catalogue on screen is the one
 * saved in IndexedDB, and the shopper needs to know that before they trust the
 * stock numbers.
 *
 * Starts as `true` rather than reading navigator.onLine during render: the
 * initial value only decides whether the banner flashes on the first paint, and
 * reading it in an effect keeps the server and client markup identical (the
 * storefront is rendered to a string in its smoke tests).
 */
export function useOnline() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return online
}

export default useOnline