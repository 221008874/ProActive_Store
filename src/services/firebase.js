import { initializeApp } from 'firebase/app'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { firebaseConfig } from '../config'

let app;
let db;

try {
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
  
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('Browser does not support persistence.');
      }
    });
  }
  
  console.log('✅ Firebase Client initialized');
} catch (error) {
  console.error('❌ Firebase Client init error:', error);
  db = null;
}

export { db }
export default app