// Shared firebase-admin bootstrap for the /api routes.
//
// Every serverless file used to repeat the initializeApp dance; this is the
// one place that knows how the credentials arrive. The service account JSON
// lives ONLY in the host's environment (Vercel project settings) as
// FIREBASE_SERVICE_ACCOUNT - never with a VITE_ prefix, never in git.
//
// Initialisation is lazy so that routes which need no database (health) still
// boot on a machine without credentials, and so a missing credential is a
// clear error at the point of use rather than at import time.
//
// Note on imports: with "type": "module", `import * as admin from
// "firebase-admin"` does NOT expose admin.firestore (the namespaces hang off
// the default export's lazy getters, which are undefined before an app
// exists). The per-service entry points - firebase-admin/firestore,
// firebase-admin/auth - are the documented ESM path and the only ones that
// work here.

import { initializeApp, cert, getApps } from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { fieldValue, useAdminFieldValue } from "./fieldValueHolder.js";

useAdminFieldValue({ FieldValue });

let cachedDb = null;

function parseServiceAccount(raw) {
  const text = String(raw).trim();
  // Accept either the raw JSON or the same JSON base64-encoded, because some
  // hosts mangle multi-line environment values.
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(Buffer.from(text, "base64").toString("utf8"));
  }
}

export function getDb() {
  if (cachedDb) return cachedDb;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!getApps().length) {
    if (!raw) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is not set. Add the service account JSON to the host environment."
      );
    }
    try {
      initializeApp({ credential: cert(parseServiceAccount(raw)) });
    } catch (error) {
      console.error("FIREBASE_SERVICE_ACCOUNT could not be parsed as a service account:", error.message);
      throw new Error("FIREBASE_SERVICE_ACCOUNT is invalid.");
    }
  }

  cachedDb = getFirestore();
  return cachedDb;
}

export { fieldValue };
