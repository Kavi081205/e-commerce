import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, getCountFromServer, query, orderBy, limit, where } from 'firebase/firestore';
import { DollarSign, ShoppingBag, TrendingUp, Users, ArrowUpRight, Loader2, Wallet, CheckCircle, Clock, AlertTriangle, MessageSquareWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatSkeleton } from '../../components/Skeleton';
import { getDeliveryCharge } from '../../firebase/services';
import { getUnreadComplaintCount } from '../../firebase/services';
import { getOptimizedImage } from '../../utils/cloudinary';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

const calculateOrderProfit = (order, productsCostMap = {}) => {
  // 2. Do not read a stored profit field unless it actually exists and is a valid number
  if (order.profit !== undefined && order.profit !== null) {
    return Number(order.profit);
  }

  // 3. Calculate profit dynamically for every order
  const items = order.items || order.products || order.orderedItems || [];
  const itemProfitSum = items.reduce((acc, item) => {
    // sellingPrice corresponds to effectivePrice
    const sellingPrice = Number(item.effectivePrice ?? item.price ?? 0);
    // purchasePrice / costPrice corresponds to costPrice
    const costPrice = Number(item.costPrice ?? item.cost ?? productsCostMap[item.productId] ?? sellingPrice);
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    return acc + (sellingPrice - costPrice) * quantity;
  }, 0);

  const discount = Number(order.couponDiscount || 0);
  const shipping = Number(order.deliveryCharge || 0);

  // Requirement 5: If shipping is paid by the seller:
  // Profit = ((Selling Price * Qty) - (Purchase Cost * Qty)) - Shipping - Discount
  // Shipping is paid by the seller if deliveryCharge is 0
  let shippingCost = 0;
  if (shipping === 0 && order.pincode) {
    const zoneDetails = getDeliveryCharge(order.pincode);
    shippingCost = Number(zoneDetails?.charge || 0);
  }

  const calculatedProfit = itemProfitSum - shippingCost - discount;

  // 7. Add console logs: Order ID, Selling Price, Purchase Cost, Quantity, Calculated Profit
  console.log(`[calculateOrderProfit] Order ID: ${order.id}`);
  items.forEach(item => {
    const sPrice = Number(item.effectivePrice ?? item.price ?? 0);
    const cPrice = Number(item.costPrice ?? item.cost ?? productsCostMap[item.productId] ?? sPrice);
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const p = (sPrice - cPrice) * qty;
    console.log(`  - Item: ${item.name || item.productName || item.productId}`);
    console.log(`    Selling Price: ₹${sPrice}`);
    console.log(`    Purchase Cost: ₹${cPrice}`);
    console.log(`    Quantity: ${qty}`);
    console.log(`    Calculated Profit: ₹${p}`);
  });
  console.log(`  Order-level Discount: ₹${discount}`);
  console.log(`  Order-level Shipping Cost: ₹${shippingCost}`);
  console.log(`  Total Calculated Order Profit: ₹${calculatedProfit}`);

  return calculatedProfit;
};

const formatCurrency = (value) => `₹${Number(value).toLocaleString()}`;

const MONTHLY_TARGET = 50000;

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-gray-900 rounded-2xl shadow-sm p-4 sm:p-6 border border-yellow-900/10 hover:shadow-md transition-shadow min-w-0">
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <div className={`p-2 sm:p-3 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      {trend && (
        <span className="flex items-center text-green-500 text-[10px] sm:text-xs font-bold">
          <ArrowUpRight size={12} className="mr-0.5" /> {trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-[9px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{title}</p>
      <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight truncate">{value}</h3>
    </div>
  </div>
);

const getStatusStyle = (status) => {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'bg-green-100 text-green-700';
    case 'shipped': return 'bg-blue-100 text-blue-700';
    case 'processing': return 'bg-purple-100 text-purple-700';
    case 'ordered': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-800 text-gray-700';
  }
};

const Dashboard = () => {
  const [orderStats, setOrderStats] = useState({
    totalSales: 0, grossProfit: 0,
    todaySales: 0, todayProfit: 0,
    todayOrders: 0, totalOrders: 0,
    recentOrders: [], chartData: []
  });
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaintCount, setComplaintCount] = useState(0);

  const { currentUser, isAdmin } = useAuth();

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isAdmin || !currentUser) return;
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      // 1. Fetch total products count (highly optimized count query)
      const totalProductsSnap = await getCountFromServer(collection(db, 'products'));
      setTotalProducts(totalProductsSnap.data().count);

      // 2. Fetch only low stock products (1 to 5)
      const lowStockQuery = query(
        collection(db, 'products'),
        where('stock', '>=', 1),
        where('stock', '<=', 5)
      );
      const lowStockSnap = await getDocs(lowStockQuery);
      setLowStockProducts(lowStockSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3. Fetch only out of stock products (<= 0)
      const outOfStockQuery = query(
        collection(db, 'products'),
        where('stock', '<=', 0)
      );
      const outOfStockSnap = await getDocs(outOfStockQuery);
      setOutOfStockProducts(outOfStockSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 4. Fetch top products (max 5)
      const topProductsQuery = query(
        collection(db, 'products'),
        orderBy('soldCount', 'desc'),
        limit(5)
      );
      const topProductsSnap = await getDocs(topProductsQuery);
      setTopProducts(topProductsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 5. Fetch expenses once
      const expensesSnap = await getDocs(collection(db, 'expenses'));
      setTotalExpenses(expensesSnap.docs.reduce((a, d) => a + (Number(d.data().amount) || 0), 0));

      // 6. Fetch complaint count
      try {
        const cCount = await getUnreadComplaintCount();
        setComplaintCount(cCount);
      } catch (e) { /* non-critical */ }

      // Fetch all products to resolve costPrice for dynamic profit calculations
      const allProductsSnap = await getDocs(collection(db, 'products'));
      const productsCostMap = {};
      allProductsSnap.docs.forEach(d => {
        const data = d.data();
        productsCostMap[d.id] = Number(data.costPrice ?? data.cost ?? data.price ?? 0);
      });

      // 6. Fetch orders (one-time getDocs, not onSnapshot)
      const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const ordersSnap = await getDocs(ordersQuery);
      const docs = ordersSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt)
      }));

      // Filter out cancelled orders from calculations
      const activeDocs = docs.filter(o => o.status?.toLowerCase() !== 'cancelled');

      // Calculate order statistics
      const todayStr = new Date().toISOString().split('T')[0];
      const todayDocs = activeDocs.filter(o => o.createdAt.toISOString().split('T')[0] === todayStr);

      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const chartData = last7Days.map(date => {
        const dayDocs = activeDocs.filter(o => o.createdAt.toISOString().split('T')[0] === date);
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: dayDocs.reduce((a, o) => a + (Number(o.totalPrice) || 0), 0),
          profit: dayDocs.reduce((a, o) => a + calculateOrderProfit(o, productsCostMap), 0)
        };
      });

      const codOrdersCount = activeDocs.filter(o => {
        const pm = o.paymentMethod?.toUpperCase();
        return pm === 'COD' || pm === 'CASH ON DELIVERY';
      }).length;
      const onlineOrdersCount = activeDocs.filter(o => o.paymentMethod?.toUpperCase() === 'ONLINE').length;
      const paidOrdersCount = activeDocs.filter(o => o.paymentStatus?.toLowerCase() === 'paid').length;
      const pendingPaymentsCount = activeDocs.filter(o => o.paymentStatus?.toLowerCase() === 'pending' || o.paymentStatus?.toLowerCase() === 'unpaid').length;
      const pendingPaymentsValue = activeDocs.filter(o => o.paymentStatus?.toLowerCase() === 'pending' || o.paymentStatus?.toLowerCase() === 'unpaid').reduce((a, o) => a + (Number(o.totalPrice) || 0), 0);

      setOrderStats({
        totalSales: activeDocs.reduce((a, o) => a + (Number(o.totalPrice) || 0), 0),
        grossProfit: activeDocs.reduce((a, o) => a + calculateOrderProfit(o, productsCostMap), 0),
        todaySales: todayDocs.reduce((a, o) => a + (Number(o.totalPrice) || 0), 0),
        todayProfit: todayDocs.reduce((a, o) => a + calculateOrderProfit(o, productsCostMap), 0),
        todayOrders: todayDocs.length,
        totalOrders: activeDocs.length,
        codOrdersCount,
        onlineOrdersCount,
        paidOrdersCount,
        pendingPaymentsCount,
        pendingPaymentsValue,
        recentOrders: docs.slice(0, 5),
        chartData
      });

    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, currentUser?.uid]);

  useEffect(() => {
    // If admin session is active (via direct-check login), start loading data.
    // If no admin session, stop loading immediately.
    if (!isAdmin) { setLoading(false); return; }
    // If Firebase user is present, we can do a Firestore check. Otherwise skip.
    if (!currentUser?.uid) { setLoading(false); return; }
  }, [isAdmin, currentUser?.uid]);

  useEffect(() => {
    if (!isAdmin) return;
    loadDashboardData();

    // Auto refresh every 5 minutes (300 seconds interval)
    const timer = setInterval(() => {
      loadDashboardData(true);
    }, 300000);

    return () => clearInterval(timer);
  }, [isAdmin, loadDashboardData]);

  // ✅ Derived at render time — always consistent, never stale
  const netProfit = orderStats.grossProfit - totalExpenses;
  const targetPct = Math.min(100, Math.round((orderStats.totalSales / MONTHLY_TARGET) * 100));
  const targetDisplay = orderStats.totalSales >= 1000
    ? `₹${(orderStats.totalSales / 1000).toFixed(1)}K`
    : `₹${orderStats.totalSales}`;

  const sendDailyReport = () => {
    const phone = import.meta.env.VITE_WHATSAPP_REPORT_NUMBER?.trim();

    if (!phone) {
      alert('⚠️ VITE_WHATSAPP_REPORT_NUMBER is not set in .env. Restart the dev server after adding it.');
      return;
    }

    const todayProfitPct = orderStats.todaySales > 0 ? ((orderStats.todayProfit / orderStats.todaySales) * 100).toFixed(1) : '0.0';

    const date = new Date().toLocaleDateString('en-IN');
    const message =
      `📊 *SMKP TRADERS DAILY REPORT*\n\n` +
      `📅 *Date:* ${date}\n\n` +
      `📦 *Orders:* ${orderStats.todayOrders}\n` +
      `💰 *Sales:* ₹${orderStats.todaySales.toLocaleString()}\n` +
      `📈 *Profit:* ₹${orderStats.todayProfit.toLocaleString()}\n` +
      `📊 *Profit %:* ${todayProfitPct}%\n\n` +
      `Keep pushing! 🚀`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <div className="mb-10">
          <div className="h-8 bg-gray-200 rounded-full w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded-full w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[...Array(4)].map((_, i) => <StatSkeleton key={`stat-skeleton-${i}`} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-gray-900 rounded-2xl h-96 animate-pulse" />
          <div className="space-y-6">
            <div className="bg-slate-950 rounded-2xl h-48 animate-pulse" />
            <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn min-w-0 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-500 text-sm font-medium">Optimized business performance analytics</p>
        </div>
        <button
          onClick={() => loadDashboardData()}
          disabled={refreshing}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-yellow-500/10 active:scale-95 disabled:scale-100"
        >
          {refreshing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <TrendingUp size={14} />
          )}
          {refreshing ? "Refreshing..." : "Refresh Stats"}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6 mb-10 admin-stats-grid">
        <StatCard title="Total Revenue" value={formatCurrency(orderStats.totalSales)} icon={DollarSign} color="bg-yellow-500" />
        <StatCard title="Total Orders" value={orderStats.totalOrders} icon={ShoppingBag} color="bg-orange-500" />
        <StatCard title="COD Orders" value={orderStats.codOrdersCount || 0} icon={Wallet} color="bg-teal-500" />
        <StatCard title="Online Orders" value={orderStats.onlineOrdersCount || 0} icon={ArrowUpRight} color="bg-blue-500" />
        <StatCard title="Paid Orders" value={orderStats.paidOrdersCount || 0} icon={CheckCircle} color="bg-green-500" />
        <StatCard title="Pending Payments" value={formatCurrency(orderStats.pendingPaymentsValue || 0)} icon={Clock} color="bg-red-500" trend={`${orderStats.pendingPaymentsCount || 0} Orders`} />
      </div>

      {/* Complaints Quick Link */}
      {complaintCount > 0 && (
        <Link to="/admin/complaints">
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 flex items-center justify-between hover:bg-red-500/20 transition-all">
            <div className="flex items-center gap-3">
              <MessageSquareWarning size={20} className="text-red-400" />
              <div>
                <p className="text-sm font-black text-red-400">{complaintCount} New Complaint{complaintCount > 1 ? 's' : ''} Awaiting Review</p>
                <p className="text-xs text-gray-500">Click to manage customer complaints</p>
              </div>
            </div>
            <ArrowUpRight size={16} className="text-red-400" />
          </div>
        </Link>
      )}

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-10">
        <div className="lg:col-span-2 bg-gray-900 rounded-3xl p-4 sm:p-8 border border-yellow-900/10 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Growth Analytics</h2>
              <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-tighter">Revenue & Profit — last 7 days</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-[10px] font-black text-yellow-600 uppercase">Revenue</span>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                <span className="text-[10px] font-black text-indigo-600 uppercase">Profit</span>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={orderStats.chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', color: '#fff' }}
                  itemStyle={{ fontWeight: 800 }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={2000} />
                <Area type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div>
            <div className="w-12 h-12 bg-gray-900/10 rounded-xl flex items-center justify-center mb-6 border border-white/10">
              <TrendingUp className="text-yellow-400" size={24} />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-2">Target Achievement</h3>
            <p className="text-gray-400 text-sm font-medium">Monthly revenue target status</p>
          </div>
          <div className="space-y-6 mt-12">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Progress</span>
                {/* ✅ Derived from real sales data, not hardcoded */}
                <span className="text-xl font-black">{targetPct}%</span>
              </div>
              <div className="w-full bg-gray-900/10 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-cyan-400 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Target</p>
                {/* ✅ Derived from MONTHLY_TARGET constant */}
                <p className="font-bold text-lg">₹{(MONTHLY_TARGET / 1000).toFixed(0)}K</p>
              </div>
              <div className="bg-gray-900/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Current</p>
                <p className="font-bold text-lg text-yellow-400">{targetDisplay}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Orders Table */}
        <div className="bg-gray-900 rounded-2xl shadow-sm border border-yellow-900/10 lg:col-span-2 overflow-hidden">
          <div className="px-8 py-6 border-b border-yellow-900/10 flex justify-between items-center bg-slate-950/30">
            <h2 className="text-lg font-black text-white uppercase tracking-widest">Recent Activity</h2>
            <Link to="/admin/orders" className="text-yellow-600 hover:text-yellow-700 text-xs font-black uppercase tracking-widest">
              View All Orders
            </Link>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-gray-400 text-[10px] uppercase tracking-[0.2em] border-b border-yellow-900/10">
                  <th className="px-8 py-4 font-bold">Order ID</th>
                  <th className="px-8 py-4 font-bold">Customer</th>
                  <th className="px-8 py-4 font-bold">Status</th>
                  <th className="px-8 py-4 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {orderStats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-8 py-10 text-center text-gray-400 font-medium italic">
                      No recent orders yet
                    </td>
                  </tr>
                ) : (
                  orderStats.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-950/50 transition-colors group">
                      <td className="px-8 py-5 font-black text-white tracking-tight">#{order.id.slice(-8).toUpperCase()}</td>
                      <td className="px-8 py-5 text-gray-400 font-medium">{order.customerName || 'Guest'}</td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getStatusStyle(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 font-black text-white text-right">₹{Number(order.totalPrice).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden divide-y divide-yellow-900/10">
            {orderStats.recentOrders.length === 0 ? (
              <div className="px-8 py-10 text-center text-gray-400 font-medium italic">
                No recent orders yet
              </div>
            ) : (
              orderStats.recentOrders.map((order) => (
                <div key={order.id} className="p-6 flex flex-col gap-3 hover:bg-slate-950/50 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-white text-sm">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className="text-[10px] font-medium text-gray-500">
                      {order.createdAt instanceof Date ? order.createdAt.toLocaleDateString('en-IN') : 'Recent'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-gray-400 text-xs font-bold">{order.customerName || 'Guest'}</p>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter mt-1">{order.paymentMethod || 'COD'}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter w-fit ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                      <span className="font-black text-white text-base">₹{Number(order.totalPrice).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-slate-900 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <h2 className="text-xl font-black uppercase tracking-widest mb-6 relative z-10">Quick Actions</h2>
            
            {/* Daily stats summary display */}
            <div className="space-y-3 mb-6 relative z-10 bg-black/40 p-4 rounded-2xl border border-yellow-500/10">
              <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-2 pb-1 border-b border-yellow-500/10">Daily Report Summary</p>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">Orders:</span>
                <span className="font-black text-white">{orderStats.todayOrders}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">Sales:</span>
                <span className="font-black text-white">₹{orderStats.todaySales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">Profit:</span>
                <span className={`font-black ${orderStats.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹{orderStats.todayProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">Profit %:</span>
                <span className={`font-black ${orderStats.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {orderStats.todaySales > 0 ? ((orderStats.todayProfit / orderStats.todaySales) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <Link to="/admin/products" className="flex items-center justify-between w-full p-4 bg-gray-900/5 hover:bg-gray-900/10 border border-white/10 rounded-xl transition-all group">
                <span className="font-bold text-sm tracking-wide">Manage Products</span>
                <ArrowUpRight size={18} className="text-yellow-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Link>
              <Link to="/admin/orders" className="flex items-center justify-between w-full p-4 bg-gray-900/5 hover:bg-gray-900/10 border border-white/10 rounded-xl transition-all group">
                <span className="font-bold text-sm tracking-wide">Process Orders</span>
                <ArrowUpRight size={18} className="text-yellow-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Link>
              <button
                type="button"
                onClick={sendDailyReport}
                className="flex items-center justify-between w-full p-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl transition-all group mt-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 text-lg">📲</span>
                  <span className="font-bold text-sm tracking-wide text-yellow-400">Send Daily Report</span>
                </div>
                <ArrowUpRight size={18} className="text-yellow-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-yellow-900/10 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-yellow-900/10 bg-slate-950/30">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Top Selling Products</h3>
            </div>
            <div className="divide-y divide-yellow-900/10">
              {topProducts.map((product, idx) => (
                <div key={product.id || `top-prod-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-950/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* ✅ Descriptive alt text for product images */}
                    <img
                      src={getOptimizedImage(product.image, 'thumbnail')}
                      alt={product.name}
                      loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover border border-yellow-900/20"
                    />
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{product.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-yellow-500">{product.soldCount || 0}</p>
                    <p className="text-[8px] text-gray-600 font-black uppercase tracking-tighter">Sold</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock Alert Widget */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-yellow-500/10 bg-yellow-500/5 flex items-center gap-3">
              <AlertTriangle size={16} className="text-yellow-500" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Low Stock Products</h3>
              <span className="ml-auto text-[10px] font-black text-yellow-500 uppercase tracking-widest">
                {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No low stock products</p>
              </div>
            ) : (
              <div className="divide-y divide-yellow-500/10">
                {lowStockProducts.map((product, idx) => {
                  const stock = Number(product.stock ?? 0);
                  return (
                    <div key={product.id || `low-stock-${idx}`} className="p-4 flex items-center justify-between hover:bg-yellow-500/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <img
                          src={getOptimizedImage(product.image, 'thumbnail')}
                          alt={product.name}
                          loading="lazy"
                          className="w-9 h-9 rounded-lg object-cover border border-yellow-500/20"
                        />
                        <div>
                          <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">{product.name}</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-yellow-500">{stock}</p>
                        <p className="text-[8px] text-yellow-500/60 font-black uppercase tracking-tighter">Left</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Out of Stock Alert Widget */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-red-500/10 bg-red-500/5 flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Out of Stock Products</h3>
              <span className="ml-auto text-[10px] font-black text-red-400 uppercase tracking-widest">
                {outOfStockProducts.length} {outOfStockProducts.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            {outOfStockProducts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No out of stock products</p>
              </div>
            ) : (
              <div className="divide-y divide-red-500/10">
                {outOfStockProducts.map((product, idx) => {
                  const stock = Number(product.stock ?? 0);
                  return (
                    <div key={product.id || `out-of-stock-${idx}`} className="p-4 flex items-center justify-between hover:bg-red-500/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <img
                          src={getOptimizedImage(product.image, 'thumbnail')}
                          alt={product.name}
                          loading="lazy"
                          className="w-9 h-9 rounded-lg object-cover border border-red-500/20"
                        />
                        <div>
                          <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">{product.name}</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-red-400">{stock}</p>
                        <p className="text-[8px] text-red-400/60 font-black uppercase tracking-tighter">Left</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="p-4 border-t border-red-500/10 bg-red-500/5">
              <Link
                to="/admin/products"
                className="w-full flex items-center justify-center gap-2 py-2 border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all"
              >
                Manage Stock <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6">
            <h3 className="text-xs font-black text-yellow-600 uppercase tracking-[0.2em] mb-4">Stock Integrity</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Active SKU's</span>
                <span className="text-white font-black">{totalProducts}</span>
              </div>
              <div className="w-full bg-yellow-500/10 h-2 rounded-full overflow-hidden">
                <div className="bg-yellow-500 h-full rounded-full" style={{ width: '100%' }} />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("This will scan all products to fix numeric types (price, cost, stock) and remove legacy fields. Continue?")) {
                    try {
                      const { getDocs, collection, updateDoc, doc, deleteField } = await import('firebase/firestore');
                      const snap = await getDocs(collection(db, 'products'));
                      let count = 0;
                      for (const d of snap.docs) {
                        const data = d.data();
                        const needsUpdate = 
                          data.inventory !== undefined || 
                          data.quantity !== undefined ||
                          typeof data.price === 'string' ||
                          typeof data.costPrice === 'string' ||
                          typeof data.stock === 'string' ||
                          data.costPrice === undefined;

                        if (needsUpdate) {
                          // Use raw costPrice — fall back to legacy cost field for old docs
                          const normalizedCost = Number(data.costPrice ?? data.cost ?? 0);
                          await updateDoc(doc(db, 'products', d.id), {
                            inventory: deleteField(),
                            quantity: deleteField(),
                            price: Number(data.price || 0),
                            costPrice: normalizedCost,
                            // NOTE: 'cost' legacy field NOT written — use costPrice everywhere
                            stock: Number(data.stock || 0)
                          });
                          count++;
                        }
                      }
                      alert(`Successfully normalized ${count} products.`);
                    } catch (err) {
                      console.error(err);
                      alert("Cleanup failed. Check console.");
                    }
                  }
                }}
                className="w-full mt-4 py-2 border border-yellow-600/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-yellow-600 hover:bg-yellow-600/10 transition-all"
              >
                Scan & Normalize Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;