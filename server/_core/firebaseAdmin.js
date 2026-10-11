// The one place firebase-admin is loaded.
//
// The root entry ("firebase-admin") has no "import" condition in its exports
// map, so it resolves to a CommonJS build whose named bindings Node cannot
// recover - importing `{ cert }` from it fails at load time with "does not
// provide an export named 'cert'", which takes down every route at once. Its
// default export is the same transpiled module, so a default import does not
// help either.
//
// `firebase-admin/app` is the real ESM build and exports initializeApp, cert
// and getApps properly, and the service subpaths (auth, firestore) are ESM
// too. Importing from those keeps the SDK off the CommonJS path entirely, and
// concentrating it here means the version-specific shape is solved once rather
// than in each of the five files that touch the SDK.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export { initializeApp, cert, getApps, getFirestore, FieldValue, getAuth };