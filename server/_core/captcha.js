// Bot gate for order placement.
//
// A store with cash-on-delivery attracts scripts. The check runs server-side
// against Cloudflare Turnstile (CAPTCHA_SECRET); App Check tokens can replace
// it later without changing the call sites.
//
// When no secret is configured the gate is OPEN: local development and
// preview deployments must not be blocked by a missing credential, and the
// rate limits in orderCore still apply. Production sets CAPTCHA_SECRET.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaConfigured(secret = process.env.CAPTCHA_SECRET) {
  return Boolean(secret && String(secret).trim());
}

/**
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function verifyCaptcha(token, remoteIp, { secret = process.env.CAPTCHA_SECRET, fetchImpl = fetch } = {}) {
  if (!captchaConfigured(secret)) return { ok: true };

  const response = String(token ?? "").trim();
  if (!response) return { ok: false, reason: "missing" };

  try {
    const params = new URLSearchParams({ secret: String(secret), response });
    if (remoteIp) params.set("remoteip", remoteIp);

    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const data = await res.json().catch(() => null);
    if (data?.success !== true) {
      const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].join(",") : "rejected";
      return { ok: false, reason: codes };
    }
    return { ok: true };
  } catch (error) {
    // A verifier outage must not take checkout down: the anti-abuse controls
    // in orderCore still guard the order.
    console.error("captcha verification failed to reach the provider:", error.message);
    return { ok: true };
  }
}
