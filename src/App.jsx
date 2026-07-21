import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { useServiceWorker } from './hooks/useServiceWorker';

// UX Screens
import LoadingScreen from './components/LoadingScreen';
import SplashScreen, { shouldShowSplash } from './components/SplashScreen';

// Skeletons & Error Handling
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';

// Layouts
import WebsiteLayout from './components/WebsiteLayout';

// Lazy Loaded Pages & Layouts
const Home = lazyWithRetry(() => import('./pages/Home'));
const Products = lazyWithRetry(() => import('./pages/Products'));
const ProductDetails = lazyWithRetry(() => import('./pages/ProductDetails'));
const Cart = lazyWithRetry(() => import('./pages/Cart'));
const Checkout = lazyWithRetry(() => import('./pages/Checkout'));
const ThankYou = lazyWithRetry(() => import('./pages/ThankYou'));
const OrderConfirmation = lazyWithRetry(() => import('./pages/OrderConfirmation'));
const Wishlist = lazyWithRetry(() => import('./pages/Wishlist'));
const About = lazyWithRetry(() => import('./pages/About'));
const DailyNotes = lazyWithRetry(() => import('./pages/DailyNotes'));
const MyOrders = lazyWithRetry(() => import('./pages/MyOrders'));
const MyComplaints = lazyWithRetry(() => import('./pages/MyComplaints'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const AdminLogin = lazyWithRetry(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazyWithRetry(() => import('./components/AdminLayout'));

import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';



// ─── Domain Detection ─────────────────────────────────────────────────────────
// Production: admin.smkptraders.com  → admin-only panel
// Production: smkptraders.com        → customer website
// Development: localhost allows both /admin/* and customer routes.
//   Use separate browser profiles or incognito to simulate session isolation.
const IS_ADMIN_DOMAIN =
  typeof window !== 'undefined' &&
  window.location.hostname.startsWith('admin.');



// AdminRoute: requires an active admin session.
// Accepts EITHER a local adminSession (set by adminLogin direct-check)
// OR a Firebase-authenticated user with admin role in Firestore.
// — No valid session → /admin-login
const AdminRoute = ({ children }) => {
  const { currentUser, loading, isAdmin, adminSession } = useAuth();
  const location = useLocation();
  console.log('[AdminRoute] Check - Loading:', loading, 'User:', currentUser?.email, 'isAdmin:', isAdmin, 'adminSession:', adminSession);

  // Wait for AuthContext to finish resolving the Firebase Auth state.
  if (loading) {
    console.log('[AdminRoute] Auth is loading, displaying LoadingScreen');
    return <LoadingScreen onDone={() => {}} />;
  }

  // Grant access if the local admin session is active OR Firebase user is admin.
  if (!isAdmin && !adminSession) {
    console.log('[AdminRoute] Redirecting to /admin-login (Unauthorized access)');
    return <Navigate to="/admin-login" replace state={{ from: location }} />;
  }

  console.log('[AdminRoute] Access granted for admin:', currentUser?.email || 'session-check');
  return children;
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const authLoading = false;

  // ── Service Worker: detect new deployment and prompt user to refresh ───────
  const { updateAvailable, applyUpdate } = useServiceWorker();

  // Capture once on mount — avoids re-evaluating shouldShowSplash on re-renders
  const showSplash = useRef(shouldShowSplash()).current;

  // Phase: 'loading' → 'splash' (first visit only) → 'ready'
  const [phase, setPhase] = useState('loading');
  const [loadingDone, setLoadingDone] = useState(false);

  const handleLoadingDone = useCallback(() => {
    console.log('[App] LoadingScreen visual animation timer completed.');
    setLoadingDone(true);
  }, []);

  const handleSplashDone = useCallback(() => {
    console.log('[App] SplashScreen presentation completed.');
    setPhase('ready');
  }, []);

  // Coordinated route mounting: wait for both LoadingScreen timer and Firebase Auth
  useEffect(() => {
    console.log('[App] Coordination check - loadingDone:', loadingDone, 'authLoading:', authLoading, 'phase:', phase);
    if (loadingDone && !authLoading && phase === 'loading') {
      console.log('[App] Transitioning phase from loading to:', showSplash ? 'splash' : 'ready');
      setPhase(showSplash ? 'splash' : 'ready');
    }
  }, [loadingDone, authLoading, phase, showSplash]);

  return (
    <NotificationProvider>
      <SiteSettingsProvider>
        <WishlistProvider>

        {/* ── New deployment update banner ───────────────────────────────── */}
        {updateAvailable && (
          <div
            role="alert"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              background: 'linear-gradient(90deg, #1a1200 0%, #2a1d00 100%)',
              borderBottom: '1px solid rgba(234,179,8,0.3)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em' }}>
              🚀 A new version is available!
            </span>
            <button
              onClick={applyUpdate}
              style={{
                background: '#eab308',
                color: '#000',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 16px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Update Now
            </button>
          </div>
        )}

        {phase === 'loading' && <LoadingScreen onDone={handleLoadingDone} />}
        {phase === 'splash' && <SplashScreen onDone={handleSplashDone} />}

        {/* ✅ Routes only mount once the app is ready and auth state has resolved */}
        {phase === 'ready' && !authLoading && (
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* Customer-facing store */}
              <Route element={<WebsiteLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                {/* Dynamic product detail — /product/:id */}
                <Route path="/product/:id" element={<ProductDetails />} />
                {/* Redirect bare /product (no id) to the products listing */}
                <Route path="/product" element={<Navigate to="/products" replace />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/thank-you" element={<ThankYou />} />
                <Route path="/order-confirmation" element={<OrderConfirmation />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/profile" element={<Navigate to="/" replace />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/about" element={<About />} />
                <Route path="/daily-notes" element={<DailyNotes />} />
                <Route path="/my-orders" element={<MyOrders />} />
                <Route path="/my-complaints" element={<MyComplaints />} />
                {/* 404 fallback — renders inside the store layout (keeps Navbar/Footer) */}
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Admin login — public route.
                  Redirects already-authenticated admins directly to the dashboard.
                  Note: AuthContext blocks all rendering until loading=false, so
                  the loading guard here is unnecessary. */}
              <Route
                path="/admin-login"
                element={<AdminLogin />}
              />

              {/* Production admin-subdomain (admin.smkptraders.com):
                  Root "/" redirects straight to the admin panel.             */}
              {IS_ADMIN_DOMAIN && (
                <Route
                  path="/"
                  element={<Navigate to="/admin-login" replace />}
                />
              )}

              {/* Admin dashboard (protected) */}
              <Route
                path="/admin/*"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              />

              {/* Alias for /admin dashboard */}
              <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        )}
        </WishlistProvider>
      </SiteSettingsProvider>
    </NotificationProvider>
  );
}

export default App;