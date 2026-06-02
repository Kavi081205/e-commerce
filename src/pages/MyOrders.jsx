import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
// fix #5: merged duplicate lucide-react imports
import { Loader2, PackageSearch, ShoppingBag, Clock, CheckCircle, Truck, Package, ChevronDown, Download } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { OrderSkeleton } from '../components/Skeleton'; // fix #7: now actually used
import { generateInvoice } from '../utils/invoiceGenerator';
import OrderTracker from '../components/OrderTracker';
import { getOptimizedImage } from '../utils/cloudinary';

const ORDERS_PER_PAGE = 3;

const STATUS_CONFIG = {
  ordered: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  processing: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  shipped: { color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  delivered: { color: 'bg-green-500/10 text-green-500 border-green-500/20' },
};

const MyOrders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // fix #4: wrap in useCallback to stabilise reference for useEffect dependency
  const fetchOrders = useCallback(async (isLoadMore = false) => {
    if (!currentUser?.uid) return;

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let q = query(
        collection(db, 'orders'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(ORDERS_PER_PAGE)
      );

      if (isLoadMore && lastDoc) {
        q = query(
          collection(db, 'orders'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
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

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === ORDERS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser, lastDoc]);

  useEffect(() => {
    fetchOrders();
  }, [currentUser]);  // intentionally only re-fetch on user change, not on lastDoc change

  if (loading) {
    return (
      <div className="bg-black min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
          <PageHeader title="My Orders" breadcrumbs={[{ label: 'My Orders', path: '/my-orders' }]} />
          {/* fix #7: use the imported OrderSkeleton instead of ad-hoc divs */}
          {[...Array(3)].map((_, i) => <OrderSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <PageHeader
          title="My Orders"
          breadcrumbs={[{ label: 'My Orders', path: '/my-orders' }]}
        />

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-gray-900/30 rounded-[3rem] border border-yellow-900/10 text-center shadow-2xl">
            <div className="w-24 h-24 bg-yellow-500/5 text-yellow-500 rounded-full flex items-center justify-center mb-8 border border-yellow-500/20">
              <PackageSearch size={40} strokeWidth={1} />
            </div>
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">No Orders Found</h2>
            <p className="text-gray-600 font-medium mb-12 max-w-sm uppercase text-[10px] tracking-[0.2em]">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
            <Link
              to="/products"
              className="bg-white text-black font-black py-4 px-12 rounded-full transition-all hover:bg-yellow-500 active:scale-95 uppercase tracking-[0.2em] text-[10px]"
            >
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="space-y-12 mt-12">
            {orders.map((order) => {
              // fix #3: guard order.id before slice
              const safeId = order.id || '';
              return (
                <div
                  key={order.id}
                  className="bg-gray-900/30 backdrop-blur-xl rounded-[3rem] border border-yellow-900/10 overflow-hidden group shadow-2xl"
                >
                  {/* Order Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 px-10 py-8 bg-black/40 border-b border-yellow-900/10">
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                      <div>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Reference ID</p>
                        <p className="font-black text-white tracking-widest text-xs uppercase">#{safeId.slice(-8)}</p>
                      </div>
                      <div className="hidden sm:block w-px h-12 bg-yellow-900/10" />
                      <div>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Ordered On</p>
                        <p className="font-black text-gray-400 text-xs uppercase tracking-widest">
                          {order.createdAt?.toDate
                            ? order.createdAt.toDate().toLocaleDateString('en-IN', {
                               day: 'numeric', month: 'short', year: 'numeric'
                             })
                            : 'Recent'}
                        </p>
                      </div>
                      <div className="hidden sm:block w-px h-12 bg-yellow-900/10" />
                      <div>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Payment Method</p>
                        <p className="font-black text-yellow-500 text-xs uppercase tracking-widest">
                          {order.paymentMethod || 'COD'}
                        </p>
                      </div>
                      <div className="hidden sm:block w-px h-12 bg-yellow-900/10" />
                      <div>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Payment Status</p>
                        <p className={`font-black text-xs uppercase tracking-widest ${
                          (order.paymentStatus || 'Pending').toLowerCase() === 'paid' ? 'text-green-500' : 'text-amber-500'
                        }`}>
                          {order.paymentStatus || 'Pending'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Order Total</p>
                        {/* fix #1: guard totalPrice */}
                        <p className="font-black gold-text text-3xl tracking-tighter">₹{(order.totalPrice || 0).toLocaleString()}</p>
                      </div>
                      {/* fix #8: aria-label on icon-only button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); generateInvoice(order); }}
                        aria-label="Download invoice"
                        className="w-14 h-14 bg-white/5 border border-white/5 rounded-2xl text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all flex items-center justify-center shadow-2xl"
                      >
                        <Download size={24} />
                      </button>
                    </div>
                  </div>

                  {/* Status Timeline */}
                  {order.status?.toLowerCase() !== 'cancelled' && (
                    <div className="px-12 py-12 border-b border-white/5 bg-black/20">
                      <OrderTracker currentStatus={order.status || 'ordered'} />
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="px-10 py-10">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                      <ShoppingBag size={14} className="text-yellow-500" />
                      Order Items ({order.items?.length || 0})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-6 p-4 rounded-[2rem] bg-black/40 border border-white/5 hover:border-yellow-500/20 transition-all">
                          <div className="w-16 h-16 bg-gray-900 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5">
                            {item.image && (
                              <img
                                src={getOptimizedImage(item.image, 'thumbnail')}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="font-black text-white truncate text-xs uppercase tracking-widest">{item.name}</p>
                            {item.color && (
                              <p className="text-[9px] text-gray-400 uppercase tracking-wider">
                                Color: <span className="text-white font-bold">{typeof item.color === 'object' ? item.color.name : item.color}</span>
                              </p>
                            )}
                            {item.size && (
                              <p className="text-[9px] text-gray-400 uppercase tracking-wider">
                                Size: <span className="text-white font-bold">{item.size}</span>
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Qty: {item.quantity || 0}</p>
                              {/* fix #2: guard price and quantity before multiplication */}
                              <p className="font-black text-white text-xs">₹{((item.price || 0) * (item.quantity || 0)).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer / Delivery */}
                  {(order.address || order.name) && (
                    <div className="px-10 py-6 bg-black/40 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Package size={16} className="text-gray-700" />
                        <div>
                          <p className="text-[8px] font-black text-gray-700 uppercase tracking-[0.3em] mb-1">Delivery Address</p>
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest truncate max-w-[200px] sm:max-w-md">
                            {order.name} · {order.address}
                          </p>
                        </div>
                      </div>
                      <div className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border ${STATUS_CONFIG[order.status?.toLowerCase()]?.color || 'bg-gray-900 text-gray-500 border-white/5'}`}>
                        {order.status || 'ordered'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-8 pb-20 flex justify-center">
                <button
                  onClick={() => fetchOrders(true)}
                  disabled={loadingMore}
                  className="group flex items-center gap-4 bg-gray-900/30 border border-yellow-900/20 hover:border-yellow-500 text-gray-500 hover:text-yellow-500 font-black px-12 py-5 rounded-full transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.4em] text-[9px]"
                >
                  {loadingMore ? (
                    <><Loader2 size={16} className="animate-spin" /> Loading Orders...</>
                  ) : (
                    <>Load More Orders <ChevronDown size={16} className="group-hover:translate-y-2 transition-transform" /></>
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