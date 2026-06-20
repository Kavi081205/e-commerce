import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Copy, Check } from 'lucide-react';

const EMPTY_FORM = {
  code: '',
  discountType: 'fixed',
  discountValue: '',
  minOrderAmount: '',
  expiryDate: '',
  isActive: true,
};

const CouponsManage = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
    getDocs(q)
      .then(snap => {
        setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(err => {
        console.error('Coupons fetch error:', err);
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (name === 'code' ? value.toUpperCase() : value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.discountValue || !form.expiryDate) return;
    setSaving(true);
    // Optimistic add with temp id
    const tempId = `temp-${Date.now()}`;
    const tempCoupon = {
      ...form,
      id: tempId,
      code: form.code.trim().toUpperCase(),
      discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount) || 0,
    };
    setCoupons(prev => [tempCoupon, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    try {
      const docRef = await addDoc(collection(db, 'coupons'), {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        expiryDate: form.expiryDate,
        isActive: form.isActive,
        createdAt: serverTimestamp(),
      });
      setCoupons(prev => prev.map(c => c.id === tempId ? { ...c, id: docRef.id } : c));
    } catch (err) {
      console.error('Error creating coupon:', err);
      setCoupons(prev => prev.filter(c => c.id !== tempId)); // rollback
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    // Optimistic toggle
    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), { isActive: !coupon.isActive });
    } catch (err) {
      console.error('Error toggling coupon:', err);
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, isActive: coupon.isActive } : c)); // rollback
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    // Optimistic delete
    const removed = coupons.find(c => c.id === deleteId);
    setCoupons(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
    try {
      await deleteDoc(doc(db, 'coupons', deleteId));
    } catch (err) {
      console.error('Error deleting coupon:', err);
      if (removed) setCoupons(prev => [removed, ...prev]); // rollback
    } finally {
      setDeleting(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const isExpired = (expiryDate) => expiryDate && new Date(expiryDate) < new Date();

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Coupon Management</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Create and manage discount coupon codes</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(prev => !prev)}
          className="flex items-center gap-2 bg-yellow-500 text-black font-black px-6 py-3 rounded-xl text-sm uppercase tracking-widest hover:bg-yellow-400 transition-all active:scale-95 shadow-lg shadow-yellow-500/20"
        >
          <Plus size={18} /> {showForm ? 'Cancel' : 'New Coupon'}
        </button>
      </div>

      {/* Create Coupon Form */}
      {showForm && (
        <div className="bg-gray-900 border border-yellow-900/20 rounded-2xl p-8 mb-8 shadow-2xl">
          <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
            <Tag size={20} className="text-yellow-500" /> Create New Coupon
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor="coupon-code" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Coupon Code *</label>
              <input
                id="coupon-code"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                autoComplete="off"
                placeholder="e.g. SAVE100"
                className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest outline-none focus:border-yellow-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="coupon-discount-type" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount Type *</label>
              <select
                id="coupon-discount-type"
                name="discountType"
                value={form.discountType}
                onChange={handleChange}
                className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-yellow-500 transition-all"
              >
                <option value="fixed">Fixed Amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="coupon-discount-value" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Discount Value * {form.discountType === 'percentage' ? '(%)' : '(₹)'}
              </label>
              <input
                id="coupon-discount-value"
                name="discountValue"
                type="number"
                min="1"
                max={form.discountType === 'percentage' ? '100' : undefined}
                value={form.discountValue}
                onChange={handleChange}
                required
                placeholder={form.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 100'}
                className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-yellow-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="coupon-min-order" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min. Order Amount (₹)</label>
              <input
                id="coupon-min-order"
                name="minOrderAmount"
                type="number"
                min="0"
                value={form.minOrderAmount}
                onChange={handleChange}
                placeholder="e.g. 500 (0 for no minimum)"
                className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-yellow-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="coupon-expiry" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiry Date *</label>
              <input
                id="coupon-expiry"
                name="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-yellow-500 transition-all"
              />
            </div>
            <div className="space-y-2 flex flex-col justify-end">
              <label htmlFor="coupon-active" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</label>
              <div className="flex items-center gap-3 cursor-pointer bg-black/30 border border-yellow-900/20 rounded-xl px-4 py-3">
                <input
                  id="coupon-active"
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 accent-yellow-500"
                />
                <span className="text-sm font-black text-white uppercase tracking-widest">
                  {form.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-3 bg-yellow-500 text-black font-black px-10 py-3 rounded-xl text-sm uppercase tracking-widest hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-yellow-500/20"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Creating...' : 'Create Coupon'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupons Table */}
      <div className="bg-gray-900 border border-yellow-900/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-8 py-5 border-b border-yellow-900/10 bg-slate-950/30 flex items-center gap-3">
          <Tag size={18} className="text-yellow-500" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">All Coupons</h2>
          <span className="ml-auto text-xs font-black text-gray-500 uppercase tracking-widest">{coupons.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-yellow-500" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-20">
            <Tag size={40} className="text-gray-800 mx-auto mb-4" />
            <p className="text-gray-500 font-black uppercase tracking-widest text-xs">No coupons yet. Create your first one.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-gray-400 text-[10px] uppercase tracking-[0.2em] border-b border-yellow-900/10">
                  <th className="px-6 py-4 font-bold">Code</th>
                  <th className="px-6 py-4 font-bold">Discount</th>
                  <th className="px-6 py-4 font-bold">Min. Order</th>
                  <th className="px-6 py-4 font-bold">Expiry</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-900/10">
                {coupons.map((coupon) => {
                  const expired = isExpired(coupon.expiryDate);
                  return (
                    <tr key={coupon.id} className="hover:bg-slate-950/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white tracking-widest text-sm bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-lg">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyCode(coupon.code)}
                            className="text-gray-600 hover:text-yellow-500 transition-colors"
                            title="Copy code"
                          >
                            {copiedId === coupon.code ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-yellow-500 text-sm">
                          {coupon.discountType === 'percentage'
                            ? `${coupon.discountValue}% OFF`
                            : `₹${Number(coupon.discountValue).toLocaleString()} OFF`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-400 text-sm">
                          {coupon.minOrderAmount > 0 ? `₹${Number(coupon.minOrderAmount).toLocaleString()}` : 'No minimum'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-sm ${expired ? 'text-red-500' : 'text-gray-400'}`}>
                          {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('en-IN') : '—'}
                          {expired && <span className="ml-2 text-[9px] font-black bg-red-500/10 border border-red-500/20 text-red-500 px-2 py-0.5 rounded-full uppercase">Expired</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => toggleActive(coupon)}
                          className="flex items-center gap-2 transition-colors"
                        >
                          {coupon.isActive ? (
                            <>
                              <ToggleRight size={22} className="text-green-500" />
                              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={22} className="text-gray-600" />
                              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Disabled</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteId(coupon.id)}
                          className="p-2 text-gray-700 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                          title="Delete coupon"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="block md:hidden divide-y divide-yellow-900/10">
            {coupons.map((coupon) => {
              const expired = isExpired(coupon.expiryDate);
              return (
                <div key={coupon.id} className="p-6 flex flex-col gap-4 hover:bg-slate-950/40 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white tracking-widest text-sm bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-lg">
                        {coupon.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCode(coupon.code)}
                        className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-500 transition-colors border border-yellow-900/10 rounded-xl bg-black/20"
                        title="Copy code"
                      >
                        {copiedId === coupon.code ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <span className="font-black text-yellow-500 text-sm">
                      {coupon.discountType === 'percentage'
                        ? `${coupon.discountValue}% OFF`
                        : `₹${Number(coupon.discountValue).toLocaleString()} OFF`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Min. Order</p>
                      <p className="font-bold text-gray-400 text-sm">
                        {coupon.minOrderAmount > 0 ? `₹${Number(coupon.minOrderAmount).toLocaleString()}` : 'No minimum'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Expiry</p>
                      <p className={`font-bold text-sm ${expired ? 'text-red-500' : 'text-gray-400'}`}>
                        {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('en-IN') : '—'}
                      </p>
                      {expired && (
                        <span className="inline-block mt-1 text-[8px] font-black bg-red-500/10 border border-red-500/20 text-red-500 px-2 py-0.5 rounded-full uppercase">
                          Expired
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Status</p>
                      <button
                        type="button"
                        onClick={() => toggleActive(coupon)}
                        className="flex items-center gap-2 p-2 border border-yellow-900/10 rounded-xl hover:bg-slate-950/60 min-h-[44px] min-w-[100px] justify-center text-left"
                      >
                        {coupon.isActive ? (
                          <>
                            <ToggleRight size={22} className="text-green-500" />
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={22} className="text-gray-600" />
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Disabled</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Actions</p>
                      <button
                        type="button"
                        onClick={() => setDeleteId(coupon.id)}
                        className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl border border-yellow-900/10 ml-auto"
                        title="Delete coupon"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900 border border-yellow-900/30 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Delete Coupon?</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponsManage;
