// Mutable holder for Firestore sentinel values.
//
// The order core must not import firebase-admin, or it cannot be unit tested
// against a fake database. It also must use the real SDK sentinels at runtime.
// A plain mutable object satisfies both: the defaults work in tests, and
// api/placeOrder.js swaps in the real ones before the first request.

export const fieldValue = {
  increment: (n) => ({ __op: "increment", n }),
  serverTimestamp: () => ({ __op: "serverTimestamp" })
};

export function useAdminFieldValue(admin) {
  fieldValue.increment = admin.firestore.FieldValue.increment;
  fieldValue.serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
}