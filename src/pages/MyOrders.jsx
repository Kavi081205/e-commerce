import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Loader2, PackageSearch, ShoppingBag, Clock, CheckCircle2, Truck, Package, ChevronDown, ChevronUp, Download, MapPin, CreditCard } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { OrderSkeleton } from '../components/Skeleton';
import { generateInvoice } from '../utils/invoiceGenerator';
import OrderTracker from '../components/OrderTracker';
import { getOptimizedImage } from '../utils/cloudinary';

const ORDERS_PER_PAGE = 3;

const STATUS_CONFIG = {
  ordered: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Ordered' },
  processing: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Processing' },
  shipped: { color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', label: 'Shipped' },
  delivered: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Delivered' },
  cancelled: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Cancelled' }
};

const MyOrders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});

  const toggleExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const fetchOrders = useCallback(async (isLoadMore = false) => {
    if (!currentUser?.uid) return;

    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      lastDocRef.current = null;
    }

    try {
      let q = query(
        collection(db, 'orders'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(ORDERS_PER_PAGE)
      );

      if (isLoadMore && lastDocRef.current) {
        q = query(
          collection(db, 'orders'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocRef.current),
          limit(ORDERS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(q);
      const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (isLoadMore) {
        setOrders(prev => [...prev, ...newOrders]);
      } else {
        setOrders(newOrders);
      }

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMore(snapshot.docs.length === ORDERS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    fetchOrders();
  }, [currentUser?.uid, fetchOrders]);

  if (loading) {
    return (
      <div className="bg-black min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
          <PageHeader title="My Orders" breadcrumbs={[{ label: 'My Orders', path: '/my-orders' }]} />
          {[...Array(3)].map((_, i) => <OrderSkeleton key={`order-skeleton-${i}`} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-left pb-24 lg:pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <PageHeader
          title="My Orders"
          breadcrumbs={[{ label: 'My Orders', path: '/my-orders' }]}
        />

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 lg:py-32 bg-neutral-900/30 rounded-3xl border border-yellow-900/10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-yellow-500/5 text-yellow-500 rounded-full flex items-center justify-center mb-6 border border-yellow-500/20">
              <PackageSearch size={36} strokeWidth={1} />
            </div>
            <h2 className="text-xl lg:text-2xl font-black text-white mb-3 uppercase tracking-tighter">No Orders Found</h2>
            <p className="text-gray-600 font-medium mb-8 max-w-sm uppercase text-[9px] tracking-[0.2em]">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
            <Link
              to="/products"
              className="bg-white text-black font-black py-3.5 px-10 rounded-full transition-all hover:bg-yellow-500 active:scale-95 uppercase tracking-[0.2em] text-[9px]"
            >
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6 mt-6 lg:mt-8">
            {orders.map((order) => {
              const safeId = order.id || '';
              const isExpanded = !!expandedOrders[order.id];
              const statusKey = (order.status || 'ordered').toLowerCase();
              const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.ordered;
              
              const formattedDate = order.createdAt?.toDate
                ? order.createdAt.toDate().toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })
                : 'Recent';

              return (
                <div
                  key={order.id}
                  className="bg-neutral-900/40 backdrop-blur-xl rounded-xl border border-neutral-800 overflow-hidden shadow-xl hover:border-neutral-700 transition-all duration-300"
                >
                  {/* Order Overview Header */}
                  <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6 bg-neutral-950/60 border-b border-neutral-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] md:text-xs font-black text-neutral-100">
                          {formattedDate}
                        </span>
                        <span className="text-neutral-600 text-xs">•</span>
                        <span className="text-[9px] md:text-[10px] font-mono font-semibold text-neutral-500 tracking-wider">
                          #{safeId.slice(-8).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Total Amount</p>
                      <p className="font-black gold-text text-base md:text-lg tracking-tight">
                        ₹{(order.totalPrice || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Order Items List (Flipkart-style vertical stack) */}
                  <div className="divide-y divide-neutral-800/60 px-4 md:px-6">
                    {order.items?.map((item, idx) => (
                      <div key={item.id || item.productId || `order-item-${idx}`} className="flex items-center gap-4 py-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-neutral-950 rounded-lg overflow-hidden flex-shrink-0 border border-neutral-800">
                          {item.image ? (
                            <img
                              src={getOptimizedImage(item.image, 'thumbnail')}
                              alt={item.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700">
                              <ShoppingBag size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="font-black text-neutral-200 truncate text-[11px] md:text-xs uppercase tracking-wider">
                            {item.name}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] md:text-[9px] text-neutral-400 uppercase tracking-wide">
                            {item.color && (
                              <span>
                                Color: <strong className="text-neutral-200">{typeof item.color === 'object' ? item.color.name : item.color}</strong>
                              </span>
                            )}
                            {item.size && (
                              <span>
                                Size: <strong className="text-neutral-200">{item.size}</strong>
                              </span>
                            )}
                            <span>
                              Qty: <strong className="text-neutral-200">{item.quantity || 0}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-right pl-2">
                          <p className="font-black text-neutral-200 text-xs md:text-sm">
                            ₹{((item.effectivePrice || item.price || 0) * (item.quantity || 0)).toLocaleString()}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-[8px] text-neutral-500 font-medium mt-0.5">
                              (₹{(item.effectivePrice || item.price || 0).toLocaleString()} each)
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Expanded Tracker & Details */}
                  {isExpanded && (
                    <div className="bg-neutral-950/40 border-t border-neutral-800/80 px-4 py-5 md:px-6 md:py-6 space-y-6">
                      {/* Timeline */}
                      {statusKey !== 'cancelled' && (
                        <div className="pb-4 border-b border-neutral-800/60">
                          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Clock size={12} className="text-yellow-500" />
                            Delivery Status Timeline
                          </p>
                          <OrderTracker currentStatus={order.status || 'ordered'} />
                        </div>
                      )}

                      {/* Details Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-[10px] md:text-xs">
                        {/* Delivery Address */}
                        <div className="space-y-2">
                          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin size={12} className="text-yellow-500" />
                            Delivery Destination
                          </p>
                          <div className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800/60 text-neutral-300 space-y-1 font-medium leading-relaxed">
                            <p className="font-bold text-neutral-100 uppercase tracking-wide text-[10px]">{order.name}</p>
                            <p className="text-neutral-400">{order.address}</p>
                          </div>
                        </div>

                        {/* Payment Info & Reference */}
                        <div className="space-y-2">
                          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                            <CreditCard size={12} className="text-yellow-500" />
                            Payment Details
                          </p>
                          <div className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800/60 text-neutral-300 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-500 uppercase text-[9px] tracking-wider">Method</span>
                              <span className="font-bold text-neutral-200 uppercase tracking-wider">{order.paymentMethod || 'COD'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-500 uppercase text-[9px] tracking-wider">Status</span>
                              <span className={`font-bold uppercase tracking-wider ${
                                (order.paymentStatus || 'Pending').toLowerCase() === 'paid' ? 'text-green-500' : 'text-amber-500'
                              }`}>
                                {order.paymentStatus || 'Pending'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-neutral-800/60">
                              <span className="text-neutral-500 uppercase text-[9px] tracking-wider">Order Reference ID</span>
                              <span className="font-mono text-neutral-400 select-all font-semibold uppercase">{safeId}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 bg-neutral-950/40 border-t border-neutral-800/80">
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="flex items-center gap-1.5 text-neutral-400 hover:text-yellow-500 font-black uppercase tracking-wider text-[9px] transition-colors py-1"
                    >
                      {isExpanded ? (
                        <>Hide Details <ChevronUp size={14} /></>
                      ) : (
                        <>Track Order & Details <ChevronDown size={14} /></>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => generateInvoice(order)}
                      aria-label="Download invoice"
                      className="flex items-center gap-1.5 bg-neutral-800 hover:bg-yellow-500 text-neutral-300 hover:text-black font-black uppercase tracking-widest text-[8px] py-2 px-3 md:px-4 rounded transition-all duration-200 shadow-md active:scale-95"
                    >
                      <Download size={12} />
                      Invoice
                    </button>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-4 pb-8 flex justify-center">
                <button
                  onClick={() => fetchOrders(true)}
                  disabled={loadingMore}
                  className="group flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 hover:border-yellow-500 text-neutral-400 hover:text-yellow-500 font-black px-10 py-4 rounded-full transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.4em] text-[8px]"
                >
                  {loadingMore ? (
                    <><Loader2 size={14} className="animate-spin" /> Loading...</>
                  ) : (
                    <>Load More <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" /></>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;