// GET /api/health — liveness for the uptime monitor. Deliberately cheap: it
// answers 200 as long as the function itself is alive, without spending a
// Firestore read per poll.

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, at: new Date().toISOString() });
}
