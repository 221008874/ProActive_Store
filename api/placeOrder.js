// POST /api/placeOrder
//
// The server is the only place an order's money and stock are decided. The
// storefront used to do this in the browser, where a tampered client could
// send any total it liked. Nothing here trusts the request beyond "which
// variant, how many".
//
// The route layer is deliberately thin: body parsing, the bot gate, request
// context (ip / user-agent / request id) and error mapping. All order logic
// lives in _core/orderCore.js, which is unit tested against a fake database.
//
// After the order commits, the bill is archived (PDF rendered server-side,
// pushed to the private document store). That step is best-effort by design:
// a shopper must never lose a paid order because a document store hiccuped.
// A failure leaves a status:"failed" metadata row that the admin retry
// endpoint and the backfill script pick up.

import { randomUUID } from "node:crypto";
import { getDb } from "./_core/serverDb.js";
import { verifyCaptcha } from "./_core/captcha.js";
import { generateOrderDocument } from "./_core/orderDocumentCore.js";

const { placeOrderTransaction, statusForError } = await import("./_core/orderCore.js");

// Behind Vercel's proxy the left-most hop is the client.
function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

export default async function handler(req, res) {
  const requestId = req.headers?.["x-vercel-id"] ?? randomUUID();
  res.setHeader("x-request-id", requestId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  } catch {
    return res.status(400).json({ error: "BAD_BODY" });
  }

  const captcha = await verifyCaptcha(body.captchaToken, clientIp(req));
  if (!captcha.ok) {
    return res.status(400).json({ error: "CAPTCHA_FAILED" });
  }

  try {
    const db = getDb();
    const result = await placeOrderTransaction(db, body, {
      context: {
        ip: clientIp(req),
        userAgent: req.headers?.["user-agent"] ?? null,
        source: body.source ?? "web"
      }
    });

    // Archive the bill. Never fails the order: any error is logged with the
    // request id, and the order carries a failed metadata row so the admin
    // retry endpoint or the backfill script can regenerate it.
    try {
      await generateOrderDocument(db, result.orderId, { docType: "invoice" });
    } catch (docError) {
      console.error(`order document archive failed [${requestId}] [${result.orderId}]:`, docError);
    }

    return res.status(200).json(result);
  } catch (error) {
    const status = statusForError(error);

    if (status === 500) {
      console.error(`placeOrder failed [${requestId}]:`, error);
      return res.status(500).json({ error: "SERVER_ERROR" });
    }

    // Expected, actionable problems: tell the client which one, and where.
    // OUT_OF_STOCK:dress:red_M becomes { error, detail } so the bag can mark
    // the exact line instead of failing the whole checkout opaquely.
    const raw = String(error?.code ?? error?.message ?? "SERVER_ERROR");
    const separator = raw.indexOf(":");
    const code = separator === -1 ? raw : raw.slice(0, separator);
    const detail = separator === -1 ? null : raw.slice(separator + 1);

    console.warn(`placeOrder refused [${requestId}]:`, raw);
    return res.status(status).json({ error: code, ...(detail ? { detail } : {}) });
  }
}
