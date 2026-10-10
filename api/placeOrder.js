// POST /api/placeOrder
//
// The server is the only place an order's money and stock are decided. The
// storefront used to do this in the browser, where a tampered client could
// send any total it liked. Nothing here trusts the request beyond "which
// variant, how many".
//
// Service account comes from FIREBASE_SERVICE_ACCOUNT in the Vercel project
// settings. It is a full-privilege credential: never prefix it with VITE_ and
// never commit it.

import * as admin from "firebase-admin";
import { fieldValue, useAdminFieldValue } from "./_core/fieldValueHolder.js";

useAdminFieldValue(admin);

const { placeOrderTransaction, statusForError } = await import("./_core/orderCore.js");

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not set.");
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw))
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const result = await placeOrderTransaction(db, body ?? {});
    return res.status(200).json(result);
  } catch (error) {
    const status = statusForError(error);
    const code = String(error?.code ?? error?.message ?? "SERVER_ERROR").split(":")[0];

    if (status === 500) {
      console.error("placeOrder failed:", error);
      return res.status(500).json({ error: "SERVER_ERROR" });
    }

    // Expected, actionable problems: tell the client which one.
    return res.status(status).json({ error: code });
  }
}

export { fieldValue };