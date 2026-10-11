// The one Serverless Function that serves every /api route.
//
// Vercel's Hobby plan allows 12 functions per deployment. This API has 22
// routes, so it could not be deployed at all: the build was rejected before it
// started. Rather than drop routes or pay to upgrade, they all live in `server/`
// (a normal directory Vercel does not scan for routes) and this file dispatches
// to them by path.
//
// The URLs are unchanged. Vercel routes /api/catalog, /api/placeOrder,
// /api/admin/order/status and the four cron paths into this catch-all, so no
// client, cron schedule or rewrite had to move - the public surface of the API
// is exactly what it was when each route was its own file.
//
// What this costs, stated plainly: the routes now share a cold start and a
// failure domain. One bad import takes down all of them, where before an
// exception in /api/geocode could not affect checkout. That is the trade for
// fitting the Hobby limit; moving back to one function per route is a
// mechanical change to this file plus restoring the api/ paths on upgrade.

import adminCatalogRebuild from "../server/admin/catalog/rebuild.js";
import adminCloudinarySign from "../server/admin/cloudinary/sign.js";
import adminDocumentsDownload from "../server/admin/documents/download.js";
import adminImport from "../server/admin/import.js";
import adminOrderDocumentRetry from "../server/admin/order/document/retry.js";
import adminOrderStatus from "../server/admin/order/status.js";
import adminStockAdjust from "../server/admin/stock/adjust.js";
import cartCheck from "../server/cart/check.js";
import catalog from "../server/catalog.js";
import couponPreview from "../server/coupon/preview.js";
import cronCatalog from "../server/cron/catalog.js";
import cronNotify from "../server/cron/notify.js";
import cronRollup from "../server/cron/rollup.js";
import cronStuckOrders from "../server/cron/stuck-orders.js";
import geocode from "../server/geocode.js";
import health from "../server/health.js";
import og from "../server/og.js";
import placeOrder from "../server/placeOrder.js";
import product from "../server/product.js";
import reverse from "../server/reverse.js";
import robots from "../server/robots.js";
import sitemap from "../server/sitemap.js";

// Keyed by the path after /api, which is also the path the file used to live at
// - so this table reads as the old file tree.
const ROUTES = {
  "health": health,
  "catalog": catalog,
  "product": product,
  "cart/check": cartCheck,
  "coupon/preview": couponPreview,
  "geocode": geocode,
  "placeOrder": placeOrder,
  "reverse": reverse,
  "og": og,
  "robots": robots,
  "sitemap": sitemap,
  "admin/order/status": adminOrderStatus,
  "admin/stock/adjust": adminStockAdjust,
  "admin/catalog/rebuild": adminCatalogRebuild,
  "admin/cloudinary/sign": adminCloudinarySign,
  "admin/import": adminImport,
  "admin/documents/download": adminDocumentsDownload,
  "admin/order/document/retry": adminOrderDocumentRetry,
  "cron/catalog": cronCatalog,
  "cron/rollup": cronRollup,
  "cron/stuck-orders": cronStuckOrders,
  "cron/notify": cronNotify
};

// The unknown-route reply. Deliberately a 404 JSON rather than the SPA
// fallback: a typo in an /api path must not silently return index.html.
function notFound(path) {
  return { status: 404, body: { error: "NOT_FOUND", path: `/api/${path}` } };
}

/** The path after /api, normalised: no empty segments, no leading slash. */
export function routeKey(pathParam) {
  const segments = Array.isArray(pathParam) ? pathParam : [pathParam];
  return segments.filter((s) => s !== undefined && s !== null && s !== "").join("/");
}

/**
 * The path this request is for, taken from the URL itself.
 *
 * The catch-all parameter is not reliably populated across every Vercel runtime
 * and local runner - when it is missing the lookup silently resolves to "" and
 * every route 404s. req.url is always present and always the real path, so it
 * is the source of truth; the query parameter is only a fallback.
 */
export function pathFromRequest(req) {
  const url = req?.url;
  if (typeof url === "string" && url.includes("/api/")) {
    const withoutQuery = url.split("?")[0];
    return routeKey(withoutQuery.replace(/^.*\/api\/?/, ""));
  }
  return routeKey(req?.query?.path);
}

/** The handler for a path after /api, or null when nothing is mounted there. */
export function resolveRoute(pathParam) {
  return ROUTES[routeKey(pathParam)] ?? null;
}

export default async function handler(req, res) {
  const key = pathFromRequest(req);
  const route = ROUTES[key];

  if (!route) {
    const { status, body } = notFound(key);
    return res.status(status).json(body);
  }

  // Handlers read their own params from req.query; the path segments ride along
  // harmlessly because none of them iterate the whole object.
  return route(req, res);
}