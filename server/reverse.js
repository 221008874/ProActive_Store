// GET /api/reverse?lat=&lng= — turn a map pin into a human address.
// Same policy as /api/geocode: cached 30 days, rate-limited upstream.

import { reverseGeocode } from "./_core/geocode.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const { lat, lng } = req.query ?? {};
  try {
    const result = await reverseGeocode(Number(lat), Number(lng));
    if (!result) return res.status(400).json({ error: "BAD_COORDS" });

    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.status(200).json(result);
  } catch (error) {
    console.error("reverse geocode failed:", error.message);
    return res.status(502).json({ error: "GEOCODER_UNAVAILABLE" });
  }
}
