// Thin client for the /api routes.
//
// The browser never talks to Firestore for anything that decides money or
// stock any more; it talks to these routes. JSON in, JSON out, and a
// normalised result shape so callers do not re-implement error handling.

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const TIMEOUT_MS = 20000

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
    const data = text ? JSON.parse(text) : {}

    // 304 is a normal answer for the catalogue: the client already has this
    // version, so there is nothing to download.
    if (response.status === 304) return { __notModified: true }

    if (!response.ok) {
      const code = typeof data?.error === 'string' ? data.error : 'SERVER_ERROR'
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
    const wrapped = new Error('NETWORK_ERROR')
    wrapped.code = 'NETWORK_ERROR'
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
