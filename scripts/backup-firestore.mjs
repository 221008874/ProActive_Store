// Scheduled Firestore export to a Cloud Storage bucket.
//
//   FIREBASE_SERVICE_ACCOUNT='<json>' FIRESTORE_BACKUP_BUCKET=gs://my-bucket \
//     node scripts/backup-firestore.mjs
//
// Managed Firestore exports require a Blaze plan and a bucket in the same
// project. Keep at least 14 daily copies and test a restore into staging; the
// GitHub Action (.github/workflows/backup.yml) runs this daily.

import fs from "node:fs";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
const bucket = process.env.FIRESTORE_BACKUP_BUCKET;

if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT (the service account JSON) is required.");
  process.exit(1);
}
if (!bucket?.startsWith("gs://")) {
  console.error("FIRESTORE_BACKUP_BUCKET must be a gs:// bucket in the same project.");
  process.exit(1);
}

const serviceAccount = typeof raw === "string" && raw.trim().startsWith("{") ? JSON.parse(raw) : raw;
const projectId = serviceAccount.project_id;

const { GoogleAuth } = await import("google-auth-library");
const auth = new GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/datastore"]
});

const client = await auth.getClient();
const token = await client.getAccessToken();

const stamp = new Date().toISOString().slice(0, 10);
const outputUriPrefix = `${bucket}/backups/${stamp}`;

const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):export`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ outputUriPrefix })
  }
);

if (!response.ok) {
  const text = await response.text();
  console.error(`export failed (${response.status}): ${text}`);
  process.exit(1);
}

const operation = await response.json();
console.log(`export started: ${operation.name} -> ${outputUriPrefix}`);
console.log("The operation completes server-side; poll it or check the bucket.");
