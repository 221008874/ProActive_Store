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

  it("prefers the rewrite's path over the request URL", () => {
    // Nested routes only reach the function through a rewrite, and req.url is
    // still the original request. Reading the URL here would send
    // /api/cart/check to the "cart/check" key as "" and 404 every nested route.
    expect(pathFromRequest({ url: "/api/cart/check", query: { path: "cart/check" } })).toBe("cart/check")
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

// A cross-origin admin call is always preflighted, because it carries an
// Authorization header. The panel runs on its own domain, so a preflight that
// answers 405 means the browser never gets a CORS blessing and the route is
// unreachable from the panel - which is exactly what happened to five of the
// seven admin routes: the method check ran before any preflight handling, so
// "Publish changes" (and stock adjust, order status, the CSV import and the
// Cloudinary signer) could only ever be driven from a cron or a script.
// The rule each route must satisfy: answer OPTIONS with CORS headers BEFORE the
// method check, and never echo an origin that is not on the ADMIN_ALLOWED_ORIGINS
// list.
describe("admin routes answer the CORS preflight", () => {
  const ROUTES = [
    "admin/order/status",
    "admin/stock/adjust",
    "admin/catalog/rebuild",
    "admin/cloudinary/sign",
    "admin/import",
    "admin/documents/download",
    "admin/order/document/retry"
  ];

  for (const route of ROUTES) {
    it(`${route} handles OPTIONS before its method check`, async () => {
      // No Origin header: the preflight path must still run and terminate the
      // response (204), rather than fall through to the 405 method guard.
      const res = stubRes();
      await handler({ query: { path: route.split("/") }, method: "OPTIONS", headers: {} }, res);

      expect(res.statusCode, `${route} did not answer the preflight`).toBe(204);
      // No JSON body: a preflight must terminate, not fall through to the
      // method guard and return an error payload the browser would surface.
      expect(res.body?.error).toBeUndefined();
    });
  }
});

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

// The one route the storefront cannot work without. placeOrder used to name
// its response field `body`, which shadowed the request body for the whole try
// block, so the very first read of the request threw "Cannot access 'body'
// before initialization" and EVERY checkout answered 500 SERVER_ERROR - in
// production, for days, with a green build, because nothing ever called the
// route. getDb() runs before any validation, so with no credentials this route
// always 500s locally; the assertion is therefore not the code but the ERROR
// KIND: an env/db failure (reachable, explained) and never a ReferenceError.
describe("placeOrder regression: the TDZ shadowing bug", () => {
  it("does not declare a block-scoped `body` that would shadow the request body", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("../../server/placeOrder.js", import.meta.url),
      "utf8"
    );
    // A `const { ...body } = result` inside the try block is the exact defect:
    // it declares a block-scoped `body` that shadows the outer request body for
    // the whole block, so the earlier `placeOrderTransaction(db, body)` throws.
    expect(source).not.toMatch(/\b(?:const|let|var)\s*\{[^}]*\.\.\.body\b/);
    // And the response must not be named `body` either.
    expect(source).not.toMatch(/\.\.\.body\s*\}/);
  });

  it("answers with a database/credential error, never a ReferenceError", async () => {
    const errors = [];
    const realError = console.error;
    console.error = (...args) => { errors.push(args.map(String).join(" ")); };
    try {
      const res = stubRes();
      await handler(
        {
          query: { path: ["placeOrder"] },
          method: "POST",
          headers: {},
          body: { cart: [], customer: {}, address: {} }
        },
        res
      );
      expect(res.statusCode).toBe(500); // no credentials in unit tests
      expect(res.body?.error).toBe("SERVER_ERROR");
    } finally {
      console.error = realError;
    }
    // The signature of the bug was this exact message in the log.
    const logged = errors.join("\n");
    expect(logged).not.toMatch(/Cannot access 'body' before initialization/);
  });
})