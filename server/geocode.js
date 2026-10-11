// GET /api/geocode?q=<address> — address search for the delivery map.
// Cached 30 days by normalised query; rate-limited at the source (see
// _core/geocode.js) so the public Nominatim instance is never hammered.

import { geocodeSearch } from "./_core/geocode.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const query = String(req.query?.q ?? "").trim();
  if (query.length < 3) return res.status(400).json({ error: "BAD_QUERY" });

  try {
    const results = await geocodeSearch(query);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.status(200).json({ results });
  } catch (error) {
    console.error("geocode failed:", error.message);
    return res.status(502).json({ error: "GEOCODER_UNAVAILABLE" });
  }
}
