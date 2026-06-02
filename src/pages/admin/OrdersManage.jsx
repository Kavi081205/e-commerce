import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import {
  collection, onSnapshot, updateDoc, doc, deleteDoc,
  query, orderBy, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import {
  Eye, Search, Loader2, CheckCircle, Clock,
  MapPin, Phone, ShoppingBag, X, Download, History,
  Truck, Package, FileSpreadsheet, Printer, Trash2
} from 'lucide-react';
import { generateInvoice, printLabel } from '../../utils/invoiceGenerator';
import { exportOrdersToExcel } from '../../utils/excelExport';
import { getOptimizedImage } from '../../utils/cloudinary';

const STATUS_FLOW = ['ordered', 'processing', 'shipped', 'delivered'];

// ✅ Confirmation modal — replaces window.confirm/alert (non-blocking, mobile-safe)
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
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
          className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

const OrdersManage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null); // ✅ Store ID only, not snapshot
  const [confirmDelete, setConfirmDelete] = useState(null);     // ✅ { id, closeModal }

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Derive selectedOrder from live orders array — always in sync
  const selectedOrder = orders.find(o => o.id === selectedOrderId) ?? null;

  const handleStatusChange = useCallback(async (id, newStatus) => {
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
      // No local state update needed — onSnapshot keeps orders in sync
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }, []);

  const handlePaymentStatusChange = useCallback(async (id, newPaymentStatus) => {
    try {
      await updateDoc(doc(db, 'orders', id), {
        paymentStatus: newPaymentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating payment status:", error);
    }
  }, []);

  const handleDeleteOrder = useCallback((id, closeModal = false) => {
    // ✅ Show non-blocking confirm dialog instead of window.confirm
    setConfirmDelete({ id, closeModal });
  }, []);

  const confirmDeleteOrder = async () => {
    const { id, closeModal } = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteDoc(doc(db, 'orders', id));
      if (closeModal) setSelectedOrderId(null);
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  const getNextStatus = (current) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
      case 'shipped': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'processing': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'ordered': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-800 text-gray-700 border-yellow-900/20';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customerName || order.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="animate-fadeIn">
      {/* ✅ Non-blocking delete confirmation dialog */}
      {confirmDelete && (
        <ConfirmDialog
          message="Are you sure you want to delete this order? This cannot be undone."
          onConfirm={confirmDeleteOrder}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Order Management</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Logistics control and status tracking</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-gray-900 p-1 rounded-2xl border border-yellow-900/10 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2 border-r border-yellow-900/10">
              <Clock size={16} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-700">
                {orders.filter(o => o.status === 'ordered').length} New
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-sm font-bold text-gray-700">
                {orders.filter(o => o.status === 'delivered').length} Completed
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportOrdersToExcel(orders)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-green-600/20 transition-all active:scale-95"
          >
            <FileSpreadsheet size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/40 border border-yellow-900/10 overflow-hidden">
        {/* Filters */}
        <div className="p-6 border-b border-yellow-900/10 bg-slate-950/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full">
            <label htmlFor="order-search" className="sr-only">Search Orders</label>
            <input
              type="text"
              id="order-search"
              name="orderSearch"
              autoComplete="off"
              placeholder="Search by ID or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-yellow-900/20 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none transition-all text-sm font-medium"
            />
            <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-gray-400 text-[10px] uppercase tracking-widest border-b border-yellow-900/10">
                <th className="px-6 py-5 font-black">Order ID</th>
                <th className="px-6 py-5 font-black">Customer Name</th>
                <th className="px-6 py-5 font-black">Amount</th>
                <th className="px-6 py-5 font-black">Payment Method</th>
                <th className="px-6 py-5 font-black">Payment Status</th>
                <th className="px-6 py-5 font-black">Order Status</th>
                <th className="px-6 py-5 font-black">Date</th>
                <th className="px-6 py-5 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-8 py-20 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-yellow-500" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Loading...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-8 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    No orders matching criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-950/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-black text-white text-sm tracking-tight uppercase">
                        #{order.id.slice(-6)}
                      </div>
                    </td>
                     <td className="px-6 py-5">
                      <div className="font-bold text-white">{order.customerName || order.name || 'Guest'}</div>
                      <div className="text-gray-500 text-[10px] mt-1 font-medium leading-relaxed">
                        {order.city} · {order.pincode} {order.deliveryZone && `(${order.deliveryZone})`}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-black text-white text-base">₹{(order.totalPrice || 0).toLocaleString()}</div>
                      <div className="text-gray-500 text-[10px] mt-1 font-medium">
                        Shipping: ₹{(order.deliveryCharge || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                        (order.paymentMethod || 'COD').toUpperCase() === 'ONLINE'
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
                      }`}>
                        {order.paymentMethod || 'COD'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <label htmlFor={`payment-status-${order.id}`} className="sr-only">Update Payment Status</label>
                      <select
                        id={`payment-status-${order.id}`}
                        name={`paymentStatus-${order.id}`}
                        value={order.paymentStatus || 'Pending'}
                        onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                        className={`text-[10px] rounded-lg px-2.5 py-1.5 font-black uppercase tracking-widest border transition-all outline-none bg-[#0a0a0a] ${
                          (order.paymentStatus || 'Pending').toLowerCase() === 'paid'
                            ? 'text-green-500 border-green-500/20 bg-green-500/5'
                            : 'text-amber-500 border-amber-500/20 bg-amber-500/5'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <label htmlFor={`order-status-${order.id}`} className="sr-only">Update Order Status</label>
                      <select
                        id={`order-status-${order.id}`}
                        name={`status-${order.id}`}
                        value={order.status || 'ordered'}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`text-[10px] rounded-lg px-2.5 py-1.5 font-black uppercase tracking-widest border transition-all outline-none bg-[#0a0a0a] ${getStatusStyle(order.status)}`}
                      >
                        {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-5 text-gray-400 text-xs font-black uppercase tracking-wider">
                      {order.createdAt?.toDate
                        ? order.createdAt.toDate().toLocaleDateString('en-IN')
                        : 'Just now'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); generateInvoice(order); }}
                          className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-lg transition-all"
                          title="Download Invoice"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => printLabel(order)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Print Label"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-lg transition-all"
                          title="View History"
                        >
                          <History size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id, false)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Order"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block lg:hidden divide-y divide-yellow-900/10">
          {loading ? (
            <div className="px-6 py-20 text-center text-gray-400">
              <Loader2 size={32} className="animate-spin mx-auto mb-2 text-yellow-500" />
              <p className="font-bold uppercase tracking-widest text-[10px]">Loading...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              No orders matching criteria.
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="p-6 flex flex-col gap-4 hover:bg-slate-950/40 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-black text-white text-sm tracking-tight uppercase">
                      #{order.id.slice(-6)}
                    </span>
                    <span className="ml-2 text-[10px] text-gray-400 font-black uppercase tracking-wider">
                      {order.createdAt?.toDate
                        ? order.createdAt.toDate().toLocaleDateString('en-IN')
                        : 'Just now'}
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                    (order.paymentMethod || 'COD').toUpperCase() === 'ONLINE'
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
                  }`}>
                    {order.paymentMethod || 'COD'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Customer</p>
                    <p className="font-bold text-white text-sm">{order.customerName || order.name || 'Guest'}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5 leading-tight">
                      {order.city} · {order.pincode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Amount</p>
                    <p className="font-black text-white text-base">₹{(order.totalPrice || 0).toLocaleString()}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Shipping: ₹{(order.deliveryCharge || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Payment Status</p>
                    <label htmlFor={`payment-status-mob-${order.id}`} className="sr-only">Update Payment Status Mobile</label>
                    <select
                      id={`payment-status-mob-${order.id}`}
                      name={`paymentStatus-mob-${order.id}`}
                      value={order.paymentStatus || 'Pending'}
                      onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                      className={`text-[10px] rounded-lg px-2.5 py-1.5 font-black uppercase tracking-widest border transition-all outline-none bg-[#0a0a0a] w-full ${
                        (order.paymentStatus || 'Pending').toLowerCase() === 'paid'
                          ? 'text-green-500 border-green-500/20 bg-green-500/5'
                          : 'text-amber-500 border-amber-500/20 bg-amber-500/5'
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Order Status</p>
                    <label htmlFor={`order-status-mob-${order.id}`} className="sr-only">Update Order Status Mobile</label>
                    <select
                      id={`order-status-mob-${order.id}`}
                      name={`status-mob-${order.id}`}
                      value={order.status || 'ordered'}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`text-[10px] rounded-lg px-2.5 py-1.5 font-black uppercase tracking-widest border transition-all outline-none bg-[#0a0a0a] w-full ${getStatusStyle(order.status)}`}
                    >
                      {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Actions</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); generateInvoice(order); }}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-xl transition-all border border-yellow-900/10"
                      title="Download Invoice"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => printLabel(order)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-yellow-900/10"
                      title="Print Label"
                    >
                      <Printer size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-xl transition-all border border-yellow-900/10"
                      title="View History"
                    >
                      <History size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id, false)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-yellow-900/10"
                      title="Delete Order"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="bg-gray-900 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-scaleIn flex flex-col md:flex-row max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Details & Items */}
            <div className="flex-1 p-8 overflow-y-auto border-r border-yellow-900/10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Order Review</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(selectedOrder.id, true)}
                    className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
                    title="Delete Order"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="p-2 bg-slate-950 rounded-full text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Shipping To</h3>
                  <p className="font-black text-white">{selectedOrder.customerName || selectedOrder.name}</p>
                  <p className="text-sm text-gray-500 leading-relaxed mt-1">{selectedOrder.address}</p>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed uppercase tracking-wider mt-2">
                    Pincode: <span className="text-white font-bold">{selectedOrder.pincode}</span>
                  </p>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed uppercase tracking-wider mt-0.5">
                    Zone: <span className="text-yellow-500 font-bold">{selectedOrder.deliveryZone || 'Standard Zone'}</span>
                  </p>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed uppercase tracking-wider mt-0.5">
                    Est. Delivery: <span className="text-gray-300 font-bold">{selectedOrder.estimatedDeliveryDays || 'N/A'}</span>
                  </p>
                  <p className="text-sm font-bold text-white mt-3">{selectedOrder.phone}</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Summary</h3>
                  <div className="space-y-2 text-xs uppercase tracking-wider font-bold">
                    <div className="flex justify-between"><span>Subtotal</span><span className="text-white">₹{selectedOrder.subtotal}</span></div>
                    <div className="flex justify-between"><span>Shipping Charge</span><span className="text-yellow-500">₹{selectedOrder.deliveryCharge}</span></div>
                    <div className="flex justify-between font-black text-orange-500 pt-3 border-t border-yellow-900/10 mt-3 text-sm">
                      <span>Total Value</span><span>₹{selectedOrder.totalPrice}</span>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <ShoppingBag size={14} className="text-yellow-500" /> Items
              </h3>
              <div className="space-y-3 mb-10">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-950 rounded-2xl border border-yellow-900/10">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-yellow-900/20 flex-shrink-0">
                      {/* ✅ Descriptive alt text for product images */}
                        <img
                          src={getOptimizedImage(item.image, 'thumbnail')}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <div className="flex flex-wrap gap-x-3 text-[10px] text-gray-400 mt-0.5">
                        <span className="font-bold uppercase tracking-widest">Qty: {item.quantity}</span>
                        {item.color && <span>Color: {typeof item.color === 'object' ? item.color.name : item.color}</span>}
                        {item.size && <span>Size: {item.size}</span>}
                      </div>
                    </div>
                    <p className="font-black text-white text-sm">₹{(item.effectivePrice || item.price || 0) * (item.quantity || 1)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Status Timeline */}
            <div className="w-full md:w-80 bg-slate-950/50 p-8 overflow-y-auto">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">Status History</h3>
              <div className="space-y-8 relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
                {/* ✅ [...array].reverse() — shallow copy prevents mutating original */}
                {[...(selectedOrder.statusHistory ?? [])].reverse().map((h, i) => (
                  <div key={i} className="relative pl-10">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${i === 0 ? 'bg-yellow-500 scale-125' : 'bg-gray-300'}`}>
                      {h.status === 'delivered'
                        ? <CheckCircle size={10} className="text-white" />
                        : <Clock size={10} className="text-white" />}
                    </div>
                    <p className="text-xs font-black text-white uppercase tracking-widest">{h.status}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">{new Date(h.timestamp).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 mt-1 italic">{h.message}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-yellow-900/20">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Quick Update</h4>
                {/* ✅ Compute once — avoid calling getNextStatus twice */}
                {(() => {
                  const nextStatus = getNextStatus(selectedOrder.status);
                  return nextStatus ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder.id, nextStatus)}
                      className="w-full py-4 bg-yellow-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-yellow-600/20 hover:bg-yellow-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Truck size={14} /> Mark as {nextStatus}
                    </button>
                  ) : (
                    <div className="py-4 bg-green-50 border border-green-200 text-green-600 font-black uppercase tracking-widest text-[10px] rounded-2xl text-center">
                      Order Fully Delivered
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersManage;