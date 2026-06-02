import React, { useState, useCallback, useRef } from 'react';
import { Routes, Route, Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// UX Screens
import LoadingScreen from './components/LoadingScreen';
import SplashScreen, { shouldShowSplash } from './components/SplashScreen';

// Frontend Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';

// Admin Components
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import ProductsManage from './pages/admin/ProductsManage';
import OrdersManage from './pages/admin/OrdersManage';
import Login from './pages/admin/Login';

// Admin Auth Guard
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/admin-login" replace />;
  }
  return children;
};

// Layout for customer-facing site
const StoreLayout = () => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-grow bg-gray-50">
      <Outlet />
    </main>
    <footer className="bg-gray-950 border-t border-teal-900/30 text-gray-400 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SMKP TRADERS" className="h-9 w-9 object-contain rounded-md" />
            <div>
              <p className="text-white font-extrabold tracking-widest text-sm">SMKP TRADERS</p>
              <p className="text-teal-400 text-xs tracking-wider">Quality You Can Trust</p>
            </div>
          </div>
          {/* Links — use Link for internal routes */}
          <div className="flex items-center gap-6 text-sm">
            <Link to="/" className="hover:text-teal-400 transition-colors">Home</Link>
            <Link to="/products" className="hover:text-teal-400 transition-colors">Products</Link>
            <Link to="/cart" className="hover:text-teal-400 transition-colors">Cart</Link>
            <Link to="/admin-login" className="hover:text-teal-400 transition-colors opacity-50 hover:opacity-100 text-[10px]">Admin</Link>
          </div>
          {/* Copyright */}
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} SMKP TRADERS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
);

function App() {
  // Capture shouldShowSplash once on mount via useRef — avoids re-evaluating on re-renders
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
    <>
      {phase === 'loading' && (
        <LoadingScreen onDone={handleLoadingDone} />
      )}

      {phase === 'splash' && (
        <SplashScreen onDone={handleSplashDone} />
      )}

      {/* Main app — always rendered beneath UX screens */}
      <Routes>
        {/* Customer-facing store */}
        <Route path="/" element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="product/:id" element={<ProductDetails />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmation" element={<OrderConfirmation />} />
        </Route>

        {/* Admin login (public) */}
        <Route path="/admin-login" element={<Login />} />

        {/* Admin dashboard (protected) */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsManage />} />
          <Route path="orders" element={<OrdersManage />} />
        </Route>

        {/* Catch-all redirect for old /admin/* paths */}
        <Route path="/admin/*" element={<Navigate to="/admin-login" replace />} />
      </Routes>
    </>
  );
}

export default App;