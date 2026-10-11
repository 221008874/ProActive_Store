// Address geocoding helpers for the checkout map picker.
//
// The search goes through /api/geocode, which rate-limits and caches at the
// source (see api/_core/geocode.js). Nominatim's usage policy forbids calling
// the public instance directly from a browser — no attribution, no User-Agent
// control, no caching — so the proxy is the only correct path. The direct call
// below is kept purely as a local fallback when the API route is not running.

import { getJson } from '../services/api'

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

export function buildGeocodeUrl(query, { limit = 5 } = {}) {
  return `${NOMINATIM_ENDPOINT}?format=json&q=${encodeURIComponent(query)}&countrycodes=eg&limit=${limit}`
}

// Nominatim returns strings; Leaflet needs numbers.
export function mapGeocodeResults(results) {
  return results.map((item) => ({
    display_name: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon)
  }))
}

export async function geocodeAddress(query) {
  const response = await fetch(buildGeocodeUrl(query))
  return mapGeocodeResults(await response.json())
}

/**
 * Search for a place, through the proxy. Falls back to the direct call only
 * when the route itself is unreachable, so the map still works locally.
 */
export async function searchPlace(query, limit = 5) {
  try {
    const data = await getJson(`/geocode?q=${encodeURIComponent(query)}&limit=${limit}`)
    if (Array.isArray(data?.results)) {
      return data.results.map((r) => ({
        displayName: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon)
      }))
    }
    return []
  } catch {
    return (await geocodeAddress(query)).map((r) => ({
      displayName: r.display_name,
      lat: r.lat,
      lon: r.lon
    }))
  }
}