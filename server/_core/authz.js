// Admin authorization for the /api/admin/* routes.
//
// Firebase Auth proves WHO; the custom `admin` claim proves they are allowed.
// The claim is set by scripts/setAdmin.mjs with the service account (never
// from the app), and the token is only fresh after a sign-out/sign-in, so a
// 403 here usually means "sign in again" rather than "you are not an admin".
//
// Every admin route starts with this guard. There is no allow-list of paths
// to forget: an unauthenticated or claim-less caller is refused before any
// database work.

import { getAuth } from "./firebaseAdmin.js";
import { getDb } from "./serverDb.js";

export async function requireAdmin(req) {
  const header = req.headers?.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

  try {
    getDb(); // ensures initializeApp ran before getAuth() is used
    const decoded = await getAuth().verifyIdToken(token);

    if (decoded.admin !== true) return { ok: false, status: 403, error: "NOT_ADMIN" };
    return { ok: true, uid: decoded.uid, email: decoded.email ?? null };
  } catch (error) {
    console.warn("admin token rejected:", error.message);
    return { ok: false, status: 401, error: "BAD_TOKEN" };
  }
}
