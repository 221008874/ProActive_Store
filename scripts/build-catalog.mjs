// Rebuild the catalogue snapshot from the command line.
//
//   SERVICE_ACCOUNT=./sa.json node scripts/build-catalog.mjs
//
// The same builder the /api/cron/catalog route and the Admin "Publish
// changes" button run; this is for local verification and one-off repairs.

import fs from "node:fs";

const keyPath = process.env.SERVICE_ACCOUNT;
if (!keyPath) {
  console.error("Set SERVICE_ACCOUNT to the path of the service account key JSON.");
  process.exit(1);
}
if (!fs.existsSync(keyPath)) {
  console.error(`Service account file not found: ${keyPath}`);
  process.exit(1);
}

// serverDb reads the JSON from this variable; point it at the file's content.
process.env.FIREBASE_SERVICE_ACCOUNT = fs.readFileSync(keyPath, "utf8");

const { getDb } = await import("../api/_core/serverDb.js");
const { collectCatalogData, writeSnapshot } = await import("../api/_core/catalogCore.js");

const db = getDb();
const snapshot = await collectCatalogData(db);
const result = await writeSnapshot(db, snapshot);

console.log(
  `catalog rebuilt: version ${result.version}, ${result.productCount} products in ${result.shards} shard(s)`
);
