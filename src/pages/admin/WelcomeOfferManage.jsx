import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNotification } from '../../context/NotificationContext';
import { useSiteSettings, defaultWelcomeOffer } from '../../context/SiteSettingsContext';
import { Gift, Tag, IndianRupee, ToggleLeft, ToggleRight, Loader2, Save, ShoppingCart, TrendingUp, Users } from 'lucide-react';

const WelcomeOfferManage = () => {
  const { showToast } = useNotification();
  const { refreshSettings } = useSiteSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Welcome offer config state
  const [config, setConfig] = useState(defaultWelcomeOffer);
  
  // Statistics and orders state
  const [usageStats, setUsageStats] = useState({
    totalCount: 0,
    totalSaved: 0,
    orders: []
  });

  const fetchWelcomeOfferData = async () => {
    try {
      setLoading(true);
      // 1. Fetch configuration settings
      const configRef = doc(db, 'site_settings', 'welcome_offer');
      const configSnap = await getDoc(configRef);
      
      let currentCode = defaultWelcomeOffer.code;
      if (configSnap.exists()) {
        const data = configSnap.data();
        setConfig({
          ...defaultWelcomeOffer,
          ...data
        });
        currentCode = data.code || defaultWelcomeOffer.code;
      } else {
        setConfig(defaultWelcomeOffer);
      }

      // 2. Query usage from orders collection
      const q = query(
        collection(db, 'orders'),
        where('couponCode', '==', currentCode)
      );
      const querySnap = await getDocs(q);
      
      let count = 0;
      let savings = 0;
      const orderDocs = [];
      
      querySnap.forEach((docSnap) => {
        const order = { id: docSnap.id, ...docSnap.data() };
        // count active/completed ones
        if (order.status !== 'cancelled') {
          count += 1;
          savings += Number(order.couponDiscount || 0);
          orderDocs.push(order);
        }
      });

      // Sort orders by date descending
      orderDocs.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });

      setUsageStats({
        totalCount: count,
        totalSaved: savings,
        orders: orderDocs
      });

    } catch (err) {
      console.error("Error loading Welcome Offer admin data:", err);
      showToast("Failed to load welcome offer data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWelcomeOfferData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'code' ? value.toUpperCase() : value)
    }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!config.code.trim()) {
      showToast("Coupon code cannot be empty", "error");
      return;
    }
    if (config.discountAmount <= 0) {
      showToast("Discount amount must be greater than zero", "error");
      return;
    }
    if (config.minOrderValue < 0) {
      showToast("Minimum order value cannot be negative", "error");
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'site_settings', 'welcome_offer');
      await setDoc(docRef, {
        ...config,
        code: config.code.trim().toUpperCase(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Refresh SiteSettingsContext global state
      await refreshSettings();
      
      showToast("Welcome Offer settings saved successfully!", "success");
      
      // Reload usage stats for the new code if code was changed
      await fetchWelcomeOfferData();
    } catch (err) {
      console.error("Error saving welcome offer:", err);
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const isExpired = (expiryDate) => expiryDate && new Date(expiryDate) < new Date();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={36} className="text-yellow-500 animate-spin" />
        <p className="text-xs font-semibold uppercase text-gray-500 tracking-widest">Loading welcome offer settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-yellow-900/10 pb-5">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight uppercase flex items-center gap-3">
            <Gift className="text-yellow-500" /> Welcome Offer Management
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Configure and monitor the first-time customer welcome promotion</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Stat 1: Total Uses */}
        <div className="bg-gray-900 border border-yellow-900/10 rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Total Usage Count</p>
            <p className="text-3xl font-semibold text-white">{usageStats.totalCount}</p>
          </div>
          <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        {/* Stat 2: Total Savings Given */}
        <div className="bg-gray-900 border border-yellow-900/10 rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Total Discounts Given</p>
            <p className="text-3xl font-semibold text-yellow-500">₹{usageStats.totalSaved.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center">
            <IndianRupee size={20} />
          </div>
        </div>

        {/* Stat 3: Status Summary */}
        <div className="bg-gray-900 border border-yellow-900/10 rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Offer Status</p>
            <div>
              {config.enabled ? (
                isExpired(config.expiryDate) ? (
                  <span className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold uppercase tracking-widest rounded-full">Expired</span>
                ) : (
                  <span className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold uppercase tracking-widest rounded-full">Active</span>
                )
              ) : (
                <span className="inline-block px-3 py-1 bg-gray-500/10 border border-gray-500/20 text-gray-500 text-xs font-semibold uppercase tracking-widest rounded-full">Disabled</span>
              )}
            </div>
          </div>
          <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Form Card */}
        <div className="lg:col-span-1 bg-gray-900 border border-yellow-900/20 rounded-2xl p-6 shadow-2xl h-fit">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-yellow-900/10 pb-3">
            <Tag size={16} className="text-yellow-500" /> Promotion Settings
          </h2>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Enabled Switch */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">Status</label>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className="flex items-center justify-between w-full bg-black/40 border border-yellow-900/20 rounded-xl px-4 py-3 text-left transition-colors hover:border-yellow-500/40"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-white">
                  {config.enabled ? 'Offer Enabled' : 'Offer Disabled'}
                </span>
                {config.enabled ? (
                  <ToggleRight size={26} className="text-green-500" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-600" />
                )}
              </button>
            </div>

            {/* Coupon Code Input */}
            <div className="space-y-2">
              <label htmlFor="code" className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">Coupon Code *</label>
              <input
                id="code"
                name="code"
                value={config.code}
                onChange={handleChange}
                required
                maxLength={20}
                placeholder="e.g. FIRSTORDER"
                className="w-full bg-black/40 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-widest outline-none focus:border-yellow-500 transition-all"
              />
            </div>

            {/* Discount Value */}
            <div className="space-y-2">
              <label htmlFor="discountAmount" className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">Discount Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 text-sm font-semibold">₹</span>
                <input
                  id="discountAmount"
                  name="discountAmount"
                  type="number"
                  min={1}
                  value={config.discountAmount}
                  onChange={handleNumberChange}
                  required
                  placeholder="30"
                  className="w-full bg-black/40 border border-yellow-900/30 text-white rounded-xl pl-8 pr-4 py-3 text-sm font-semibold outline-none focus:border-yellow-500 transition-all"
                />
              </div>
            </div>

            {/* Minimum Order Value */}
            <div className="space-y-2">
              <label htmlFor="minOrderValue" className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">Min. Order Value (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 text-sm font-semibold">₹</span>
                <input
                  id="minOrderValue"
                  name="minOrderValue"
                  type="number"
                  min={0}
                  value={config.minOrderValue}
                  onChange={handleNumberChange}
                  placeholder="299"
                  className="w-full bg-black/40 border border-yellow-900/30 text-white rounded-xl pl-8 pr-4 py-3 text-sm font-semibold outline-none focus:border-yellow-500 transition-all"
                />
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <label htmlFor="expiryDate" className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">Expiry Date</label>
              <div className="relative">
                <input
                  id="expiryDate"
                  name="expiryDate"
                  type="date"
                  value={config.expiryDate || ''}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-black/40 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-yellow-500 transition-all"
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-black font-semibold py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-yellow-500/20"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Usage Orders List Table Card */}
        <div className="lg:col-span-2 bg-gray-900 border border-yellow-900/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-yellow-900/10 bg-slate-950/20 flex items-center gap-3">
            <ShoppingCart size={16} className="text-yellow-500" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Recent Redemptions</h2>
            <span className="ml-auto text-xs font-semibold text-gray-500 uppercase tracking-widest">{usageStats.orders.length} total</span>
          </div>

          {usageStats.orders.length === 0 ? (
            <div className="text-center py-20">
              <Gift size={40} className="text-gray-800 mx-auto mb-4" />
              <p className="text-gray-500 font-semibold uppercase tracking-widest text-xs">No orders have redeemed this coupon code yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 text-gray-400 text-[9px] uppercase tracking-[0.2em] border-b border-yellow-900/10">
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold">Customer / Phone</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Discount</th>
                    <th className="px-6 py-4 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-900/10">
                  {usageStats.orders.map((order) => {
                    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                    const formattedDate = date.toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });
                    
                    return (
                      <tr key={order.id} className="hover:bg-slate-950/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-semibold text-gray-400 group-hover:text-yellow-500 transition-colors">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-xs font-semibold text-white">{order.name}</p>
                            <p className="text-[10px] text-gray-500 font-semibold">{order.phone}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-gray-400 font-medium">{formattedDate}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block text-[8px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            order.status === 'delivered'
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : order.status === 'cancelled'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          }`}>
                            {order.status || 'ordered'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-green-400 text-xs">- ₹{order.couponDiscount}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-white text-xs">₹{Number(order.totalPrice).toLocaleString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeOfferManage;
