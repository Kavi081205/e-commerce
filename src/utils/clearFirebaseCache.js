/**
 * clearFirebaseCache.js
 *
 * Clears ALL stale Firebase client-side state that causes the
 * "Using maximum backoff delay" retry loop after quota exhaustion.
 *
 * Called once at app startup — safe to call repeatedly (idempotent).
 *
 * What it clears:
 *   • Firebase Firestore IndexedDB databases (offline cache / persistence)
 *   • Stale Firebase Auth tokens that block reconnect
 *   • Any localStorage keys written by Firestore internals
 *
 * What it does NOT clear:
 *   • User auth session (we only clear the Firestore cache, not firebase:authUser)
 *   • Application data stored by our own code (cart, wishlist, recentlyViewed)
 */

// Keys in localStorage that belong to Firebase Firestore internals
const FIRESTORE_LS_PREFIXES = [
  'firestore_',
  'firebaseLocalStorage',
  'firebase:previous_websocket_failure',
  'firebase:host:',
];

// IndexedDB database names created by Firestore persistence
const FIRESTORE_IDB_NAMES = [
  'firestore/',
  'firebase-heartbeat-database',
  'firebase-installations-database',
  'firebase-messaging-database',
];

/**
 * Clears Firestore-related localStorage keys.
 * Skips auth keys so the user stays logged in.
 */
function clearFirestoreLocalStorage() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const isFirestoreKey = FIRESTORE_LS_PREFIXES.some(prefix =>
        key.toLowerCase().startsWith(prefix.toLowerCase())
      );
      if (isFirestoreKey) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
    });
    if (keysToRemove.length > 0) {
      console.info(`[CacheClean] Removed ${keysToRemove.length} stale Firestore localStorage keys.`);
    }
  } catch (err) {
    console.warn('[CacheClean] localStorage clear skipped:', err.message);
  }
}

/**
 * Deletes Firestore IndexedDB databases.
 * These hold the offline cache / persistence layer that can get stuck
 * in a retry loop after quota exhaustion.
 */
async function clearFirestoreIndexedDB() {
  if (typeof indexedDB === 'undefined') return;
  try {
    const dbs = await indexedDB.databases().catch(() => []);
    for (const dbInfo of dbs) {
      const name = dbInfo.name || '';
      const isFirestore = FIRESTORE_IDB_NAMES.some(prefix =>
        name.includes(prefix)
      );
      if (isFirestore) {
        try {
          indexedDB.deleteDatabase(name);
          console.info(`[CacheClean] Deleted Firestore IndexedDB: ${name}`);
        } catch (_) { /* ignore individual failures */ }
      }
    }
  } catch (err) {
    // indexedDB.databases() not available in some environments — safe to ignore
    console.warn('[CacheClean] IndexedDB clear skipped:', err.message);
  }
}

/**
 * Main entry point.
 *
 * Call this ONCE before Firebase is initialized (at the top of main.jsx).
 * It runs asynchronously and will not block app startup.
 */
export async function clearFirebaseCache() {
  if (typeof window === 'undefined') return; // SSR guard

  // Only run the aggressive clear once per browser session to avoid
  // clearing on every hot reload during development.
  const SESSION_KEY = '__fb_cache_cleared_v2';
  if (sessionStorage.getItem(SESSION_KEY)) return;

  try {
    clearFirestoreLocalStorage();
    await clearFirestoreIndexedDB();
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch (err) {
    console.warn('[CacheClean] Cache clear encountered an error:', err);
  }
}

/**
 * Force-clear: call this when the user explicitly triggers a reset,
 * or when a quota-exceeded error is caught. Bypasses the session guard.
 */
export async function forceFirebaseCacheClear() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('__fb_cache_cleared_v2');
  clearFirestoreLocalStorage();
  await clearFirestoreIndexedDB();
  console.info('[CacheClean] Force cache clear complete.');
}
