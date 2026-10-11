// GET /api/cron/catalog — rebuild the catalogue snapshot when it is dirty.
//
// Runs every 10-15 minutes from Vercel Cron. The dirty flag is set by
// placeOrder (stock moved), by admin edits and by cancellations, so a busy
// day costs a few rebuilds rather than a rebuild per admin click.

import { getDb } from "../_core/serverDb.js";
import { collectCatalogData, writeSnapshot } from "../_core/catalogCore.js";
import { isCronAuthorized } from "../_core/cronAuth.js";

export default async function handler(req, res) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const db = getDb();
    const flagSnap = await db.doc("egp_settings/catalog").get();
    const flag = flagSnap.exists ? flagSnap.data() : {};

    if (flag.dirty !== true) {
      return res.status(200).json({ ok: true, rebuilt: false, reason: "not-dirty", version: flag.version ?? null });
    }

    const snapshot = await collectCatalogData(db);
    const result = await writeSnapshot(db, snapshot);

    console.log(`cron catalog rebuild: version ${result.version}, ${result.productCount} products`);
    return res.status(200).json({ ok: true, rebuilt: true, ...result });
  } catch (error) {
    console.error("cron catalog rebuild failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
