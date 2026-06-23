import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle, Search, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../context/NotificationContext';

const STATUS_CONFIG = {
  'New':       { label: 'New',       color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',   icon: Clock },
  'In Review': { label: 'In Review', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertCircle },
  'Resolved':  { label: 'Resolved',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: CheckCircle2 },
  'Rejected':  { label: 'Rejected',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',    icon: XCircle },
};

const getStatusCfg = (s) => STATUS_CONFIG[s] || STATUS_CONFIG['New'];

export default function MyComplaints() {
  const [phoneInput, setPhoneInput] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const { showToast } = useNotification();

  const search = async (e) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;

    const clean = phoneInput.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(`/api/complaints?mobile=${clean}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch complaints');
      }
      const data = await response.json();
      if (data.success) {
        setComplaints(data.complaints || []);
        showToast(`Found ${data.complaints?.length || 0} complaint(s)`, 'success');
      } else {
        throw new Error(data.message || 'Failed to fetch complaints');
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      showToast(err.message || 'Error fetching complaints. Please try again.', 'error');
      setComplaints([]);
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
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.5em] mb-3">Customer Support</p>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-3">My Complaints</h1>
          <p className="text-gray-500 text-sm">Track the status of your complaints</p>
        </div>

        {/* Search */}
        <form onSubmit={search} className="flex flex-wrap gap-3 mb-10 w-full">
          <label htmlFor="my-complaints-phone" className="sr-only">Phone Number</label>
          <input
            id="my-complaints-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder="Enter your phone number"
            className="flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors box-border"
          />
          <button type="submit" disabled={loading} className="shrink-0 w-full sm:w-auto bg-yellow-500 text-black px-6 py-4 rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Search size={18} />}
          </button>
        </form>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && complaints.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">No complaints found for this number</p>
          </div>
        )}

        <div className="space-y-4">
          {complaints.map(c => {
            const cfg = getStatusCfg(c.status);
            const Icon = cfg.icon;
            const isOpen = expandedId === c.id;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              >
                {/* Summary Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : c.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${cfg.bg}`}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{c.complaintType}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Order #{c.orderShortId || c.orderId?.slice(-8).toUpperCase()} · {formatDate(c.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color} hidden sm:block`}>
                      {cfg.label}
                    </span>
                    {isOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                </button>

                {/* Details */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
                        {/* Status badge mobile */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black ${cfg.bg} ${cfg.color}`}>
                          <Icon size={12} />
                          {cfg.label}
                        </div>

                        {/* Description */}
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Your Complaint</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{c.description}</p>
                        </div>

                        {/* Products */}
                        {c.productNames && (
                          <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Product(s)</p>
                            <p className="text-sm text-gray-300">{c.productNames}</p>
                          </div>
                        )}

                        {/* Images */}
                        {c.images?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Your Images</p>
                            <div className="flex flex-wrap gap-2">
                              {c.images.map((img, i) => (
                                <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                                  <img src={img} alt={`img-${i}`} className="w-16 h-16 rounded-xl object-cover border border-gray-700 hover:border-yellow-500 transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Admin Reply */}
                        {c.adminReply && (
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-wider mb-1">Response from SMKP TRADERS</p>
                            <p className="text-sm text-gray-200 leading-relaxed">{c.adminReply}</p>
                          </div>
                        )}

                        {!c.adminReply && (
                          <p className="text-xs text-gray-600 italic">Our team will respond within 24–48 hours.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
