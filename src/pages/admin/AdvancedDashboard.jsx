import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  DollarSign, Fuel, TrendingUp, Clock,
  Bell, Search, CheckCircle, ShoppingBag, PieChart as PieIcon, X
} from 'lucide-react';
// FIX 8: removed unused imports — Menu, User, ArrowUpRight, LayoutDashboard, Area, AreaChart
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import logo from '../../assets/logo.png';
import { Link, useNavigate } from 'react-router-dom';

/* ── Mock Data ──────────────────────────────────────────────────── */
const dailyEarnings = [
  { name: 'Mon', amount: 4500 },
  { name: 'Tue', amount: 5200 },
  { name: 'Wed', amount: 4800 },
  { name: 'Thu', amount: 6100 },
  { name: 'Fri', amount: 5900 },
  { name: 'Sat', amount: 7200 },
  { name: 'Sun', amount: 6500 },
];

const fuelUsage = [
  { name: 'Mon', liters: 45 },
  { name: 'Tue', liters: 52 },
  { name: 'Wed', liters: 40 },
  { name: 'Thu', liters: 65 },
  { name: 'Fri', liters: 58 },
  { name: 'Sat', liters: 48 },
  { name: 'Sun', liters: 50 },
];

const stats = [
  { title: 'Total Revenue', value: '₹1,24,500', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: '+12.5%' },
  { title: 'Fuel Cost', value: '₹18,400', icon: Fuel, color: 'text-orange-400', bg: 'bg-orange-500/10', trend: '-2.4%' },
  { title: 'Net Profit', value: '₹84,200', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', trend: '+15.2%' },
  { title: 'Work Hours', value: '164h', icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10', trend: '+8.1%' },
];

// FIX 4: nav items with real routes so sidebar links actually navigate
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Inventory', to: '/admin/inventory' },
  { label: 'Fleet', to: '/admin/fleet' },
  { label: 'Staff', to: '/admin/staff' },
  { label: 'Settings', to: '/admin/settings' },
];

/* ── Component ──────────────────────────────────────────────────── */
const AdvancedDashboard = () => {
  const { width, height } = useWindowSize();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  // FIX 3: mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navigate = useNavigate();

  // FIX 7: ref guard so "Complete Task" can't be double-fired
  const taskPendingRef = useRef(false);
  // FIX 1: store timeout id so we can clear it on unmount
  const confettiTimerRef = useRef(null);

  // FIX 1: clean up confetti timer if component unmounts mid-animation
  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, []);

  const handleTaskComplete = useCallback(() => {
    if (taskPendingRef.current) return; // FIX 7: prevent double-fire
    taskPendingRef.current = true;

    setShowSuccess(true);
    setIsConfettiActive(true);

    // FIX 1: store the id so we can cancel on unmount
    confettiTimerRef.current = setTimeout(() => {
      setIsConfettiActive(false);
      taskPendingRef.current = false;
    }, 5000);
  }, []);

  // FIX 2: closing the modal also kills confetti and resets the guard
  const handleCloseModal = useCallback(() => {
    setShowSuccess(false);
    setIsConfettiActive(false);
    if (confettiTimerRef.current) {
      clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    }
    taskPendingRef.current = false;
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-yellow-500/30">
      {isConfettiActive && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={300}
          colors={['#2dd4bf', '#3b82f6', '#f59e0b']}
        />
      )}

      {/* FIX 3: Mobile sidebar overlay — controlled by state, not hardcoded hidden */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <div className="flex">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        {/* FIX 3: mobile sidebar slides in/out via AnimatePresence */}
        <AnimatePresence>
          {(mobileSidebarOpen || true /* always visible on lg */) && (
            <aside
              className={`
                ${mobileSidebarOpen ? 'flex' : 'hidden'} lg:flex
                w-72 h-screen flex-col border-r border-white/5 bg-[#0d0d0d]
                sticky top-0 z-50 lg:z-auto
              `}
            >
              <div className="p-8 flex items-center justify-between">
                <Link to="/" className="flex items-center">
                  <img src={logo} alt="Logo" className="h-14 w-auto object-contain" />
                </Link>
                {/* Close button only visible on mobile */}
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="lg:hidden text-gray-500 hover:text-white transition-colors"
                  aria-label="Close sidebar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* FIX 4: real nav links */}
              <nav className="flex-1 px-4 space-y-2">
                {NAV_ITEMS.map(({ label, to }) => (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${label === 'Dashboard'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                      }`}
                  >
                    <div className="w-5 h-5 opacity-80" />
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="p-8 border-t border-white/5">
                <div className="bg-gradient-to-br from-yellow-500/20 to-blue-500/20 p-6 rounded-3xl border border-white/5 text-center">
                  <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-2">Pro Plan</p>
                  <p className="text-xs text-gray-400 font-medium mb-4">
                    Unlock advanced analytics and fleet tracking.
                  </p>
                  {/* FIX 5: was text-black on bg-gray-900 — completely invisible */}
                  <button className="w-full bg-yellow-500 text-black py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">
                    Upgrade Now
                  </button>
                </div>
              </div>
            </aside>
          )}
        </AnimatePresence>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="flex-1 p-6 md:p-10 overflow-x-hidden">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
              {/* FIX 3: hamburger to open mobile sidebar */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 bg-[#141414] border border-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                aria-label="Open sidebar"
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">
                  SMKP Traders Dashboard
                </h1>
                <p className="text-gray-500 font-medium flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  System online · Last sync 2 mins ago
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center bg-[#141414] border border-white/5 rounded-2xl px-4 py-2.5 w-64 focus-within:border-yellow-500/50 transition-all">
                <label htmlFor="analytics-search" className="sr-only">Search Analytics</label>
                <Search size={18} className="text-gray-400 flex-shrink-0" />
                <input
                  id="analytics-search"
                  name="analyticsSearch"
                  type="text"
                  placeholder="Search analytics..."
                  className="bg-transparent border-none outline-none ml-3 text-sm w-full placeholder:text-gray-700 text-white"
                />
              </div>
              <button className="p-3 bg-[#141414] border border-white/5 rounded-2xl text-gray-400 hover:text-white transition-colors relative" aria-label="Notifications">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" />
              </button>
              <button
                onClick={handleTaskComplete}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Task
              </button>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon size={24} />
                  </div>
                  <span className={`text-[10px] font-black ${stat.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                    {stat.trend}
                  </span>
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.title}</p>
                <h3 className="text-3xl font-black tracking-tight text-white">{stat.value}</h3>
              </motion.div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Bar Chart */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Daily Earnings</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">Revenue stream for current week</p>
                </div>
                <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-xl">
                  <ShoppingBag size={20} />
                </div>
              </div>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyEarnings}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 700 }} tickFormatter={v => `₹${v / 1000}k`} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff', fontWeight: 800 }}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {dailyEarnings.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#14b8a6' : '#0ea5e9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Line Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Fuel Usage Trend</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">Consumption analytics per liter</p>
                </div>
                <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl">
                  <Fuel size={20} />
                </div>
              </div>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fuelUsage}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 700 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#f59e0b', fontWeight: 800 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="liters"
                      stroke="#f59e0b"
                      strokeWidth={4}
                      dot={{ r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#141414' }}
                      activeDot={{ r: 8 }}
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Footer Card — FIX 6: replaced near-invisible bg-gray-900/5 with visible bg-white/5 */}
          <div className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-yellow-400 border border-white/10">
                <PieIcon size={32} />
              </div>
              <div>
                <h4 className="font-black text-white uppercase tracking-widest mb-1 text-sm">
                  Optimization Suggestion
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  Switch to electric fleet to save approximately{' '}
                  <span className="text-yellow-400">₹45,000/mo</span>.
                </p>
              </div>
            </div>
            {/* FIX 6: replaced bg-gray-900/5 (invisible) with bg-white/5 */}
            <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
              Download PDF Report
            </button>
          </div>
        </main>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}   // FIX 2: also stops confetti
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="bg-[#141414] border border-white/10 p-10 rounded-[3rem] shadow-2xl relative z-10 text-center max-w-sm w-full"
            >
              <div className="w-20 h-20 bg-yellow-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-yellow-500/20">
                <CheckCircle size={40} />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Success!</h2>
              <p className="text-gray-500 font-medium mb-10 leading-relaxed">
                Task has been marked as complete and recorded in logs.
              </p>
              <button
                onClick={handleCloseModal}   // FIX 2: clears confetti + resets guard
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-yellow-500/20"
              >
                Continue
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvancedDashboard;