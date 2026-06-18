import { useState, useCallback, useRef, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazyWithRetry } from './utils/lazyWithRetry';

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
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Wishlist = lazyWithRetry(() => import('./pages/Wishlist'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const AdminLogin = lazyWithRetry(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazyWithRetry(() => import('./components/AdminLayout'));
const AuthSystem = lazyWithRetry(() => import('./components/AuthSystem'));
const MyOrders = lazyWithRetry(() => import('./pages/MyOrders'));

import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import { PromoProvider } from './context/PromoContext';
import { CartProvider } from './context/CartContext';



// ─── Domain Detection ─────────────────────────────────────────────────────────
// Production: admin.smkptraders.com  → admin-only panel
// Production: smkptraders.com        → customer website
// Development: localhost allows both /admin/* and customer routes.
//   Use separate browser profiles or incognito to simulate session isolation.
const IS_ADMIN_DOMAIN =
  typeof window !== 'undefined' &&
  window.location.hostname.startsWith('admin.');

// ─── Route Guards ─────────────────────────────────────────────────────────────

// CustomerRoute: requires a logged-in non-admin user.
// — Unauthenticated → /login
// — Admin account   → /admin  (prevents admin session leaking into customer UI)
const CustomerRoute = ({ children }) => {
  const { currentUser, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return children;
};

// AdminRoute: requires an active admin session.
// Accepts EITHER a local adminSession (set by adminLogin direct-check)
// OR a Firebase-authenticated user with admin role in Firestore.
// — No valid session → /admin-login
const AdminRoute = ({ children }) => {
  const { currentUser, loading, isAdmin, adminSession } = useAuth();
  const location = useLocation();

  // Wait for AuthContext to finish resolving the Firebase Auth state.
  if (loading) return null;

  // Grant access if the local admin session is active OR Firebase user is admin.
  if (!isAdmin && !adminSession) {
    return <Navigate to="/admin-login" replace state={{ from: location }} />;
  }

  return children;
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { currentUser, loading, isAdmin } = useAuth();
  const user = currentUser;

  // Capture once on mount — avoids re-evaluating shouldShowSplash on re-renders
  const showSplash = useRef(shouldShowSplash()).current;

  // Phase: 'loading' → 'splash' (first visit only) → 'ready'
  const [phase, setPhase] = useState('loading');

  const handleLoadingDone = useCallback(() => {
    setPhase(showSplash ? 'splash' : 'ready');
  }, [showSplash]);

  const handleSplashDone = useCallback(() => {
    setPhase('ready');
  }, []);

  return (
    <PromoProvider>
      <NotificationProvider>
        <CartProvider>
          <WishlistProvider>
          {phase === 'loading' && <LoadingScreen onDone={handleLoadingDone} />}
          {phase === 'splash' && <SplashScreen onDone={handleSplashDone} />}

          {/* ✅ Routes only mount once the app is ready — prevents premature Firestore listeners */}
          {phase === 'ready' && (
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
                    <Route
                      path="/login"
                      element={
                        currentUser
                          ? <Navigate to="/" replace />
                          : <AuthSystem />
                      }
                    />
                    <Route path="/checkout" element={<CustomerRoute><Checkout /></CustomerRoute>} />
                    <Route path="/my-orders" element={<CustomerRoute><MyOrders /></CustomerRoute>} />
                    <Route
                      path="/profile"
                      element={<Profile/>}
                    />
                    <Route path="/wishlist" element={<CustomerRoute><Wishlist /></CustomerRoute>} />
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
        </CartProvider>
      </NotificationProvider>
    </PromoProvider>
  );
}

export default App;