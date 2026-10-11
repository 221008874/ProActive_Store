// GET /api/cron/notify — flush the notification outbox.
//
// New orders and stuck-order reminders are queued as outbox rows by the
// routes that create them; this job delivers them. The delivery target is an
// inbound webhook URL (EMAIL_WEBHOOK_URL — Resend, Zapier, a Make scenario,
// anything that accepts a JSON POST), so the store does not depend on one
// email provider and the owner can swap it without a code change.
//
// A failed delivery is retried with a capped attempt count and then left as
// `failed` for a human, rather than dropped silently.

import { getDb } from "../_core/serverDb.js";
import { isCronAuthorized } from "../_core/cronAuth.js";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

export default async function handler(req, res) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (!webhook) {
    // Nothing is misconfigured: with no webhook there is nothing to deliver,
    // and the admin still sees orders in the dashboard.
    return res.status(200).json({ ok: true, sent: 0, reason: "no-webhook" });
  }

  try {
    const db = getDb();
    const pending = await db
      .collection("outbox")
      .where("status", "==", "pending")
      .limit(BATCH_SIZE)
      .get();

    let sent = 0;
    let failed = 0;

    for (const doc of pending.docs) {
      const entry = doc.data();
      const attempts = Number(entry.attempts ?? 0) + 1;

      try {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: entry.type,
            at: entry.at ?? null,
            payload: entry.payload ?? {}
          })
        });

        if (!response.ok) throw new Error(`webhook answered ${response.status}`);

        await doc.ref.update({ status: "sent", attempts, sentAt: Date.now() });
        sent += 1;
      } catch (error) {
        const exhausted = attempts >= MAX_ATTEMPTS;
        await doc.ref.update({
          status: exhausted ? "failed" : "pending",
          attempts,
          lastError: String(error.message).slice(0, 200)
        });
        failed += 1;
      }
    }

    console.log(`cron notify: ${sent} sent, ${failed} failed of ${pending.size}`);
    return res.status(200).json({ ok: true, sent, failed, total: pending.size });
  } catch (error) {
    console.error("cron notify failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
