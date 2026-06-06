import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "aurex-ecommerce.firebaseapp.com",   // Must be Firebase domain — NOT Vercel
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aurex-ecommerce",
  // storageBucket must end in .appspot.com — NOT .firebasestorage.app
  storageBucket: "aurex-ecommerce.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Use persistent cache + multi-tab support to reduce redundant Firestore
// network calls and suppress "listen transport" errors on reconnect.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // initializeFirestore throws if already initialized (e.g. HMR during dev)
  db = getFirestore(app);
}
const storage = getStorage(app);

// Analytics & Performance are optional — guarded so builds without
// a measurementId or in non-browser environments still succeed.
// Disabled in local development to prevent CORB warnings from Google APIs.
let analytics = null;
let performance = null;

isSupported().then((supported) => {
  if (supported && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID && !import.meta.env.DEV) {
    analytics = getAnalytics(app);
    try { performance = getPerformance(app); } catch (_) { /* ignore */ }
  }
}).catch(() => { /* silently skip if not supported */ });

export { db, storage, analytics, performance };
export default app;