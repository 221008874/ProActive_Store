// Address geocoding helpers for the checkout map picker.

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