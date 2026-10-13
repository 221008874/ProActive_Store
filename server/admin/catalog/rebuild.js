// POST /api/admin/catalog/rebuild — publish the catalogue snapshot now.
//
// The Admin "Publish changes" button calls this; the scheduled job calls the
// same builder. Either way the snapshot is written in one batch and the
// dirty flag clears, so the next /api/catalog read serves the new version.

import { getDb } from "../../_core/serverDb.js";
import { requireAdmin } from "../../_core/authz.js";
import { applyCors, handlePreflight } from "../../_core/cors.js";
import { collectCatalogData, writeSnapshot } from "../../_core/catalogCore.js";

export default async function handler(req, res) {
  // The preflight MUST be answered before the method check below: a preflight
  // is an OPTIONS request, and the admin panel runs on its own origin, so it is
  // always preflighted. Answering 405 here (as this route did) meant the browser
  // never got a CORS blessing and the panel's "Publish changes" button could not
  // reach this route at all - the publish only ever happened from the cron.
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const db = getDb();
    const snapshot = await collectCatalogData(db);
    const result = await writeSnapshot(db, snapshot);

    console.log(`catalog rebuilt by ${auth.email ?? auth.uid}: version ${result.version}, ${result.productCount} products in ${result.shards} shard(s)`);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("catalog rebuild failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
