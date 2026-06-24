import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import {
  collection, getDocs, updateDoc, doc, deleteDoc,
  query, orderBy, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import {
  Eye, EyeOff, Search, Loader2, CheckCircle, Clock,
  MapPin, Phone, ShoppingBag, X, Download, History,
  Truck, Package, FileSpreadsheet, Printer, Trash2,
  Copy, Mail, ChevronDown, ChevronUp, Calendar, CreditCard, ExternalLink, RefreshCw,
  PackageCheck, PackageOpen
} from 'lucide-react';
import { generateInvoice } from '../../utils/invoiceGenerator';
import { exportOrdersToExcel } from '../../utils/excelExport';
import { getOptimizedImage } from '../../utils/cloudinary';
import { useNotification } from '../../context/NotificationContext';
import { InvoicePrintView, LabelPrintView } from '../../components/PrintViews';
import { useAuth } from '../../context/AuthContext';
import { maskPhone } from '../../utils/security';
import { logPhoneReveal } from '../../utils/activityLog';

const STATUS_FLOW = ['ordered', 'processing', 'shipped', 'delivered'];

// Confirmation Modal
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
    <div className="bg-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-yellow-900/10">
      <p className="text-white font-bold text-center mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-yellow-900/20 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all animate-pulse"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

const PACKING_STATUS = { NOT_PACKED: 'NOT_PACKED', PACKED: 'PACKED' };

const OrdersManage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [packingFilter, setPackingFilter] = useState('ALL'); // 'ALL' | 'NOT_PACKED' | 'PACKED'
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [revealedPhones, setRevealedPhones] = useState({});
  const [packingLoading, setPackingLoading] = useState({});

  const { currentUser } = useAuth();
  const { showToast } = useNotification();
  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error')
  };

  const handleToggleRevealPhone = useCallback(async (orderId) => {
    if (currentUser?.role !== 'admin') {
      toast.error("Unauthorized. Admin role required to view customer phone numbers.");
      return;
    }
    const isNowRevealed = !revealedPhones[orderId];
    if (isNowRevealed) {
      await logPhoneReveal(orderId, currentUser?.uid);
    }
    setRevealedPhones(prev => ({
      ...prev,
      [orderId]: isNowRevealed
    }));
  }, [currentUser, revealedPhones]);

  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          console.error("Window print error:", err);
          toast.error("Unable to generate print layout. Attempting PDF download...");
          if (printData.type === 'invoice') {
            generateInvoice(printData.order, { action: 'download' }).catch(e => {
              console.error("Fallback PDF download failed:", e);
              toast.error("Unable to generate invoice");
            });
          }
        } finally {
          setIsPrinting(false);
          setTimeout(() => setPrintData(null), 500);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printData]);

  const handlePrint = (order, type) => {
    setIsPrinting(true);
    setPrintData({ type, order });
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) ?? null;

  const handleStatusChange = useCallback(async (id, newStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id
      ? { ...o, status: newStatus, orderStatus: newStatus }
      : o
    ));
    try {
      await updateDoc(doc(db, 'orders', id), {
        status: newStatus,
        orderStatus: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: newStatus,
          timestamp: new Date().toISOString(),
          message: `Status updated to ${newStatus} by admin`
        })
      });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update order status');
      fetchOrders(); // rollback via re-fetch
    }
  }, []);

  // ── Packing Management ───────────────────────────────────────────────────
  const handleMarkPacked = useCallback(async (id) => {
    setPackingLoading(prev => ({ ...prev, [id]: true }));
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id
      ? { ...o, packingStatus: PACKING_STATUS.PACKED, packedAt: new Date().toISOString(), packedBy: currentUser?.email || 'Admin' }
      : o
    ));
    try {
      await updateDoc(doc(db, 'orders', id), {
        packingStatus: PACKING_STATUS.PACKED,
        packedAt: serverTimestamp(),
        packedBy: currentUser?.email || currentUser?.uid || 'Admin',
        updatedAt: serverTimestamp()
      });
      toast.success('Order marked as packed ✅');
    } catch (error) {
      console.error('Error updating packing status:', error);
      toast.error('Failed to update packing status');
      fetchOrders(); // rollback
    } finally {
      setPackingLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [currentUser]);

  const handlePaymentStatusChange = useCallback(async (id, newPaymentStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id
      ? { ...o, paymentStatus: newPaymentStatus }
      : o
    ));
    try {
      await updateDoc(doc(db, 'orders', id), {
        paymentStatus: newPaymentStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Payment status updated to ${newPaymentStatus}`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('Failed to update payment status');
      fetchOrders(); // rollback
    }
  }, []);

  const handleDeleteOrder = useCallback((id, closeModal = false) => {
    setConfirmDelete({ id, closeModal });
  }, []);

  const confirmDeleteOrder = async () => {
    const { id, closeModal } = confirmDelete;
    setConfirmDelete(null);
    // Optimistic update
    setOrders(prev => prev.filter(o => o.id !== id));
    if (closeModal) setSelectedOrderId(null);
    try {
      await deleteDoc(doc(db, 'orders', id));
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
      fetchOrders(); // rollback
    }
  };

  const getNextStatus = (current) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'shipped': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'ordered': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-neutral-800 text-neutral-400 border-neutral-700/50';
    }
  };

  // Safe Customer and Address Parsing
  const parseCustomerDetails = (order) => {
    const cityVal = order.customerDetails?.city || order.city || '';
    const [district = '', state = ''] = cityVal.split(',').map(s => s.trim());
    return {
      name: order.customerDetails?.name || order.customerName || order.name || 'Guest',
      phone: order.customerDetails?.phone || order.phone || '',
      email: order.customerDetails?.email || order.userEmail || '',
      address: order.customerDetails?.address || order.address || '',
      district: order.customerDetails?.district || district || '',
      state: order.customerDetails?.state || state || '',
      pincode: order.customerDetails?.pincode || order.pincode || '',
      landmark: order.customerDetails?.landmark || order.landmark || ''
    };
  };

  // Safe Items Parsing
  const parseOrderedItems = (order) => {
    return (order.orderedItems || order.items || []).map(item => {
      const price = Number(item.effectivePrice || item.price || 0);
      const qty = Number(item.quantity || 1);
      return {
        productId: item.productId || item.id || '',
        name: item.productName || item.name || 'Unknown Product',
        image: item.image || '',
        color: item.color || item.selectedColor || '',
        size: item.size || '',
        quantity: qty,
        price: price,
        total: Number(item.total || (price * qty))
      };
    });
  };

  const handleCopyAddress = (orderId, customer) => {
    const phoneToCopy = revealedPhones[orderId] ? customer.phone : maskPhone(customer.phone);
    const formatted = `${customer.name}\n${phoneToCopy}\n${customer.email}\n\n${customer.address}${customer.landmark ? '\nLandmark: ' + customer.landmark : ''}\n${customer.district}, ${customer.state} - ${customer.pincode}`;
    navigator.clipboard.writeText(formatted);
    toast.success("Full address copied to clipboard!");
  };

  const toggleItems = (orderId) => {
    setExpandedItems(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const filteredOrders = orders.filter(order => {
    const customer = parseCustomerDetails(order);
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      (order.pincode || '').includes(searchTerm);
    if (!matchesSearch) return false;
    if (packingFilter === 'PACKED') return (order.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.PACKED;
    if (packingFilter === 'NOT_PACKED') return (order.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.NOT_PACKED;
    return true;
  });

  const notPackedCount = orders.filter(o => (o.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.NOT_PACKED).length;
  const packedCount = orders.filter(o => o.packingStatus === PACKING_STATUS.PACKED).length;

  return (
    <div className="animate-fadeIn max-w-7xl mx-auto px-4 sm:px-6 py-6 text-left">
      {confirmDelete && (
        <ConfirmDialog
          message="Are you sure you want to delete this order? This cannot be undone."
          onConfirm={confirmDeleteOrder}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Order Logistics</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Fulfillment tracking, dynamic variants, and invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-4 bg-neutral-900/40 p-1.5 rounded-2xl border border-yellow-900/10 shadow-lg">
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-yellow-900/10">
              <Clock size={15} className="text-yellow-500" />
              <span className="text-xs font-black text-neutral-300">
                {orders.filter(o => o.status === 'ordered').length} New
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-yellow-900/10">
              <CheckCircle size={15} className="text-green-500" />
              <span className="text-xs font-black text-neutral-300">
                {orders.filter(o => o.status === 'delivered').length} Delivered
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-yellow-900/10">
              <PackageOpen size={15} className="text-orange-400" />
              <span className="text-xs font-black text-orange-400">
                {notPackedCount} Not Packed
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <PackageCheck size={15} className="text-green-400" />
              <span className="text-xs font-black text-green-400">
                {packedCount} Packed
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportOrdersToExcel(orders)}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg shadow-green-600/20 transition-all active:scale-95"
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            title="Refresh orders"
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-yellow-400 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] border border-yellow-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-4 relative">
        <label htmlFor="order-search" className="sr-only">Search Orders</label>
        <input
          type="text"
          id="order-search"
          name="orderSearch"
          autoComplete="off"
          placeholder="Search by ID, Customer Name, Pincode, or Phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3.5 bg-neutral-900/30 border border-yellow-900/10 rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none transition-all text-xs font-medium text-white placeholder-neutral-500"
        />
        <Search size={16} className="absolute left-4 top-4 text-neutral-500" />
      </div>

      {/* Packing Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mr-1">Packing:</span>
        {[
          { key: 'ALL', label: 'All Orders', icon: Package },
          { key: 'NOT_PACKED', label: '📦 Not Packed', icon: PackageOpen },
          { key: 'PACKED', label: '✅ Packed', icon: PackageCheck },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPackingFilter(key)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
              packingFilter === key
                ? key === 'NOT_PACKED'
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                  : key === 'PACKED'
                    ? 'bg-green-500/15 border-green-500/40 text-green-400'
                    : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
                : 'bg-neutral-900/40 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 text-center text-neutral-500 bg-neutral-900/10 rounded-3xl border border-yellow-900/5">
          <Loader2 size={32} className="animate-spin mx-auto mb-3 text-yellow-500" />
          <p className="font-black uppercase tracking-widest text-[9px]">Loading Orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-24 text-center text-neutral-500 bg-neutral-900/10 rounded-3xl border border-yellow-900/5 font-black uppercase tracking-widest text-[10px]">
          No orders matching criteria.
        </div>
      ) : (
        /* Grid list of Orders (responsive cards) */
        <div className="grid grid-cols-1 gap-6">
          {filteredOrders.map((order) => {
            const customer = parseCustomerDetails(order);
            const items = parseOrderedItems(order);
            const isExpanded = !!expandedItems[order.id];
            const itemsToShow = isExpanded ? items : items.slice(0, 1);
            const hasMoreItems = items.length > 1;

            const orderDate = order.createdAt?.toDate
              ? order.createdAt.toDate().toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true
                })
              : 'Recent';

            return (
              <div
                key={order.id}
                className={`bg-neutral-900/40 backdrop-blur-xl border rounded-3xl overflow-hidden shadow-xl hover:border-neutral-700/60 transition-all duration-300 ${
                  (order.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.PACKED
                    ? 'border-green-900/40'
                    : 'border-neutral-800'
                }`}
              >
                {/* Card Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-neutral-950/60 border-b border-neutral-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[10px] font-mono font-bold text-yellow-500 bg-yellow-500/5 border border-yellow-500/15 px-2 py-0.5 rounded">
                        #{order.id.slice(-8).toUpperCase()}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(order.id);
                          toast.success("Order ID copied!");
                        }}
                        className="text-neutral-500 hover:text-white transition-colors"
                        title="Copy Full ID"
                      >
                        <Copy size={12} />
                      </button>
                      <span className="text-neutral-700 text-xs">•</span>
                      <span className="text-[10px] text-neutral-400 font-semibold flex items-center gap-1">
                        <Calendar size={11} />
                        {orderDate}
                      </span>
                      {/* Packing Status Badge */}
                      {(order.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.PACKED ? (
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                          <PackageCheck size={9} /> Packed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                          <PackageOpen size={9} /> Not Packed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Payment Status Dropdown */}
                    <label htmlFor={`payment-status-${order.id}`} className="sr-only">Payment Status</label>
                    <select
                      id={`payment-status-${order.id}`}
                      name="paymentStatus"
                      value={order.paymentStatus || 'Pending'}
                      onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                      className={`text-[8px] rounded px-2 py-1 font-black uppercase tracking-wider border transition-all outline-none bg-neutral-950 ${
                        (order.paymentStatus || 'Pending').toLowerCase() === 'paid'
                          ? 'text-green-500 border-green-500/20 bg-green-500/5'
                          : 'text-amber-500 border-amber-500/20 bg-amber-500/5'
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                    </select>

                    {/* Order Fulfillment Dropdown */}
                    <label htmlFor={`order-status-${order.id}`} className="sr-only">Order Fulfillment Status</label>
                    <select
                      id={`order-status-${order.id}`}
                      name="orderStatus"
                      value={order.status || 'ordered'}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`text-[8px] rounded px-2 py-1 font-black uppercase tracking-wider border transition-all outline-none bg-neutral-950 ${getStatusStyle(order.status)}`}
                    >
                      {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Card Main Columns */}
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {/* Left Column: Customer & Delivery Address Details */}
                  <div className="space-y-4 text-left">
                    <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                      <MapPin size={12} className="text-yellow-500" />
                      Recipient & Destination
                    </h3>

                    <div className="bg-neutral-950/50 p-4 rounded-2xl border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed font-sans relative group whitespace-pre-line">
                      <div className="space-y-0.5">
                        <p className="font-black text-white text-sm uppercase tracking-wide">{customer.name}</p>
                        <p className="font-bold text-yellow-500/90 flex items-center gap-2">
                          <span>
                            {revealedPhones[order.id] ? customer.phone : maskPhone(customer.phone)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleRevealPhone(order.id)}
                            className="p-1 hover:text-white transition-colors"
                            title={revealedPhones[order.id] ? "Mask Phone" : "Reveal Phone"}
                          >
                            {revealedPhones[order.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </p>
                        <p className="text-neutral-450 font-medium">{customer.email || 'No email provided'}</p>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-neutral-850 space-y-0.5 font-medium text-neutral-300">
                        <p className="text-neutral-200">{customer.address}</p>
                        {customer.landmark && (
                          <p className="text-neutral-300">{customer.landmark}</p>
                        )}
                        <p className="text-neutral-100 font-bold uppercase tracking-wider text-[10px]">
                          {customer.district}, {customer.state} - {customer.pincode}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-neutral-850 grid grid-cols-2 gap-2 text-[9px] uppercase tracking-wider font-bold">
                        <div>
                          <span className="text-neutral-550 block text-[8px] mb-0.5">Payment Method</span>
                          <span className="text-neutral-200">{order.paymentMethod || 'COD'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-550 block text-[8px] mb-0.5">Payment Status</span>
                          <span className={(order.paymentStatus || 'Pending').toLowerCase() === 'paid' ? 'text-green-500' : 'text-amber-500'}>
                            {order.paymentStatus || 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Items details (Expandable/Collapsible) */}
                  <div className="space-y-4 text-left">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                        <ShoppingBag size={12} className="text-yellow-500" />
                        Ordered Products ({items.reduce((acc, i) => acc + i.quantity, 0)} items)
                      </h3>
                    </div>

                    <div className="space-y-2.5">
                      {itemsToShow.map((item, idx) => (
                        <div
                          key={item.id || item.productId || `order-item-${idx}`}
                          className="flex items-center gap-3 p-3 bg-neutral-950/40 rounded-xl border border-neutral-800/60"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 flex-shrink-0">
                            {item.image ? (
                              <img
                                src={getOptimizedImage(item.image, 'thumbnail')}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                <ShoppingBag size={18} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white uppercase tracking-wider break-words whitespace-normal">{item.name}</p>
                            <div className="text-[9px] text-neutral-400 uppercase tracking-wide mt-0.5 space-y-0.5 font-bold">
                              {item.color && (
                                <div>Color: <strong className="text-neutral-200">{typeof item.color === 'object' ? item.color.name : item.color}</strong></div>
                              )}
                              {item.size && (
                                <div>Size: <strong className="text-neutral-200">{item.size}</strong></div>
                              )}
                              <div>Qty: <strong className="text-neutral-200">{item.quantity}</strong></div>
                            </div>
                            <p className="text-[10px] text-yellow-500 font-bold mt-1.5">
                              ₹{item.price.toLocaleString()} × {item.quantity} = ₹{item.total.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}

                      {hasMoreItems && (
                        <button
                          type="button"
                          onClick={() => toggleItems(order.id)}
                          className="flex items-center gap-1 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors mt-2"
                        >
                          {isExpanded ? (
                            <>Collapse Items <ChevronUp size={11} /></>
                          ) : (
                            <>Show {items.length - 1} More Item{items.length - 1 > 1 ? 's' : ''} <ChevronDown size={11} /></>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Card Bottom Footer: Summary & Actions */}
                  <div className="px-4 py-4 sm:px-6 sm:py-5 bg-neutral-950/30 border-t border-neutral-800/80 flex flex-col items-start gap-4 w-full">
                  {/* Expanded Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-[8px] md:text-[9px] uppercase tracking-wider font-bold w-full border-b border-neutral-800/50 pb-4">
                    <div>
                      <span className="text-neutral-550 block mb-0.5">Order ID</span>
                      <span className="text-neutral-200 font-mono font-bold text-[10px] truncate block max-w-[80px]" title={order.id}>#{order.id.slice(-8).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-neutral-550 block mb-0.5">Placed On</span>
                      <span className="text-neutral-200 text-[10px] block">{orderDate}</span>
                    </div>
                    <div>
                      <span className="text-neutral-550 block mb-0.5">Items Count</span>
                      <span className="text-neutral-200 text-[10px] block">{items.reduce((acc, i) => acc + i.quantity, 0)} Items</span>
                    </div>
                    <div>
                      <span className="text-neutral-550 block mb-0.5">Est. Delivery</span>
                      <span className="text-yellow-500 text-[10px] block">{order.estimatedDeliveryDays ? `${order.estimatedDeliveryDays} days` : 'Standard'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-550 block mb-0.5">Subtotal</span>
                      <span className="text-neutral-200 text-[10px] block">₹{order.subtotal?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-green-500 block mb-0.5">Coupon Discount</span>
                      <span className="text-green-500 text-[10px] block">- ₹{Number(order.couponDiscount || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-neutral-550 block mb-0.5">Shipping Charge</span>
                      <span className="text-yellow-500 text-[10px] block">₹{order.deliveryCharge?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-orange-500 block mb-0.5">Final Total</span>
                      <span className="text-orange-500 text-xs font-black block">₹{order.totalPrice?.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="grid grid-cols-2 gap-2 w-full text-[9px] font-black uppercase tracking-widest md:flex md:flex-wrap md:items-center md:gap-2 md:text-[8px]">
                    {revealedPhones[order.id] ? (
                      <a
                        href={`tel:${customer.phone}`}
                        className="flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black py-3 rounded-lg transition-colors border border-yellow-500/15 w-full md:w-auto md:px-3.5 md:py-2.5"
                        title="Call Customer"
                      >
                        <Phone size={12} /> Call Customer
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleRevealPhone(order.id)}
                        className="flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black py-3 rounded-lg transition-colors border border-yellow-500/15 w-full md:w-auto md:px-3.5 md:py-2.5"
                        title="Reveal Phone to Call"
                      >
                        <Phone size={12} /> Reveal to Call
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(order.id, customer)}
                      className="flex items-center justify-center gap-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 py-3 rounded-lg transition-colors w-full md:w-auto md:px-3.5 md:py-2.5"
                      title="Copy Address"
                    >
                      <Copy size={12} /> Copy Address
                    </button>
                    <button
                      type="button"
                      onClick={() => generateInvoice(order, { action: 'download' })}
                      className="flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-3 rounded-lg transition-colors border border-neutral-850 w-full md:w-auto md:px-3.5 md:py-2.5"
                      title="Download PDF Invoice"
                    >
                      <Download size={12} /> Download Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(order, 'invoice')}
                      className="flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-3 rounded-lg transition-colors border border-neutral-850 w-full md:w-auto md:px-3.5 md:py-2.5"
                      title="Print Invoice"
                    >
                      <Printer size={12} /> Print Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(order, 'label')}
                      className="flex items-center justify-center gap-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 py-3 rounded-lg transition-colors border border-neutral-800 w-full md:w-auto md:px-3.5 md:py-2.5"
                      title="Print Shipping Label"
                    >
                      <Printer size={12} /> Print Label
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black py-3 rounded-lg transition-all border border-yellow-500/10 w-full md:w-auto md:px-3.5 md:py-2.5"
                      title="View Status History & Timeline"
                    >
                      <History size={12} /> History
                    </button>
                    {/* Mark as Packed Button */}
                    {(order.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.NOT_PACKED ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPacked(order.id)}
                        disabled={!!packingLoading[order.id]}
                        className="flex items-center justify-center gap-1.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white py-3 rounded-lg transition-all border border-orange-500/20 w-full md:w-auto md:px-3.5 md:py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Mark as Packed"
                      >
                        {packingLoading[order.id]
                          ? <Loader2 size={12} className="animate-spin" />
                          : <PackageCheck size={12} />}
                        Mark as Packed
                      </button>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5 bg-green-500/10 text-green-400 py-3 rounded-lg border border-green-500/20 w-full md:w-auto md:px-3.5 md:py-2.5 text-[9px] font-black uppercase tracking-widest">
                        <PackageCheck size={12} /> Packed
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id, false)}
                      className="flex items-center justify-center gap-1.5 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white py-3 rounded-lg transition-all border border-red-500/10 w-full col-span-2 md:col-span-1 md:w-auto md:px-3.5 md:py-2.5 md:ml-auto"
                      title="Delete Order"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>         </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upgraded Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="bg-gray-900 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-scaleIn flex flex-col md:flex-row max-h-[90vh] border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column: Details & Items */}
            <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto border-b md:border-b-0 md:border-r border-neutral-800/60 text-left">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-widest">Order Details</h2>
                  <p className="text-[9px] font-mono text-neutral-500 mt-1">ID: {selectedOrder.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(selectedOrder.id, true)}
                    className="p-2 bg-red-600/10 text-red-500 rounded-full hover:bg-red-600 hover:text-white border border-red-500/15 transition-all"
                    title="Delete Order"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="p-2 bg-neutral-950 rounded-full text-neutral-400 hover:bg-neutral-800 transition-colors border border-neutral-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Recipient Details & Financial Summary */}
              {(() => {
                const customer = parseCustomerDetails(selectedOrder);
                const orderItems = parseOrderedItems(selectedOrder);
                const orderDate = selectedOrder.createdAt?.toDate
                  ? selectedOrder.createdAt.toDate().toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: true
                    })
                  : 'Recent';

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Recipient Details */}
                      <div className="space-y-2.5">
                        <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Shipping Destination</h3>
                        <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/80 text-xs leading-relaxed text-neutral-300 whitespace-pre-line">
                          <div className="space-y-0.5">
                            <p className="font-black text-white text-sm uppercase tracking-wide">{customer.name}</p>
                            <p className="font-bold text-yellow-500 flex items-center gap-2">
                              <span>
                                {revealedPhones[selectedOrder.id] ? customer.phone : maskPhone(customer.phone)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleRevealPhone(selectedOrder.id)}
                                className="p-1 hover:text-white transition-colors"
                                title={revealedPhones[selectedOrder.id] ? "Mask Phone" : "Reveal Phone"}
                              >
                                {revealedPhones[selectedOrder.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </p>
                            <p className="text-neutral-450 font-medium">{customer.email || 'No email provided'}</p>
                          </div>
                          
                          <div className="border-t border-neutral-850 pt-3 mt-3 space-y-0.5 font-medium text-neutral-300">
                            <p className="text-neutral-200">{customer.address}</p>
                            {customer.landmark && <p className="text-neutral-200">{customer.landmark}</p>}
                            <p className="text-neutral-100 font-bold uppercase tracking-wider text-[10px]">
                              {customer.district}, {customer.state} - {customer.pincode}
                            </p>
                          </div>

                          <div className="border-t border-neutral-850 pt-3 mt-3 grid grid-cols-2 gap-2 text-[9px] uppercase tracking-wider font-bold">
                            <div>
                              <span className="text-neutral-550 block text-[8px] mb-0.5">Payment Method</span>
                              <span className="text-neutral-200">{selectedOrder.paymentMethod || 'COD'}</span>
                            </div>
                            <div>
                              <span className="text-neutral-550 block text-[8px] mb-0.5">Payment Status</span>
                              <span className={(selectedOrder.paymentStatus || 'Pending').toLowerCase() === 'paid' ? 'text-green-500' : 'text-amber-500'}>
                                {selectedOrder.paymentStatus || 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary details */}
                      <div className="space-y-2.5">
                        <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Order Summary</h3>
                        <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/80 space-y-2 text-xs uppercase tracking-wider font-bold">
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Placed On</span>
                            <span className="text-white normal-case">{orderDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Total Items</span>
                            <span className="text-white">{orderItems.reduce((acc, i) => acc + i.quantity, 0)} Items</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Est. Delivery</span>
                            <span className="text-yellow-500">{selectedOrder.estimatedDeliveryDays ? `${selectedOrder.estimatedDeliveryDays} days` : 'Standard'}</span>
                          </div>
                          <div className="border-t border-neutral-850/60 pt-2 mt-2 flex justify-between">
                            <span className="text-neutral-550">Subtotal</span>
                            <span className="text-neutral-200">₹{selectedOrder.subtotal?.toLocaleString()}</span>
                          </div>
                          {Number(selectedOrder.couponDiscount || 0) > 0 && (
                            <div className="flex justify-between text-green-500">
                              <span>Discount ({selectedOrder.couponCode})</span>
                              <span>- ₹{Number(selectedOrder.couponDiscount).toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-neutral-550">Shipping</span>
                            <span className="text-yellow-500">₹{selectedOrder.deliveryCharge?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-black text-orange-500 pt-2 border-t border-neutral-850 mt-2 text-sm">
                            <span>Total Amount</span>
                            <span>₹{selectedOrder.totalPrice?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick actions row */}
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-widest border-t border-neutral-850 pt-4 w-full md:flex md:flex-wrap md:items-center md:gap-2 md:text-[8px]">
                      {revealedPhones[selectedOrder.id] ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black py-3 rounded-lg transition-colors border border-yellow-500/15 w-full md:w-auto md:px-3.5 md:py-2.5"
                          title="Call Customer"
                        >
                          <Phone size={12} /> Call Customer
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleRevealPhone(selectedOrder.id)}
                          className="flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black py-3 rounded-lg transition-colors border border-yellow-500/15 w-full md:w-auto md:px-3.5 md:py-2.5"
                          title="Reveal Phone to Call"
                        >
                          <Phone size={12} /> Reveal to Call
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(selectedOrder.id, customer)}
                        className="flex items-center justify-center gap-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 py-3 rounded-lg transition-colors w-full md:w-auto md:px-3.5 md:py-2.5"
                        title="Copy Address"
                      >
                        <Copy size={12} /> Copy Address
                      </button>
                      <button
                        type="button"
                        onClick={() => generateInvoice(selectedOrder, { action: 'download' })}
                        className="flex items-center justify-center gap-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white py-3 rounded-lg border border-neutral-800 w-full md:w-auto md:px-3.5 md:py-2.5"
                        title="Download PDF Invoice"
                      >
                        <Download size={12} /> Download Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrint(selectedOrder, 'invoice')}
                        className="flex items-center justify-center gap-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 py-3 rounded-lg border border-neutral-800 w-full md:w-auto md:px-3.5 md:py-2.5"
                        title="Print Invoice"
                      >
                        <Printer size={12} /> Print Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrint(selectedOrder, 'label')}
                        className="flex items-center justify-center gap-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 py-3 rounded-lg transition-colors border border-neutral-800 w-full col-span-2 md:col-span-1 md:w-auto md:px-3.5 md:py-2.5"
                        title="Print Shipping Label"
                      >
                        <Printer size={12} /> Print Label
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Packing Info Panel inside Modal */}
              <div className="mt-6 p-4 rounded-2xl border bg-neutral-950/60 border-neutral-800 space-y-3">
                <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Package size={12} className="text-yellow-500" /> Packing Status
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {(selectedOrder.packingStatus || PACKING_STATUS.NOT_PACKED) === PACKING_STATUS.PACKED ? (
                    <>
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-full">
                        <PackageCheck size={11} /> Packed
                      </span>
                      {selectedOrder.packedAt && (
                        <span className="text-[9px] text-neutral-400 font-bold">
                          Packed at: {typeof selectedOrder.packedAt === 'string'
                            ? new Date(selectedOrder.packedAt).toLocaleString('en-IN')
                            : selectedOrder.packedAt?.toDate?.().toLocaleString('en-IN') || '—'}
                        </span>
                      )}
                      {selectedOrder.packedBy && (
                        <span className="text-[9px] text-neutral-400 font-bold">
                          by {selectedOrder.packedBy}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1.5 rounded-full">
                        <PackageOpen size={11} /> Not Packed
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMarkPacked(selectedOrder.id)}
                        disabled={!!packingLoading[selectedOrder.id]}
                        className="flex items-center gap-1.5 bg-orange-500 text-white hover:bg-orange-400 font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {packingLoading[selectedOrder.id]
                          ? <Loader2 size={11} className="animate-spin" />
                          : <PackageCheck size={11} />}
                        Mark as Packed
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Items List */}
              <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-1.5">
                <ShoppingBag size={13} className="text-yellow-500" />
                Ordered Products
              </h3>
              <div className="space-y-2.5">
                {parseOrderedItems(selectedOrder).map((item, idx) => (
                  <div key={item.id || item.productId || `modal-item-${idx}`} className="flex items-center gap-4 p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-neutral-800 flex-shrink-0 bg-neutral-900">
                      {item.image ? (
                        <img
                          src={getOptimizedImage(item.image, 'thumbnail')}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-700">
                          <ShoppingBag size={18} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white uppercase tracking-wider break-words whitespace-normal">{item.name}</p>
                      <div className="text-[9px] text-neutral-455 uppercase tracking-wide mt-0.5 space-y-0.5 font-bold">
                        {item.color && (
                          <div>Color: <strong className="text-neutral-200">{typeof item.color === 'object' ? item.color.name : item.color}</strong></div>
                        )}
                        {item.size && (
                          <div>Size: <strong className="text-neutral-200">{item.size}</strong></div>
                        )}
                        <div>Qty: <strong className="text-neutral-200">{item.quantity}</strong></div>
                      </div>
                      <p className="text-[10px] text-yellow-500 font-bold mt-1.5">
                        ₹{item.price.toLocaleString()} × {item.quantity} = ₹{item.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Status Timeline */}
            <div className="w-full md:w-80 bg-slate-950/40 p-4 sm:p-6 md:p-8 overflow-y-auto border-t md:border-t-0 border-neutral-800 flex flex-col justify-between">
              <div>
                <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-6">Fulfillment Log</h3>
                <div className="space-y-6 relative text-left">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-neutral-800" />
                  {[...(selectedOrder.statusHistory ?? [])].reverse().map((h, i) => (
                    <div key={`history-${h.status}-${h.timestamp || i}`} className="relative pl-8">
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-neutral-900 shadow-sm flex items-center justify-center ${i === 0 ? 'bg-yellow-500 scale-110' : 'bg-neutral-800'}`}>
                        {h.status === 'delivered'
                          ? <CheckCircle size={10} className="text-neutral-950" />
                          : <Clock size={10} className={i === 0 ? 'text-neutral-950' : 'text-neutral-400'} />}
                      </div>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${i === 0 ? 'text-yellow-500' : 'text-neutral-200'}`}>{h.status}</p>
                      <p className="text-[8px] text-neutral-500 font-bold mt-0.5">{new Date(h.timestamp).toLocaleString()}</p>
                      <p className="text-[8px] text-neutral-400 mt-1 italic leading-relaxed">{h.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-neutral-800/80">
                <h4 className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-3 text-left">Fulfill Step</h4>
                {(() => {
                  const nextStatus = getNextStatus(selectedOrder.status);
                  return nextStatus ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder.id, nextStatus)}
                      className="w-full py-3 bg-yellow-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-md shadow-yellow-600/10 hover:bg-yellow-500 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Truck size={13} /> Mark as {nextStatus}
                    </button>
                  ) : (
                    <div className="py-3 bg-green-500/10 border border-green-500/20 text-green-500 font-black uppercase tracking-widest text-[9px] rounded-xl text-center">
                      Fulfillment Complete
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printing Loading Overlay */}
      {isPrinting && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center text-white no-print">
          <Loader2 size={48} className="animate-spin text-yellow-500 mb-4" />
          <h3 className="text-xl font-black uppercase tracking-widest">
            {printData?.type === 'invoice' ? "Generating Invoice..." : "Generating Shipping Label..."}
          </h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Preparing printable document view</p>
        </div>
      )}

      {/* Hidden Print Container */}
      {printData && (
        <div id="print-area" className="hidden print:block bg-white text-black min-h-screen">
          {printData.type === 'invoice' ? (
            <InvoicePrintView order={printData.order} />
          ) : (
            <LabelPrintView order={printData.order} />
          )}
        </div>
      )}
    </div>
  );
};

export default OrdersManage;