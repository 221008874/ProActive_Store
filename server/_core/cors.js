// Cross-origin headers for the /api/admin routes the admin PANEL calls.
//
// ProActive_Admin is deployed on its own domain, so its calls to the store's
// admin endpoints are cross-origin and carry an Authorization header — and a
// request with an Authorization header is always preflighted with OPTIONS.
// Without this helper the browser stops at the preflight and the admin panel
// can never reach these routes; no other store API needs it today (the
// storefront is same-origin).
//
// Fail closed by design: with no ADMIN_ALLOWED_ORIGINS configured, no
// cross-origin request is accepted. The store owner lists the admin
// deployment origin(s) explicitly (comma-separated), and only that exact
// origin is echoed back — never reflected from any caller.

const ALLOWED_HEADERS = "authorization, content-type";
const ALLOWED_METHODS = "GET, POST, OPTIONS";

function configuredOrigins() {
  return (process.env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

// Echoes the caller's origin only when it is on the allowlist.
export function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (!origin || !configuredOrigins().includes(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
}

// Handles the preflight. Returns true when the response is complete.
export function handlePreflight(req, res, methods = ALLOWED_METHODS) {
  if (req.method !== "OPTIONS") return false;
  res.setHeader("Allow", methods);
  applyCors(req, res);
  res.status(204).end();
  return true;
}
