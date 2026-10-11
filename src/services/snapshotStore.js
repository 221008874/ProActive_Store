// Local copy of the catalogue snapshot.
//
// The whole point of /api/catalog is that a returning visitor downloads
// almost nothing: the browser keeps the snapshot in IndexedDB keyed by
// version and only asks for a new one when the store changed. Firestore's
// own persistence also survives reloads, but it stores per-document reads
// from the OLD path; this is the snapshot's own cache and is small, versioned
// and disposable.
//
// A private-mode browser without IndexedDB falls back to memory: the app
// works, it just re-downloads the snapshot each visit.

const DB_NAME = 'pa-catalog'
const DB_VERSION = 1
const STORE = 'snapshots'
const CURRENT_KEY = 'current'

let memoryFallback = null
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })

  return dbPromise
}

export async function loadCachedSnapshot() {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(CURRENT_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return memoryFallback
  }
}

export async function storeSnapshot(snapshot) {
  memoryFallback = snapshot
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(snapshot, CURRENT_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch {
    // Memory fallback already holds it; nothing else to do.
  }
  return snapshot
}
