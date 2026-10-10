import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'
import { firebaseConfig } from '../config'

let app;
let db;

try {
  app = initializeApp(firebaseConfig)

  // Firestore 12.8 deprecated enableIndexedDbPersistence(). The replacement is
  // a construction-time `localCache` setting rather than an async call, which
  // also removes the graceful-degradation path the old promise provided — it
  // used to reject with 'failed-precondition' (multi-tab) or 'unimplemented'
  // (no support). That is recreated here: if persistence cannot be set up, fall
  // back to the SDK's default in-memory cache rather than losing the catalogue
  // (useCatalog relies on the cache surviving a reload).
  db = (() => {
    try {
      return getFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      })
    } catch (err) {
      console.warn('Offline persistence unavailable; using the in-memory cache.', err);
      return getFirestore(app);
    }
  })()

  console.log('✅ Firebase Client initialized');
} catch (error) {
  console.error('❌ Firebase Client init error:', error);
  db = null;
}

export { db }
export default app