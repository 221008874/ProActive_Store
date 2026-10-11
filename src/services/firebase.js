import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'
import { firebaseConfig } from '../config'

let app;
let db;

// This project's Firestore database is named "default", not the "(default)"
// the SDK assumes. Without the explicit id every read fails with NOT_FOUND,
// which surfaces as an empty shop rather than an error.
const DATABASE_ID = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'default'

try {
  app = initializeApp(firebaseConfig)

  // Firestore 12.8 deprecated enableIndexedDbPersistence(). The replacement is
  // a construction-time `localCache` setting — which only initializeFirestore()
  // accepts. NOTE: getFirestore()'s second argument is a database-ID *string*
  // (named databases), NOT settings: passing the object there silently registers
  // the instance under the identifier "[object Object]" and drops the cache
  // settings on the floor, producing Listen-channel URLs like
  // .../databases/[object Object]. If persistence cannot be set up, fall back
  // to the SDK's default in-memory cache rather than losing the catalogue
// (useCatalog relies on the cache surviving a reload). The database id is
  // the THIRD argument, where it belongs.
  db = (() => {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, DATABASE_ID)
    } catch (err) {
      console.warn('Offline persistence unavailable; using the in-memory cache.', err);
      return getFirestore(app, DATABASE_ID)
    }
  })()

  console.log('✅ Firebase Client initialized');
} catch (error) {
  console.error('❌ Firebase Client init error:', error);
  db = null;
}

export { db, DATABASE_ID }
export default app