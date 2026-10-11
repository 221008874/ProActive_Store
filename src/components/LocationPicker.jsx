// Delivery location picker.
//
// A Leaflet map with a draggable pin, a Nominatim search box and a "use my
// location" button. The shopper drags the pin to their door rather than typing
// coordinates, because a wrong pin is a failed delivery.
//
// Geolocation is requested only when this component is asked for it (the
// governorate change, or the button) — never on mount. Browsers prompt once, so
// a refusal is remembered and the map still works by search or drag.

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { searchPlace } from '../utils/geo'

// Leaflet resolves its default marker relative to the CSS it was imported from,
// which Vite rewrites; the URLs have to be pointed back at the bundled assets.
// This is the shape the rest of the app (and its leaflet mock) already uses.
delete L.Marker.prototype._getIconUrl
L.Marker.prototype.options.icon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

const CAIRO = { lat: 30.0444, lng: 31.2357 }

export default function LocationPicker({ value, onChange, labels = {} }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const requestedRef = useRef(false)

  const [center, setCenter] = useState(value ?? CAIRO)
  const [mapError, setMapError] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  /* ------------------------------- map ------------------------------- */

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 15,
      // The page already scrolls; letting the map capture a two-finger drag
      // would trap a phone user on a half-screen map.
      scrollWheelZoom: false
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)

    const marker = L.marker([center.lat, center.lng], { draggable: true }).addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      onChange?.({ lat, lng })
    })

    mapRef.current = map
    markerRef.current = marker
    setMapLoading(false)

    // Leaflet measures its container on creation; a map created while its
    // parent is still laying out comes out at the wrong size.
    const raf = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Created once: later value changes move the marker through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow an external change (search result, "use my location") without
  // rebuilding the map.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !value) return
    mapRef.current.setView([value.lat, value.lng], mapRef.current.getZoom())
    markerRef.current.setLatLng([value.lat, value.lng])
  }, [value])

  /* ---------------------------- geolocation --------------------------- */

  const useMyLocation = useCallback(() => {
    if (requestedRef.current || value) return
    requestedRef.current = true
    setMapLoading(true)

    if (!navigator.geolocation) {
      setMapError(true); setCenter(CAIRO); setMapLoading(false); return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCenter(next); setMapError(false); setMapLoading(false)
        onChange?.(next)
      },
      (err) => {
        // A denial is not a blocker: the shopper can still search or drag.
        console.warn('Geolocation unavailable:', err)
        setMapError(true); setCenter(CAIRO); setMapLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [onChange, value])

  /* ------------------------------ search ----------------------------- */

  const runSearch = useCallback(async (e) => {
    e?.preventDefault()
    const term = query.trim()
    if (!term) return
    setSearching(true); setSearchError(null)
    try {
      const hits = await searchPlace(term, 5)
      setResults(hits)
      if (hits.length === 0) setSearchError(labels.noResults ?? 'No places matched')
    } catch (err) {
      console.error('Location search failed', err)
      setSearchError(labels.searchFailed ?? 'Search failed. Try again.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query, labels.noResults, labels.searchFailed])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form role="search" onSubmit={runSearch} style={{ display: 'flex', gap: 8 }}>
        <div className="pa-field" style={{ flex: '1 1 auto' }}>
          <label className="pa-label" htmlFor="map-search">{labels.search ?? 'Search for a place'}</label>
          <input
            id="map-search"
            className="pa-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder ?? 'Area, street, or landmark'}
          />
        </div>
        <button type="submit" className="pa-btn pa-btn--outline pa-btn--compact"
          style={{ alignSelf: 'flex-end' }} disabled={searching}>
          {searching ? (labels.searching ?? 'Searching…') : (labels.searchButton ?? 'Search')}
        </button>
      </form>

      {searchError && <div className="pa-error">{searchError}</div>}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                className="pa-chip"
                style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'start', height: 'auto', minHeight: 44, whiteSpace: 'normal' }}
                onClick={() => {
                  onChange?.({ lat: r.lat, lng: r.lon })
                  setResults([]); setQuery(r.displayName ?? '')
                }}
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={containerRef} style={{ height: 170, background: 'var(--pa-stone)' }} aria-hidden="true" />
      <p className="pa-subtitle" style={{ margin: 0 }}>
        {mapLoading ? (labels.loading ?? 'Finding you…') : (labels.dragHint ?? 'Drag the pin to your door')}
      </p>
      {mapError && <div className="pa-error">{labels.locationDenied ?? 'Location unavailable. Search or drag the pin instead.'}</div>}

      <button type="button" className="pa-btn pa-btn--outline pa-btn--compact" onClick={useMyLocation} disabled={!!value}>
        {(labels.useMyLocation ?? 'Use my location')}
      </button>
    </div>
  )
}
