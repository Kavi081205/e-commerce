import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertCircle, CheckCircle2, Truck, Clock, ChevronDown, ChevronUp, ShoppingBag, MessageSquarePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ComplaintForm from '../components/ComplaintForm';
import { useNotification } from '../context/NotificationContext';

const STATUS_CONFIG = {
  delivered: { label: 'Delivered', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle2 },
  shipped: { label: 'Shipped', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: Truck },
  processing: { label: 'Processing', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', icon: Clock },
  ordered: { label: 'Ordered', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Package },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: AlertCircle },
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.ordered;

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [phone, setPhone] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [searched, setSearched] = useState(false);
  const [complaintOrder, setComplaintOrder] = useState(null); // order for complaint modal
  const { showToast } = useNotification();

  const searchOrders = async (e) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;

    const cleanPhone = phoneInput.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      setPhone(cleanPhone);
      const response = await fetch(`/api/orders?mobile=${cleanPhone}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch orders');
      }
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
        showToast(`Found ${data.orders?.length || 0} order(s)`, 'success');
      } else {
        throw new Error(data.message || 'Failed to fetch orders');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      showToast(err.message || 'Error fetching orders. Please try again.', 'error');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-16 overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.5em] mb-3">
            Order History
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-3">My Orders</h1>
          <p className="text-gray-500 text-sm">Enter your phone number to view your orders</p>
        </div>

        {/* Phone Search */}
        <form onSubmit={searchOrders} className="flex flex-wrap gap-3 mb-10 w-full">
          <label htmlFor="my-orders-phone" className="sr-only">Phone Number</label>
          <input
            id="my-orders-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder="Enter your phone number"
            className="flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors box-border"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 w-full sm:w-auto bg-yellow-500 text-black px-6 py-4 rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Results */}
        {loading && searched && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && orders.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-lg">No orders found</p>
            <p className="text-sm mt-2">Try a different phone number or <Link to="/products" className="text-yellow-500 underline">shop now</Link></p>
          </div>
        )}

        <div className="space-y-4">
          {orders.map(order => {
            const cfg = getStatusConfig(order.status || order.orderStatus);
            const Icon = cfg.icon;
            const isExpanded = expandedId === order.id;
            const isDelivered = (order.status || order.orderStatus || '').toLowerCase() === 'delivered';
            const items = order.items || order.orderedItems || [];
            const shortId = order.id.slice(-8).toUpperCase();

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              >
                {/* Order Header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2.5 rounded-xl border ${cfg.bg} shrink-0`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-white text-sm">#{shortId}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-yellow-400 font-black">₹{(order.totalPrice || 0).toLocaleString()}</p>
                      <span className={`text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                  </div>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
                        {/* Items */}
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">Items Ordered</p>
                          <div className="space-y-2">
                            {items.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3">
                                {item.image && (
                                  <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-white truncate">{item.name || item.productName}</p>
                                  <p className="text-xs text-gray-500">Qty: {item.quantity || 1} · ₹{item.effectivePrice || item.price || 0}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Address */}
                        {order.address && (
                          <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Delivery Address</p>
                            <p className="text-sm text-gray-300">{order.address}, {order.city}, {order.state} - {order.pincode}</p>
                          </div>
                        )}

                        {/* Summary */}
                        <div className="flex items-center justify-between bg-gray-800/40 rounded-xl p-3">
                          <div className="text-xs text-gray-500">Total</div>
                          <div className="font-black text-yellow-400">₹{(order.totalPrice || 0).toLocaleString()}</div>
                        </div>

                        {/* Raise Complaint — only for delivered orders */}
                        {isDelivered && (
                          <button
                            type="button"
                            onClick={() => setComplaintOrder(order)}
                            className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all rounded-xl py-3 font-bold text-sm"
                          >
                            <MessageSquarePlus size={16} />
                            Raise a Complaint
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Track complaints link */}
        {searched && orders.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              to="/my-complaints"
              className="text-yellow-500 text-sm font-bold underline underline-offset-4 hover:text-yellow-400 transition-colors"
            >
              View My Complaints →
            </Link>
          </div>
        )}
      </div>

      {/* Complaint Modal */}
      {complaintOrder && (
        <ComplaintForm
          order={complaintOrder}
          customerPhone={phone}
          onClose={() => setComplaintOrder(null)}
        />
      )}
    </div>
  );
}
