import { useState, useCallback, useRef, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// UX Screens
import LoadingScreen from './components/LoadingScreen';
import SplashScreen, { shouldShowSplash } from './components/SplashScreen';

// Skeletons & Error Handling
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';

// Layouts
import WebsiteLayout from './components/WebsiteLayout';

// Lazy Loaded Pages & Layouts
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const ThankYou = lazy(() => import('./pages/ThankYou'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const Profile = lazy(() => import('./pages/Profile'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AuthSystem = lazy(() => import('./components/AuthSystem'));
const MyOrders = lazy(() => import('./pages/MyOrders'));

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

// AdminRoute: requires a logged-in admin user.
// — Unauthenticated or non-admin → /admin-login
const AdminRoute = ({ children }) => {
  const { currentUser, loading, isAdmin } = useAuth();
  const location = useLocation();

  console.log("=== Admin Route Protection Check ===");
  console.log("Current Route:", location.pathname);
  console.log("Auth Loading Status:", loading);
  console.log("Current User Authenticated:", currentUser ? `${currentUser.email} (UID: ${currentUser.uid})` : "No");
  console.log("Is Admin Privilege Granted:", isAdmin);
  console.log("====================================");

  if (loading) return null;
  if (!currentUser || !isAdmin) {
    console.log("[Route Guard] Access Denied. Redirecting to /admin-login");
    return <Navigate to="/admin-login" replace state={{ from: location }} />;
  }

  console.log("[Route Guard] Access Granted. Rendering Protected Page.");
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