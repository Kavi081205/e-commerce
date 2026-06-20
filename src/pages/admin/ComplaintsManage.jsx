import React, { useState, useEffect, useCallback } from 'react';
import { getAllComplaints, updateComplaint, markComplaintNotificationsRead } from '../../firebase/services';
import {
  AlertCircle, CheckCircle2, Clock, XCircle, Eye, X, Search,
  Filter, MessageSquare, Image as ImageIcon, Video, Loader2,
  ChevronDown, RefreshCw, Send, FileText, Phone, Package, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['New', 'In Review', 'Resolved', 'Rejected'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const STATUS_CONFIG = {
  'New':       { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',   icon: Clock },
  'In Review': { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertCircle },
  'Resolved':  { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: CheckCircle2 },
  'Rejected':  { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',    icon: XCircle },
};

const PRIORITY_COLORS = {
  'Low': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  'Medium': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  'High': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Critical': 'text-red-400 bg-red-500/10 border-red-500/30',
};

const getStatusCfg = (s) => STATUS_CONFIG[s] || STATUS_CONFIG['New'];

// ─── WhatsApp Message Generator ────────────────────────────────────────────────
const generateWhatsAppMsg = (complaint) => {
  const lines = [
    `*🚨 NEW CUSTOMER COMPLAINT — SMKP TRADERS*`,
    ``,
    `*Complaint ID:* ${complaint.id?.slice(-8).toUpperCase()}`,
    `*Customer:* ${complaint.customerName || 'N/A'}`,
    `*Phone:* ${complaint.customerPhone || 'N/A'}`,
    `*Order:* #${complaint.orderShortId || complaint.orderId?.slice(-8).toUpperCase() || 'N/A'}`,
    `*Type:* ${complaint.complaintType}`,
    `*Priority:* ${complaint.priority || 'Medium'}`,
    ``,
    `*Description:*`,
    complaint.description,
    ``,
    `*Product(s):* ${complaint.productNames || 'N/A'}`,
    ``,
    `Please review and respond promptly.`,
  ];
  return encodeURIComponent(lines.join('\n'));
};

// ─── Complaint Detail Modal ─────────────────────────────────────────────────────
const ComplaintDetailModal = ({ complaint, onClose, onUpdate }) => {
  const [status, setStatus]         = useState(complaint.status || 'New');
  const [priority, setPriority]     = useState(complaint.priority || 'Medium');
  const [adminNotes, setAdminNotes] = useState(complaint.adminNotes || '');
  const [adminReply, setAdminReply] = useState(complaint.adminReply || '');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeImg, setActiveImg]   = useState(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateComplaint(complaint.id, { status, priority, adminNotes, adminReply });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdate({ ...complaint, status, priority, adminNotes, adminReply });
    } catch (err) {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const statusCfg = getStatusCfg(status);
  const StatusIcon = statusCfg.icon;

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm px-4 py-8 overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-3xl my-4"
        >
          {/* Modal Header */}
          <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-5 flex items-center justify-between rounded-t-3xl z-10">
            <div>
              <h2 className="text-lg font-black text-white">Complaint Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">ID: {complaint.id?.slice(-8).toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* WhatsApp Share */}
              <a
                href={`https://wa.me/919677417185?text=${generateWhatsAppMsg(complaint)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              >
                <Phone size={14} /> WhatsApp
              </a>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Status + Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="complaint-detail-status" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Status</label>
                <div className="relative">
                  <select
                    id="complaint-detail-status"
                    name="status"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 appearance-none pr-8"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="complaint-detail-priority" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Priority</label>
                <div className="relative">
                  <select
                    id="complaint-detail-priority"
                    name="priority"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 appearance-none pr-8"
                  >
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User size={12} /> Customer Information
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500 mb-0.5">Name</p>
                  <p className="text-white font-bold">{complaint.customerName || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Phone</p>
                  <p className="text-white font-bold">{complaint.customerPhone || '—'}</p>
                </div>
              </div>
            </div>

            {/* Order Info */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package size={12} /> Order Information
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500 mb-0.5">Order ID</p>
                  <p className="text-white font-mono font-bold">#{complaint.orderShortId || complaint.orderId?.slice(-8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Product(s)</p>
                  <p className="text-white font-bold truncate">{complaint.productNames || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Complaint Type</p>
                  <p className="text-yellow-400 font-bold">{complaint.complaintType}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Submitted</p>
                  <p className="text-white font-bold">{formatDate(complaint.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Complaint Description */}
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText size={12} /> Complaint Description
              </p>
              <div className="bg-gray-900 rounded-2xl p-4 text-sm text-gray-200 leading-relaxed">
                {complaint.description}
              </div>
            </div>

            {/* Images */}
            {complaint.images?.length > 0 && (
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ImageIcon size={12} /> Customer Images ({complaint.images.length})
                </p>
                <div className="flex flex-wrap gap-3">
                  {complaint.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImg(img)}
                      className="w-20 h-20 rounded-xl overflow-hidden border border-gray-700 hover:border-yellow-500 transition-colors"
                    >
                      <img src={img} alt={`img-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Video */}
            {complaint.video && (
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Video size={12} /> Customer Video
                </p>
                <video src={complaint.video} controls className="w-full max-h-64 rounded-2xl bg-black border border-gray-700" />
              </div>
            )}

            {/* Admin Notes */}
            <div>
              <label htmlFor="complaint-admin-notes" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                Internal Admin Notes (not visible to customer)
              </label>
              <textarea
                id="complaint-admin-notes"
                name="adminNotes"
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Add internal notes, investigation findings..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>

            {/* Reply to Customer */}
            <div>
              <label htmlFor="complaint-admin-reply" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Send size={12} /> Reply to Customer (visible to customer)
              </label>
              <textarea
                id="complaint-admin-reply"
                name="adminReply"
                value={adminReply}
                onChange={e => setAdminReply(e.target.value)}
                rows={4}
                placeholder="Write a reply that will be shown to the customer..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle2 size={18} /> : null}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Image Lightbox */}
      {activeImg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setActiveImg(null)}
        >
          <img src={activeImg} alt="enlarged" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button type="button" onClick={() => setActiveImg(null)} className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2">
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const ComplaintsManage = () => {
  const [complaints, setComplaints]   = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllComplaints();
    setComplaints(data);
    setFiltered(data);
    // Mark notifications read when admin opens this page
    markComplaintNotificationsRead();
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let result = [...complaints];
    if (statusFilter !== 'All') result = result.filter(c => c.status === statusFilter);
    if (priorityFilter !== 'All') result = result.filter(c => c.priority === priorityFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.customerName?.toLowerCase().includes(s) ||
        c.customerPhone?.includes(s) ||
        c.orderId?.toLowerCase().includes(s) ||
        c.orderShortId?.toLowerCase().includes(s) ||
        c.complaintType?.toLowerCase().includes(s) ||
        c.description?.toLowerCase().includes(s)
      );
    }
    setFiltered(result);
  }, [complaints, statusFilter, priorityFilter, search]);

  const handleUpdate = (updated) => {
    setComplaints(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Stats
  const stats = {
    total: complaints.length,
    new: complaints.filter(c => c.status === 'New').length,
    inReview: complaints.filter(c => c.status === 'In Review').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Customer Complaints</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Manage and respond to customer issues</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-blue-500/10 text-blue-400', border: 'border-blue-500/20' },
          { label: 'New', value: stats.new, color: 'bg-yellow-500/10 text-yellow-400', border: 'border-yellow-500/20' },
          { label: 'In Review', value: stats.inReview, color: 'bg-orange-500/10 text-orange-400', border: 'border-orange-500/20' },
          { label: 'Resolved', value: stats.resolved, color: 'bg-green-500/10 text-green-400', border: 'border-green-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-gray-900 border ${s.border} rounded-2xl p-4`}>
            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color.split(' ')[1]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <label htmlFor="complaints-search" className="sr-only">Search Complaints</label>
          <input
            id="complaints-search"
            name="complaintsSearch"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, order ID, type..."
            autoComplete="off"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
        <label htmlFor="complaints-status-filter" className="sr-only">Filter by Status</label>
        <select
          id="complaints-status-filter"
          name="statusFilter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500"
        >
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label htmlFor="complaints-priority-filter" className="sr-only">Filter by Priority</label>
        <select
          id="complaints-priority-filter"
          name="priorityFilter"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500"
        >
          <option value="All">All Priorities</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-yellow-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold text-lg">No complaints found</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Priority</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(c => {
                  const cfg = getStatusCfg(c.status);
                  const StatusIcon = cfg.icon;
                  const pColor = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.Medium;

                  return (
                    <tr key={c.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-400">
                          #{c.id?.slice(-8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{c.customerName || '—'}</p>
                        <p className="text-xs text-gray-500">{c.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-yellow-400">
                          #{c.orderShortId || c.orderId?.slice(-8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-200 max-w-[140px] block truncate">{c.complaintType}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${pColor}`}>
                          {c.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-full border w-fit ${cfg.bg} ${cfg.color}`}>
                          <StatusIcon size={10} />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-800">
            {filtered.map(c => {
              const cfg = getStatusCfg(c.status);
              const StatusIcon = cfg.icon;
              const pColor = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.Medium;

              return (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                          <StatusIcon size={9} />{c.status}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${pColor}`}>
                          {c.priority || 'Medium'}
                        </span>
                      </div>
                      <p className="font-black text-white text-sm">{c.customerName}</p>
                      <p className="text-xs text-gray-500">{c.customerPhone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-2 rounded-xl shrink-0"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Order</span>
                      <span className="text-yellow-400 font-mono">#{c.orderShortId || c.orderId?.slice(-8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Type</span>
                      <span className="text-white text-right max-w-[60%] truncate">{c.complaintType}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Date</span>
                      <span className="text-white">{formatDate(c.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <ComplaintDetailModal
          complaint={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
};

export default ComplaintsManage;
