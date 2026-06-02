import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package,
  ShoppingCart, LogOut, Menu, X, Zap, IndianRupee, Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import { PageSkeleton } from './Skeleton';

// Admin Sub-pages (lazy loaded)
const Dashboard = lazy(() => import('../pages/admin/Dashboard'));
const ProductsManage = lazy(() => import('../pages/admin/ProductsManage'));
const AddProduct = lazy(() => import('../pages/admin/AddProduct'));
const EditProduct = lazy(() => import('../pages/admin/EditProduct'));
const OrdersManage = lazy(() => import('../pages/admin/OrdersManage'));
const InvoicesManage = lazy(() => import('../pages/admin/InvoicesManage'));
const Promotions = lazy(() => import('../pages/admin/Promotions'));
const Expenses = lazy(() => import('../pages/admin/Expenses'));
const AdvancedDashboard = lazy(() => import('../pages/admin/AdvancedDashboard'));
const SetupAdmin = lazy(() => import('../pages/admin/SetupAdmin'));
const CouponsManage = lazy(() => import('../pages/admin/CouponsManage'));

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Coupons', href: '/admin/coupons', icon: Tag },
  { name: 'Promotions', href: '/admin/promotions', icon: Zap },
  { name: 'Expenses', href: '/admin/expenses', icon: IndianRupee },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  // ✅ Exact match for Dashboard, prefix match for all others
  const isActive = (item) =>
    item.exact
      ? location.pathname === item.href
      : location.pathname.startsWith(item.href);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin-login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  // Real-time listener checking role of currentUser. Auto signout if invalid.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      handleLogout();
    }
  }, [currentUser]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-white
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        border-r border-yellow-900/20
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-yellow-900/20 shrink-0">
          <div className="flex items-center gap-3">
            {/* ✅ Descriptive alt text */}
            <img src={logo} alt="SMKP Traders" className="w-8 h-8 object-contain rounded-lg" />
            <span className="text-lg font-black tracking-widest uppercase">SMKP Admin</span>
          </div>
          {/* ✅ type="button" — prevents accidental form submission */}
          <button
            type="button"
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2" aria-label="Admin navigation">
          {/* ✅ Stable key (href), no optional chaining on hardcoded constants */}
          {navigation.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeSidebar}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${active
                    ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                    : 'text-gray-400 hover:bg-yellow-500/10 hover:text-yellow-400'
                  }`}
              >
                <Icon
                  size={20}
                  className={`mr-3 shrink-0 ${active ? 'text-white' : 'group-hover:text-yellow-400'}`}
                />
                <span className="font-semibold">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-yellow-900/20 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-400 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all font-semibold"
          >
            <LogOut size={20} className="mr-3 shrink-0" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top Header */}
        <header className="flex items-center justify-between h-20 px-6 bg-gray-900 border-b border-yellow-900/20 shadow-sm shrink-0">
          <button
            type="button"
            className="text-gray-500 hover:text-yellow-600 lg:hidden focus:outline-none transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white leading-none">
                {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin'}
              </p>
              <p className="text-xs text-yellow-600 font-medium mt-1">Admin · Full Access</p>
            </div>
            <div
              className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center text-white font-black shadow-md shadow-yellow-500/20 shrink-0"
              aria-hidden="true"
            >
              {(currentUser?.displayName?.[0] || currentUser?.email?.[0] || 'A').toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-grow overflow-x-hidden overflow-y-auto bg-slate-950/50 p-6 sm:p-8">
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<ProductsManage />} />
              <Route path="add-product" element={<AddProduct />} />
              <Route path="edit-product/:id" element={<EditProduct />} />
              <Route path="orders" element={<OrdersManage />} />
              <Route path="invoices" element={<InvoicesManage />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="coupons" element={<CouponsManage />} />
              <Route path="advanced-dashboard" element={<AdvancedDashboard />} />
              <Route path="setup" element={<SetupAdmin />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;