/**
 * firebase.js — Singleton Firebase initialization
 *
 * RULES:
 *  1. initializeApp() is called ONCE per page lifecycle (singleton pattern).
 *  2. initializeFirestore() is called ONCE; HMR reloads fall back to getFirestore().
 *  3. Offline persistence is DISABLED — we use React Query for client-side caching.
 *  4. Long polling is forced to bypass proxy/streaming limits.
 *  5. Analytics + Performance only load in production (prevents dev CORB warnings).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getPerformance } from 'firebase/performance';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        'aurex-ecommerce.firebaseapp.com', // Must be Firebase domain — NOT Vercel
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || 'aurex-ecommerce',
  storageBucket:     'aurex-ecommerce.appspot.com',     // Must end in .appspot.com
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// ── Singleton guard: reuse existing app on HMR / module re-evaluation ──────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── Firestore: optimized init ──────────────────────────────────────────────────
// initializeFirestore() throws if called more than once for the same app.
// We catch that and fall back to getFirestore() so HMR/SSR don't crash.
let db;
try {
  db = initializeFirestore(app, {
    // Force long-polling so the connection works through restrictive proxies
    // and does NOT use the streaming transport that can create persistent connections
    // that exhaust quota when the network is unstable.
    experimentalForceLongPolling: true,
    useFetchStreams: false,
    // Do NOT enable any persistence — React Query handles client caching.
    // enableIndexedDbPersistence / persistentLocalCache are intentionally absent.
  });
} catch (_) {
  // Already initialized (HMR reload or duplicate import)
  db = getFirestore(app);
}

// ── Storage ────────────────────────────────────────────────────────────────────
const storage = getStorage(app);

// ── Optional services (Analytics + Performance) ────────────────────────────────
// Disabled in development to prevent CORB warnings from Google APIs.
let analytics = null;
let performance = null;

isSupported()
  .then((supported) => {
    if (
      supported &&
      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID &&
      !import.meta.env.DEV
    ) {
      analytics = getAnalytics(app);
      try { performance = getPerformance(app); } catch (_) { /* non-critical */ }
    }
  })
  .catch(() => { /* silently skip if not supported */ });

export { db, storage, analytics, performance };
export default app;