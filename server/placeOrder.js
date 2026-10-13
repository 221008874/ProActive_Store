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
// pushed to the private document store) and the owner is told. That step is
// best-effort by design: a shopper must never lose a paid order because a
// document store or a webhook hiccuped. A failure leaves a status:"failed"
// metadata row that the admin retry endpoint and the backfill script pick up.
//
// The notification is inline because Vercel's Hobby plan runs crons once a day,
// and "the shop took an order" is not a message worth waiting a day for. The
// outbox row is still written, so the nightly notify cron is the retry path:
// whatever this cannot deliver is still queued.

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

// A webhook that hangs must not hold a shopper on the checkout page, so it
// gets a hard deadline well inside the function budget. Failing here is fine:
// the outbox row is still pending and the nightly cron retries it.
const WEBHOOK_TIMEOUT_MS = 5000;

// Posts the new-order payload to EMAIL_WEBHOOK_URL and, only on success, marks
// the outbox row delivered so the nightly cron does not send it twice.
export async function deliverNewOrder(db, result) {
  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (!webhook || !result?.outboxRef) return { delivered: false, reason: "not-configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "new_order",
        at: Date.now(),
        payload: {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          name: result.customer?.name ?? null,
          phone: result.customer?.phone ?? null,
          total: result.total,
          itemCount: result.items?.length ?? 0
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`webhook answered ${response.status}`);

    await result.outboxRef.update({ status: "sent", attempts: 1, sentAt: Date.now() });
    return { delivered: true };
  } finally {
    clearTimeout(timer);
  }
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

    // Tell the owner, inline, and mark the outbox row delivered when it lands.
    // Failure is silent by design: the row stays pending and the nightly cron
    // retries it with a backoff.
    try {
      await deliverNewOrder(db, result);
    } catch (notifyError) {
      console.warn(`order notification deferred [${requestId}] [${result.orderId}]:`, notifyError.message);
    }

    // The route's internal ref never reaches the shopper.
    //
    // The response field must not be named `body`: a `const` named `body` inside
    // this block would shadow the request body read above for the WHOLE block,
    // so `placeOrderTransaction(db, body, ...)` would throw
    // "Cannot access 'body' before initialization" and every checkout 500.
    const { outboxRef: _outboxRef, ...response } = result;
    return res.status(200).json(response);
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
