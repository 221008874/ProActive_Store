import { it, expect, describe } from "vitest";

// The single-function dispatcher.
//
// Vercel's Hobby plan forces all 22 routes through api/[...path].js. That makes
// the ROUTES table the only thing standing between a typo and a 404 in
// production, so it is checked directly rather than only through HTTP.

if (typeof window === "undefined") {
  const mkEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} });
  const doc = {
    documentElement: { dataset: {}, style: {}, setAttribute() {}, lang: "", dir: "" },
    body: { style: {}, appendChild() {}, className: "" },
    head: { appendChild() {} },
    createElement: mkEl,
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.window = {
    document: doc,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280, innerHeight: 800,
    location: { hash: "" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  };
  globalThis.document = doc
  globalThis.localStorage = window.localStorage
}

import handler, { routeKey, resolveRoute, pathFromRequest } from "../../api/[...path].js";

// Every path the storefront, the admin panel, vercel.json or a cron depends on.
// A path missing from this list is a route that would 404 in production.
const REQUIRED_PATHS = [
  "health", "catalog", "product", "cart/check", "coupon/preview", "geocode",
  "placeOrder", "reverse", "og", "robots", "sitemap",
  "admin/order/status", "admin/stock/adjust", "admin/catalog/rebuild",
  "admin/cloudinary/sign", "admin/import", "admin/documents/download",
  "admin/order/document/retry",
  "cron/catalog", "cron/rollup", "cron/stuck-orders", "cron/notify"
]

const stubRes = () => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
    setHeader(k, v) { this.headers[k] = v },
    end() { return this },
    write() { return true }
  }
  return res
}

describe("routeKey", () => {
  it("joins the catch-all segments", () => {
    expect(routeKey(["admin", "order", "status"])).toBe("admin/order/status")
  })

  it("drops empty segments so a trailing slash still resolves", () => {
    expect(routeKey(["catalog", ""])).toBe("catalog")
    expect(routeKey(["cart", "", "check"])).toBe("cart/check")
  })

  it("copes with a missing or scalar path", () => {
    expect(routeKey(undefined)).toBe("")
    expect(routeKey("catalog")).toBe("catalog")
  })
})

describe("pathFromRequest", () => {
  it("reads the path from the URL, query string and all", () => {
    expect(pathFromRequest({ url: "/api/health" })).toBe("health")
    expect(pathFromRequest({ url: "/api/product?id=dress&v=2" })).toBe("product")
    expect(pathFromRequest({ url: "/api/admin/order/status" })).toBe("admin/order/status")
  })

  it("falls back to the catch-all parameter when there is no URL", () => {
    expect(pathFromRequest({ query: { path: ["catalog"] } })).toBe("catalog")
    expect(pathFromRequest({ query: { path: ["cart", "check"] } })).toBe("cart/check")
  })
})

describe("resolveRoute", () => {
  it("mounts every path the clients and crons call", () => {
    const missing = REQUIRED_PATHS.filter((p) => typeof resolveRoute(p) !== "function")
    expect(missing).toEqual([])
  })

  it("does not resolve anything for an unknown path", () => {
    expect(resolveRoute("nope")).toBeNull()
    expect(resolveRoute(["admin", "nope"])).toBeNull()
  })
})

describe("handler", () => {
  it("serves a mounted route", async () => {
    const res = stubRes()
    await handler({ query: { path: ["health"] }, method: "GET" }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it("resolves a nested admin route", async () => {
    const res = stubRes()
    // Unauthenticated, so the guard rejects it - but the 401 proves the route
    // was reached, which is what a broken table would turn into a 404.
    await handler({ query: { path: ["admin", "order", "status"] }, method: "POST", headers: {} }, res)
    expect(res.statusCode).not.toBe(404)
  })

  it("returns a JSON 404 for an unknown api path, never the SPA", async () => {
    const res = stubRes()
    await handler({ query: { path: ["not-a-route"] }, method: "GET" }, res)
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe("NOT_FOUND")
    // index.html would look like a successful page to a fetch caller.
    expect(typeof res.body).toBe("object")
  })
})