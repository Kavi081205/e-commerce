import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { PromoProvider } from './context/PromoContext';
import { CartProvider } from './context/CartContext';
import './index.css';
import App from './App.jsx';
import FirebaseStatusBanner from './components/FirebaseStatusBanner.jsx';

// ── Step 1: Clear stale Firebase IndexedDB / localStorage cache ────────────────
// Breaks the "maximum backoff delay" retry loop after quota-exceeded.
// Runs once per browser session, non-blocking.
import { clearFirebaseCache } from './utils/clearFirebaseCache.js';
clearFirebaseCache(); // fire-and-forget

// ── Step 2: Suppress harmless CORB / Google logging noise ─────────────────────
if (typeof window !== 'undefined') {
  const IGNORE_PATTERNS = [
    'log?key=',
    'firebaselogging.googleapis.com',
    'googleapis',
  ];

  const shouldIgnore = (msg, url = '') => {
    const m = String(msg || '').toLowerCase();
    const u = String(url || '').toLowerCase();
    return IGNORE_PATTERNS.some(p => m.includes(p) || u.includes(p));
  };

  window.addEventListener('error', (e) => {
    if (shouldIgnore(e.message, e.filename)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? '');
    if (shouldIgnore(msg)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// ── Helper: detect Firebase quota / resource-exhausted errors ─────────────────
function isQuotaError(error) {
  if (!error) return false;
  const msg = String(error?.message || error?.code || '').toLowerCase();
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quotaexceeded') ||
    error?.code === 'resource-exhausted'
  );
}

// ── Step 3: React Query client with safe retry + global quota detection ────────
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isQuotaError(error)) dispatchQuotaEvent(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isQuotaError(error)) dispatchQuotaEvent(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 min: serve fresh cache
      gcTime:    1000 * 60 * 15,   // 15 min: keep in memory
      refetchOnWindowFocus: false,  // no re-fetch on tab focus
      refetchOnMount: false,        // no re-fetch if data is fresh

      // Skip retrying on quota / permission errors — aggressive retries
      // make quota exhaustion worse and keep Firebase in backoff mode.
      retry: (failureCount, error) => {
        if (isQuotaError(error)) return false;
        const code = String(error?.code || '');
        if (code === 'permission-denied' || code === 'unauthenticated') return false;
        return failureCount < 2;
      },

      // Fractional backoff delay
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
    mutations: {
      retry: false,
    },
  },
});

function dispatchQuotaEvent(error) {
  if (typeof window !== 'undefined') {
    console.warn('[Firebase] Quota exceeded — dispatching recovery event.');
    window.dispatchEvent(new CustomEvent('firebase-quota-exceeded', { detail: error }));
  }
}

// ── Step 4: Render ─────────────────────────────────────────────────────────────
const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML =
    '<h1 style="color:red">App failed to load: #root element missing in index.html.</h1>';
  throw new Error('[main.jsx] Could not find #root element in index.html.');
}

createRoot(rootElement).render(
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <PromoProvider>
            <CartProvider>
              {/* Global Firebase quota recovery banner */}
              <FirebaseStatusBanner />
              <App />
            </CartProvider>
          </PromoProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </HelmetProvider>,
);