import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
// fix #4: removed unused User, Mail, Calendar, Plus imports
import { Package, Settings, LogOut, ChevronRight, ShoppingBag, Clock, CheckCircle, Truck, MapPin, Trash2, Smartphone, Home, Briefcase, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';

const STATUS_CONFIG = {
  ordered: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock, label: 'Order Placed' },
  processing: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: ShoppingBag, label: 'Processing' },
  shipped: { color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', icon: Truck, label: 'Shipped' },
  delivered: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle, label: 'Delivered' },
  unknown: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: Package, label: 'Pending' },
};

const Profile = () => {
  const { currentUser, logout, updateProfile } = useAuth();
  const { showToast } = useNotification();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(currentUser?.displayName || '');
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // fix #3: sync newName if currentUser.displayName updates externally
  useEffect(() => {
    setNewName(currentUser?.displayName || '');
  }, [currentUser?.displayName]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);
    }, (err) => {
      console.error('Error in profile snapshot listener:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({ displayName: newName });
      setEditing(false);
    } catch (error) {
      console.error('Update error', error);
    }
  };

  const handleDeleteAddress = (id) => {
    if ((currentUser.addresses || []).length <= 1) {
      showToast("At least one address is required", "error");
      return;
    }
    setAddressToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!addressToDelete) return;
    setIsDeleting(true);
    const id = addressToDelete;

    if ((currentUser.addresses || []).length <= 1) {
      showToast("At least one address is required", "error");
      setIsDeleting(false);
      setAddressToDelete(null);
      return;
    }

    const updatedAddresses = (currentUser.addresses || []).filter(a => a.id !== id);
    try {
      const nextDefaultId = currentUser?.defaultAddressId === id
        ? (updatedAddresses[0]?.id || null)
        : currentUser?.defaultAddressId;

      await updateProfile({ 
        addresses: updatedAddresses,
        defaultAddressId: nextDefaultId || null
      });
      showToast("Address deleted successfully", "success");
    } catch (error) {
      showToast("Error deleting address", "error");
    } finally {
      setIsDeleting(false);
      setAddressToDelete(null);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PageHeader
            title="My Account"
            breadcrumbs={[{ label: 'My Account', path: '/profile' }]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mt-16">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-10">
              <div className="bg-gray-900/30 backdrop-blur-xl p-10 rounded-[3rem] border border-yellow-900/10 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                  <div className="w-28 h-28 bg-yellow-500 text-black rounded-full flex items-center justify-center text-5xl font-black mb-8 shadow-2xl shadow-yellow-500/20 uppercase">
                    {currentUser.displayName?.[0] || currentUser.email?.[0]}
                  </div>
                  {editing ? (
                    <form onSubmit={handleUpdateName} className="w-full space-y-4">
                      <label htmlFor="profile-name" className="sr-only">Display Name</label>
                      <input
                        id="profile-name"
                        name="newName"
                        autoComplete="name"
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-black/50 border border-yellow-900/20 rounded-2xl py-4 px-6 text-center text-white focus:border-yellow-500 outline-none font-black uppercase tracking-widest text-xs"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-yellow-500 text-black py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em]">Update</button>
                        <button type="button" onClick={() => setEditing(false)} className="px-4 bg-gray-900 text-white py-3 rounded-xl text-[9px] font-black uppercase">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">{currentUser.displayName}</h2>
                      <p className="text-gray-600 font-bold text-[10px] uppercase tracking-widest">{currentUser.email}</p>
                      <button
                        onClick={() => setEditing(true)}
                        className="mt-8 flex items-center gap-3 text-yellow-500/60 font-black text-[9px] uppercase tracking-[0.3em] hover:text-yellow-500 transition-all"
                      >
                        <Settings size={14} /> Update Credentials
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-12 pt-12 border-t border-yellow-900/10 space-y-4">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all ${activeTab === 'orders' ? 'bg-yellow-500 text-black shadow-2xl shadow-yellow-500/10' : 'hover:bg-white/5 text-gray-500'}`}
                  >
                    <div className="flex items-center gap-4">
                      <ShoppingBag size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">My Orders</span>
                    </div>
                    <span className="text-[9px] font-black">{orders.length}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('addresses')}
                    className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all ${activeTab === 'addresses' ? 'bg-yellow-500 text-black shadow-2xl shadow-yellow-500/10' : 'hover:bg-white/5 text-gray-500'}`}
                  >
                    <div className="flex items-center gap-4">
                      <MapPin size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Saved Addresses</span>
                    </div>
                    <span className="text-[9px] font-black">{currentUser.addresses?.length || 0}</span>
                  </button>
                </div>

                <button
                  onClick={logout}
                  className="mt-12 w-full flex items-center justify-center gap-3 text-red-500 font-black text-[9px] uppercase tracking-[0.4em] py-5 rounded-2xl bg-red-500/5 hover:bg-red-500/10 transition-all border border-red-500/10"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {activeTab === 'orders' ? (
                  <motion.div
                    key="orders"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-gray-900/30 backdrop-blur-xl p-12 rounded-[3rem] border border-yellow-900/10 shadow-2xl min-h-[600px]"
                  >
                    <div className="flex items-center justify-between mb-16">
                      <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.6em]">Recent Orders</p>
                      <Link to="/my-orders" className="text-white text-[9px] font-black uppercase tracking-[0.3em] hover:text-yellow-500 transition-all flex items-center gap-2">
                        View All Orders <ArrowRight size={14} />
                      </Link>
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-yellow-500" size={32} />
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-gray-900/50 rounded-full flex items-center justify-center text-gray-700 mb-8 border border-white/5"><Package size={40} /></div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-4">No Orders Yet</h4>
                        <p className="text-gray-600 font-bold text-[10px] uppercase tracking-widest mb-10">You haven't placed any orders yet.</p>
                        <Link to="/products" className="bg-white text-black font-black px-12 py-4 rounded-full uppercase tracking-[0.2em] text-[10px] hover:bg-yellow-500 transition-all">Explore Collections</Link>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {orders.map((order) => {
                          const status = STATUS_CONFIG[order.status?.toLowerCase()] || STATUS_CONFIG.unknown;
                          const StatusIcon = status.icon;
                          // fix #2: guard order.id before slice
                          const safeId = order.id || '';
                          return (
                            <div key={order.id} className="group p-8 rounded-[2rem] bg-black/40 border border-white/5 hover:border-yellow-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-8">
                              <div className="flex items-center gap-8">
                                <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center text-yellow-500/40 border border-white/5"><Package size={32} /></div>
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Order ID #{safeId.slice(-8).toUpperCase()}</p>
                                  {/* fix #1: guard totalPrice */}
                                  <p className="text-2xl font-black text-white tracking-tight">₹{(order.totalPrice || 0).toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-10">
                                <div className="hidden sm:block text-right">
                                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Ordered On</p>
                                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">
                                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Pending'}
                                  </p>
                                </div>
                                <div className={`flex items-center gap-3 px-6 py-3 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] ${status.color}`}>
                                  <StatusIcon size={14} />
                                  {status.label}
                                </div>
                                {/* fix #5: aria-label on icon-only link */}
                                <Link
                                  to="/my-orders"
                                  aria-label={`View order ${safeId.slice(-8).toUpperCase()}`}
                                  className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-600 hover:text-yellow-500 hover:bg-yellow-500/10 transition-all"
                                >
                                  <ChevronRight size={24} />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="addresses"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-gray-900/30 backdrop-blur-xl p-12 rounded-[3rem] border border-yellow-900/10 shadow-2xl min-h-[600px]"
                  >
                    <div className="flex items-center justify-between mb-16">
                      <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.6em]">Saved Addresses</p>
                      <Link to="/checkout" className="bg-white text-black px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:bg-yellow-500 transition-all">
                        Add New Address
                      </Link>
                    </div>

                    {currentUser.addresses?.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {currentUser.addresses.map((addr) => (
                          <div key={addr.id} className="p-8 rounded-[2rem] bg-black/40 border border-white/5 hover:border-yellow-500/30 transition-all group relative">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="p-3 bg-gray-900 rounded-xl text-yellow-500/40 border border-white/5">
                                {addr.type === 'Home' ? <Home size={18} /> : <Briefcase size={18} />}
                              </div>
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">{addr.type} Address</span>
                            </div>
                            <p className="font-black text-white text-lg uppercase tracking-tight mb-2">{addr.name}</p>
                            <p className="text-xs text-gray-500 font-bold leading-relaxed uppercase tracking-widest">{addr.address}, {addr.city} - {addr.pincode}</p>
                            <p className="text-[10px] font-black text-yellow-500/60 mt-6 flex items-center gap-3 uppercase tracking-widest"><Smartphone size={14} /> {addr.phone}</p>

                            {/* fix #5: aria-label on icon-only button */}
                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              aria-label={`Delete ${addr.name} address`}
                              className="absolute top-8 right-8 p-2 text-gray-800 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-gray-900/50 rounded-full flex items-center justify-center text-gray-700 mb-8 border border-white/5"><MapPin size={40} /></div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-4">No saved addresses found</h4>
                        <p className="text-gray-600 font-bold text-[10px] uppercase tracking-widest mb-8">Save your delivery addresses for faster checkout.</p>
                        <Link
                          to="/checkout"
                          className="bg-yellow-500 text-black px-8 py-3.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:bg-yellow-600 transition-all active:scale-95 shadow-lg shadow-yellow-500/10"
                        >
                          Add New Address
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {addressToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-yellow-900/30 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl space-y-8 text-center"
            >
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <Trash2 size={28} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Confirm Deletion</h3>
                <p className="text-xs text-gray-400 font-bold leading-relaxed uppercase tracking-widest">
                  Are you sure you want to delete this address?
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setAddressToDelete(null)}
                  className="flex-1 py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;