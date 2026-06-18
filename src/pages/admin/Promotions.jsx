import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, setDoc, query, orderBy, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  Zap,
  Layout,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOptimizedImage } from '../../utils/cloudinary';

const Promotions = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [settings, setSettings] = useState({
    bannerProductIds: []
  });

  const [offersList, setOffersList] = useState([]);
  const [newOffer, setNewOffer] = useState({
    title: '',
    productId: '',
    discount: 10,
    offerEndDate: '',
    isActive: true
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all data once (admin page doesn't need real-time updates)
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [productsSnap, promoSnap, offersSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
        getDoc(doc(db, 'promotions', 'main')),
        getDocs(collection(db, 'offers'))
      ]);

      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (promoSnap.exists()) {
        setSettings(prev => ({ ...prev, ...promoSnap.data() }));
      }

      const offersList = offersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      offersList.sort((a, b) => new Date(a.offerEndDate) - new Date(b.offerEndDate));
      setOffersList(offersList);
    } catch (err) {
      console.error('Promotions fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch products, promotions main config, and offers ledger once
  useEffect(() => {
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'promotions', 'main'), settings);
      setMessage({ type: 'success', text: 'Hero banner selection updated successfully!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to update promotions.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddOffer = async (e) => {
    e.preventDefault();
    if (!newOffer.title || !newOffer.productId || !newOffer.offerEndDate) {
      setMessage({ type: 'error', text: 'Please fill in all offer fields.' });
      return;
    }
    // Optimistic: add temp entry immediately
    const tempId = `temp-${Date.now()}`;
    const tempOffer = {
      id: tempId,
      ...newOffer,
      expiryDateTime: newOffer.offerEndDate,
      discount: Number(newOffer.discount || 0),
      createdAt: new Date().toISOString()
    };
    setOffersList(prev => [...prev, tempOffer].sort((a, b) => new Date(a.offerEndDate) - new Date(b.offerEndDate)));
    setNewOffer({ title: '', productId: '', discount: 10, offerEndDate: '', isActive: true });
    try {
      const offerRef = doc(collection(db, 'offers'));
      await setDoc(offerRef, {
        ...newOffer,
        expiryDateTime: newOffer.offerEndDate,
        discount: Number(newOffer.discount || 0),
        createdAt: new Date().toISOString()
      });
      // Replace temp id with real Firestore id
      setOffersList(prev => prev.map(o => o.id === tempId ? { ...o, id: offerRef.id } : o));
      setMessage({ type: 'success', text: 'New offer added successfully!' });
    } catch (err) {
      console.error('Error creating offer:', err);
      setOffersList(prev => prev.filter(o => o.id !== tempId)); // rollback
      setMessage({ type: 'error', text: 'Failed to create offer.' });
    }
  };

  const handleToggleOfferActive = async (id, currentVal) => {
    // Optimistic toggle
    setOffersList(prev => prev.map(o => o.id === id ? { ...o, isActive: !currentVal } : o));
    try {
      await updateDoc(doc(db, 'offers', id), { isActive: !currentVal });
      setMessage({ type: 'success', text: 'Offer status updated!' });
    } catch (err) {
      console.error('Error toggling offer:', err);
      setOffersList(prev => prev.map(o => o.id === id ? { ...o, isActive: currentVal } : o)); // rollback
      setMessage({ type: 'error', text: 'Failed to update status.' });
    }
  };

  const handleDeleteOffer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this offer?')) return;
    // Optimistic: remove immediately
    const removed = offersList.find(o => o.id === id);
    setOffersList(prev => prev.filter(o => o.id !== id));
    try {
      await deleteDoc(doc(db, 'offers', id));
      setMessage({ type: 'success', text: 'Offer deleted successfully!' });
    } catch (err) {
      console.error('Error deleting offer:', err);
      if (removed) setOffersList(prev => [...prev, removed].sort((a, b) => new Date(a.offerEndDate) - new Date(b.offerEndDate))); // rollback
      setMessage({ type: 'error', text: 'Failed to delete offer.' });
    }
  };

  const filteredProducts = products.filter(p => {
    const name = p.name?.toLowerCase() ?? '';
    const category = p.category?.toLowerCase() ?? '';
    const term = searchTerm.toLowerCase();
    return name.includes(term) || category.includes(term);
  });

  const toggleBannerProduct = (id) => {
    setSettings(prev => ({
      ...prev,
      bannerProductIds: prev.bannerProductIds.includes(id)
        ? prev.bannerProductIds.filter(pid => pid !== id)
        : [...prev.bannerProductIds, id]
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={48} className="animate-spin text-yellow-500 mb-4" />
        <p className="text-lg font-medium">Initializing Promotion Engine...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:p-10 space-y-8 md:space-y-10 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">Campaign Manager</h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Control your website's featured content and global offers.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={fetchAll}
            disabled={loading}
            title="Refresh data"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-yellow-400 px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-yellow-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black transition-all shadow-xl shadow-yellow-600/20 active:scale-95 flex-1 sm:flex-none text-center"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? 'Syncing...' : 'Save Slider Selection'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl flex items-center gap-3 font-bold ${message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
              }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gray-900 rounded-[2.5rem] border border-yellow-900/10 p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-yellow-900/40 text-yellow-600 p-3 rounded-2xl">
                <Layout size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Hero Banner Selection</h2>
                <p className="text-xs text-gray-400 font-bold uppercase mt-1">Select products to show in the homepage slider</p>
              </div>
            </div>

            <div className="relative mb-6">
              <label htmlFor="promo-search" className="sr-only">Search products to feature</label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="promo-search"
                name="promoSearch"
                type="text"
                placeholder="Search products to feature..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-yellow-500/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {filteredProducts.length === 0 ? (
                <p className="col-span-2 text-center text-gray-400 font-medium py-10">No products found.</p>
              ) : (
                filteredProducts.map(product => {
                  const isSelected = settings.bannerProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleBannerProduct(product.id)}
                      className={`flex items-center gap-4 p-4 rounded-3xl border transition-all text-left group ${isSelected
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-yellow-900/10 hover:border-yellow-900/20 bg-gray-900'
                        }`}
                    >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-800 border border-yellow-900/10 flex-shrink-0">
                        {product.image ? (
                          <img
                            src={getOptimizedImage(product.image, 'thumbnail')}
                            alt={product.name ?? ''}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest leading-none mb-1">
                          {product.category ?? 'Uncategorized'}
                        </p>
                        <h4 className="font-black text-white text-sm truncate">{product.name ?? 'Unnamed Product'}</h4>
                        <p className="text-xs text-gray-400 font-bold">
                          Rs.{Number(product.price ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-800 text-gray-300 group-hover:text-gray-400'
                        }`}>
                        {isSelected ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Create New Offer Form */}
          <div className="bg-slate-950 rounded-[2.5rem] p-8 border border-yellow-900/10 shadow-2xl relative text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />

            <div className="flex items-center gap-4 mb-8">
              <div className="bg-yellow-500 text-white p-3 rounded-2xl">
                <Plus size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white">Create Offer</h2>
                <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mt-1">Schedule new campaign</p>
              </div>
            </div>

            <form onSubmit={handleAddOffer} className="space-y-6">
              <div>
                <label htmlFor="offer-title" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">
                  Offer Title
                </label>
                <input
                  id="offer-title"
                  name="offerTitle"
                  type="text"
                  placeholder="e.g. Pink Saree Flash Deal"
                  value={newOffer.title}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-900 border border-white/10 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:ring-2 focus:ring-yellow-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="offer-product" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">
                  Target Product
                </label>
                <select
                  id="offer-product"
                  name="offerProductId"
                  value={newOffer.productId}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, productId: e.target.value }))}
                  className="w-full bg-gray-900 border border-white/10 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:ring-2 focus:ring-yellow-500/50"
                  required
                >
                  <option value="" className="text-white">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="text-white">
                      {p.name ?? 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="offer-discount" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">
                    Discount %
                  </label>
                  <input
                    id="offer-discount"
                    name="offerDiscount"
                    type="number"
                    min={1}
                    max={99}
                    value={newOffer.discount}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-900 border border-white/10 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:ring-2 focus:ring-yellow-500/50"
                    required
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between p-4 bg-gray-900 border border-white/10 rounded-2xl h-[54px]">
                    <span className="font-black text-[10px] uppercase tracking-widest text-gray-400">Active</span>
                    <button
                      type="button"
                      onClick={() => setNewOffer(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className={`w-10 h-6 rounded-full relative transition-all duration-300 ${newOffer.isActive ? 'bg-yellow-500' : 'bg-gray-700'}`}
                      aria-label="Toggle active status"
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-gray-900 transition-all duration-300 ${newOffer.isActive ? 'translate-x-4' : 'translate-x-0'} left-0.5`} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="offer-end" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">
                  Expiry Date &amp; Time
                </label>
                <input
                  id="offer-end"
                  name="offerEndDate"
                  type="datetime-local"
                  value={newOffer.offerEndDate}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, offerEndDate: e.target.value }))}
                  className="w-full bg-gray-900 border border-white/10 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:ring-2 focus:ring-yellow-500/50"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-black font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all shadow-xl shadow-yellow-500/10"
              >
                Add Live Offer
              </button>
            </form>
          </div>

          {/* Live Offers Ledger */}
          <div className="bg-gray-900 rounded-[2.5rem] border border-yellow-900/10 p-8 shadow-sm text-white space-y-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-900/40 text-yellow-500 p-3 rounded-2xl">
                <Calendar size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest">Offers Ledger</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                  Active Campaigns ({offersList.length})
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {offersList.length === 0 ? (
                <p className="text-center text-gray-500 text-xs font-bold py-6">No offers registered.</p>
              ) : (
                offersList.map(offer => {
                  const targetProduct = products.find(p => p.id === offer.productId);
                  const isExpired = new Date(offer.offerEndDate).getTime() <= Date.now();
                  return (
                    <div
                      key={offer.id}
                      className={`p-4 rounded-3xl border ${
                        offer.isActive && !isExpired
                          ? 'border-yellow-500/30 bg-yellow-500/5'
                          : 'border-white/5 bg-slate-950/40 opacity-60'
                      } flex flex-col gap-3`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm text-white truncate">{offer.title}</h4>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                            Prod: <span className="text-yellow-500 font-bold">{targetProduct?.name || 'Unknown'}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="text-red-500 hover:text-red-400 font-black text-[10px] uppercase tracking-widest ml-2"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <div className="text-[9px] text-gray-500 uppercase tracking-widest space-y-0.5">
                          <div>Discount: <span className="text-white font-bold">{offer.discount}%</span></div>
                          <div>Ends: <span className="text-white font-bold">{new Date(offer.offerEndDate).toLocaleString()}</span></div>
                          <div>
                            Status:{' '}
                            <span className={isExpired ? 'text-red-500 font-bold' : offer.isActive ? 'text-green-500 font-bold' : 'text-gray-500 font-bold'}>
                              {isExpired ? 'EXPIRED' : offer.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>
                        </div>

                        {!isExpired && (
                          <button
                            type="button"
                            onClick={() => handleToggleOfferActive(offer.id, offer.isActive)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                              offer.isActive
                                ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {offer.isActive ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Promotions;