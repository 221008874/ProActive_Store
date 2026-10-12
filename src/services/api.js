// Thin client for the /api routes.
//
// The browser never talks to Firestore for anything that decides money or
// stock any more; it talks to these routes. JSON in, JSON out, and a
// normalised result shape so callers do not re-implement error handling.

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const TIMEOUT_MS = 20000

// A response the store cannot read is almost always one of three things: the
// serverless function is not deployed (Vercel's SPA fallback answers with the
// site's own index.html), the function threw (a 500 page of HTML), or a proxy
// returned an error page. All three look identical to `JSON.parse`, so the
// status, the content-type and the head of the body are logged together: that
// trio is the whole diagnosis, and without it the failure is a shrug.
const PREVIEW_CHARS = 200

function describeUnparseable(response, text) {
  const head = (text ?? '').replace(/\s+/g, ' ').slice(0, PREVIEW_CHARS)
  console.error(
    `[api] ${response.status} ${response.url} content-type=${response.headers.get('content-type') ?? 'none'} body[0..${head.length}]=${head}`
  )
  return head
}

async function request(path, { method = 'GET', body, timeout = TIMEOUT_MS, headers } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    const text = await response.text()

    // 304 is a normal answer for the catalogue: the client already has this
    // version, so there is nothing to download. Checked before parsing because
    // a 304 has no body at all.
    if (response.status === 304) return { __notModified: true }

    let data = null
    let parsed = true
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      parsed = false
    }

    if (!parsed) {
      const preview = describeUnparseable(response, text)
      // A 200 that is not JSON is the "function is not deployed, the SPA
      // fallback answered" case. Flagged separately from a plain 404 because
      // the status lies: the route 404s from the browser's point of view.
      const code = response.ok ? 'E-API-NOT-JSON' : `E-API-${response.status}`
      const error = new Error(code)
      error.code = code
      error.status = response.status
      error.contentType = response.headers.get('content-type')
      error.preview = preview
      throw error
    }

    if (!response.ok) {
      const code = typeof data?.error === 'string' ? data.error : `E-API-${response.status}`
      const error = new Error(code)
      error.code = code
      error.detail = typeof data?.detail === 'string' ? data.detail : null
      error.status = response.status
      error.data = data
      throw error
    }

    return data
  } catch (error) {
    if (error.code) throw error
    const aborted = error?.name === 'AbortError'
    const wrapped = new Error(aborted ? 'E-API-TIMEOUT' : 'E-API-NETWORK')
    wrapped.code = wrapped.message
    wrapped.cause = error
    throw wrapped
  } finally {
    clearTimeout(timer)
  }
}

export function getJson(path, options) {
  return request(path, { ...options, method: 'GET' })
}

export function postJson(path, body, options) {
  return request(path, { ...options, method: 'POST', body })
}

export { API_BASE }
