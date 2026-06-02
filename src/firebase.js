import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
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