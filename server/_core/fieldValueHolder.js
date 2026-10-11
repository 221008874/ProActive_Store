// Mutable holder for Firestore sentinel values.
//
// The order core must not import firebase-admin, or it cannot be unit tested
// against a fake database. It also must use the real SDK sentinels at runtime.
// A plain mutable object satisfies both: the defaults work in tests, and
// api/_core/serverDb.js swaps in the real ones on load.
//
// Takes the firestore namespace ({ FieldValue }) rather than the whole admin
// object, because that is what the ESM entry points actually expose.

export const fieldValue = {
  increment: (n) => ({ __op: "increment", n }),
  serverTimestamp: () => ({ __op: "serverTimestamp" })
};

export function useAdminFieldValue(firestore) {
  fieldValue.increment = firestore.FieldValue.increment;
  fieldValue.serverTimestamp = firestore.FieldValue.serverTimestamp;
}