import React, { useState, useEffect } from 'react';
import { getInvoices, getStoreSettings } from '../../firebase/services';
import { generateInvoice } from '../../utils/invoiceGenerator';
import { getOptimizedImage } from '../../utils/cloudinary';
import { InvoicePrintView } from '../../components/PrintViews';
import { FileText, Download, Printer, Search, Loader2, X, Eye, Phone, Mail, MapPin, Truck } from 'lucide-react';

/** Logo with automatic fallback badge for the invoice modal */
const BrandLogoModal = () => {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <svg width="36" height="36" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-label="SMKP TRADERS logo">
        <circle cx="28" cy="28" r="28" fill="#D4AF37" />
        <circle cx="28" cy="28" r="24" fill="#0f0f0f" />
        <text x="28" y="33" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight="900" fontSize="13" fill="#D4AF37" letterSpacing="1">SMKP</text>
      </svg>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="SMKP TRADERS Logo"
      width={36}
      height={36}
      onError={() => setErr(true)}
      style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
    />
  );
};




const InvoicesManage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  // Dynamic business details state
  const [storeDetails, setStoreDetails] = useState({
    name: "SMKP TRADERS",
    ownerName: "Kaviyarasan Murugan",
    phone: "9677417185",
    email: "kaviyarasanmurugan78@gmail.com",
    address: "Pommalappatti",
    state: "Tamil Nadu",
    country: "India"
  });

  // Courier Notes editing state
  const [courierNotes, setCourierNotes] = useState('');

  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          console.error("Window print error:", err);
          generateInvoice({ ...printData.order, id: printData.order.orderId }, { action: 'download', courierNotes: printData.order.courierNotes || '' }).catch(e => {
            console.error("Fallback PDF download failed:", e);
          });
        } finally {
          setIsPrinting(false);
          setTimeout(() => setPrintData(null), 500);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printData]);

  const handlePrint = (invoice) => {
    setIsPrinting(true);
    setPrintData({ type: 'invoice', order: { ...invoice, id: invoice.orderId || invoice.id } });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invoiceData, settingsData] = await Promise.all([
          getInvoices(),
          getStoreSettings()
        ]);
        setInvoices(invoiceData);
        if (settingsData) {
          setStoreDetails({
            name: settingsData.name || "SMKP TRADERS",
            ownerName: settingsData.ownerName || "Kaviyarasan Murugan",
            phone: settingsData.phone || "9677417185",
            email: settingsData.email || "kaviyarasanmurugan78@gmail.com",
            address: settingsData.address || "Pommalappatti",
            state: settingsData.state || "Tamil Nadu",
            country: settingsData.country || "India"
          });
        }
      } catch (error) {
        console.error("Error fetching repository data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleOpenPreview = (inv) => {
    setSelectedInvoice(inv);
    setCourierNotes(inv.courierNotes || '');
  };

  const filteredInvoices = invoices.filter(inv => {
    const search = searchTerm.toLowerCase();
    return (
      (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(search)) ||
      (inv.orderId && inv.orderId.toLowerCase().includes(search)) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(search)) ||
      (inv.phone && inv.phone.includes(search))
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={40} className="animate-spin text-yellow-500 mb-4" />
        <p className="font-black uppercase tracking-widest text-sm">Retrieving Invoice Ledger...</p>
      </div>
    );
  }

  // Active sender details either snapshot on invoice, loaded settings, or fallback defaults
  const getSenderDetails = (inv) => {
    if (inv && inv.businessDetails) {
      return inv.businessDetails;
    }
    return storeDetails;
  };

  return (
    <div className="animate-fadeIn">
      {/* Print stylesheet override to support white high-readability printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-sheet, #invoice-print-sheet * {
            visibility: visible;
          }
          #invoice-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 135mm !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-light-bg {
            background-color: #f8fafc !important;
            background: #f8fafc !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-border-dark {
            border-color: #e2e8f0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Invoice Repository</h1>
          <p className="text-gray-500 text-sm font-medium">Verify, audit, print, and download generated retail invoices</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-yellow-900/20 mb-8 flex items-center gap-4">
        <Search size={20} className="text-gray-500 flex-shrink-0" />
        <label htmlFor="invoice-search" className="sr-only">Search Invoices</label>
        <input
          id="invoice-search"
          name="invoiceSearch"
          type="text"
          placeholder="Search by Invoice #, Order ID, Customer Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-sm w-full font-medium placeholder-gray-600"
        />
      </div>

      {/* Grid List / Table */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-[2.5rem] border border-yellow-900/20 overflow-hidden">
        <div className="px-8 py-6 border-b border-yellow-900/10 bg-slate-950/30">
          <h2 className="text-lg font-black text-white uppercase tracking-widest">Invoices ({filteredInvoices.length})</h2>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 text-gray-500 text-[10px] uppercase tracking-[0.2em] border-b border-yellow-900/10">
                <th className="px-8 py-4 font-black">Invoice #</th>
                <th className="px-8 py-4 font-black">Order ID</th>
                <th className="px-8 py-4 font-black">Customer</th>
                <th className="px-8 py-4 font-black">Date</th>
                <th className="px-8 py-4 font-black text-right">Valuation</th>
                <th className="px-8 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-900/10">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center text-gray-500 font-medium italic">
                    No matching invoices found in repository
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-950/30 transition-colors group">
                    <td className="px-8 py-6 font-bold text-yellow-500">{inv.invoiceNumber}</td>
                    <td className="px-8 py-6 text-gray-400 font-mono text-xs">#{inv.orderId ? inv.orderId.slice(-8).toUpperCase() : ''}</td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-white">{inv.customerName}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{inv.phone}</div>
                    </td>
                    <td className="px-8 py-6 text-gray-400 text-xs">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="px-8 py-6 text-right font-black text-white">
                      Rs.{(inv.pricing?.grandTotal || 0).toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(inv)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => generateInvoice({ ...inv, id: inv.orderId }, { action: 'download', courierNotes: inv.courierNotes || '' })}
                          className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-lg transition-all"
                          title="Download Invoice"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(inv)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-all"
                          title="Print Invoice"
                        >
                          <Printer size={18} />
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
        <div className="block md:hidden divide-y divide-yellow-900/10">
          {filteredInvoices.length === 0 ? (
            <div className="px-6 py-20 text-center text-gray-500 font-medium italic">
              No matching invoices found in repository
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col gap-4 hover:bg-slate-950/30 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-yellow-500">{inv.invoiceNumber}</span>
                  <span className="text-gray-400 font-mono text-xs">
                    #{inv.orderId ? inv.orderId.slice(-8).toUpperCase() : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Customer</p>
                    <div className="font-bold text-white text-sm">{inv.customerName}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{inv.phone}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Valuation</p>
                    <p className="font-black text-white text-base">
                      Rs.{(inv.pricing?.grandTotal || 0).toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Actions</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(inv)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-xl border border-yellow-900/10 transition-all"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => generateInvoice({ ...inv, id: inv.orderId }, { action: 'download', courierNotes: inv.courierNotes || '' })}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-xl border border-yellow-900/10 transition-all"
                      title="Download Invoice"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(inv)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-xl border border-yellow-900/10 transition-all"
                      title="Print Invoice"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invoice Details Preview Modal */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-white text-black rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-scaleIn flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Hidden on actual print) */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gray-50 no-print">
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                <FileText size={18} className="text-yellow-600" /> Invoice Sheet Preview
              </h2>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 bg-gray-200 rounded-full text-gray-600 hover:bg-gray-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6">
              
              {/* Actual Printable Invoice Sheet */}
              <div id="invoice-print-sheet" className="w-[135mm] border border-gray-150 rounded-2xl overflow-hidden space-y-0 print-bg-white print-text-black">
                {/* ── Branded Header ── */}
                <div className="bg-[#0f0f0f] text-white px-4 py-2 flex items-center justify-between print:bg-[#0f0f0f]">
                  <div className="flex items-center gap-3">
                    {/* Logo with fallback */}
                    <BrandLogoModal />
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">
                        {getSenderDetails(selectedInvoice).name}
                      </h3>
                      <p className="text-[9px] font-semibold text-yellow-400 tracking-widest uppercase mt-0.5">
                        Premium E-Commerce Store
                      </p>
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        Ph: {getSenderDetails(selectedInvoice).phone} &nbsp;|&nbsp; {getSenderDetails(selectedInvoice).email}
                      </p>
                      <p className="text-[8px] text-gray-400">
                        {getSenderDetails(selectedInvoice).address}, {getSenderDetails(selectedInvoice).state}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-yellow-500 text-[#0f0f0f] rounded text-[8px] font-black uppercase tracking-widest">
                      RETAIL INVOICE
                    </span>
                    <p className="text-xs font-mono font-bold text-white mt-1.5">
                      {selectedInvoice.invoiceNumber}
                    </p>
                    <p className="text-[8px] text-gray-400 mt-0.5">
                      {new Date(selectedInvoice.invoiceDate).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {/* Gold accent stripe */}
                <div className="h-1 bg-yellow-500 w-full" />

                <div className="p-4 space-y-4">

                {/* Shipping Metadata Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1.5 px-3 bg-slate-50 rounded-2xl text-[9px] print-light-bg print-border-dark border border-gray-100">
                  <div>
                    <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0">Order ID</span>
                    <span className="font-mono text-slate-950 font-bold uppercase print-text-dark">
                      #{selectedInvoice.orderId ? selectedInvoice.orderId.toUpperCase() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0">Date Placed</span>
                    <span className="text-slate-950 font-bold print-text-dark">
                      {new Date(selectedInvoice.invoiceDate).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0">Payment Method</span>
                    <span className="text-slate-950 font-bold uppercase print-text-dark">
                      {selectedInvoice.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0">Payment Status</span>
                    <span className={`font-black uppercase ${selectedInvoice.paymentStatus?.toLowerCase() === 'paid' ? 'text-green-700' : 'text-orange-600'}`}>
                      {selectedInvoice.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Professional Dual shipping address layouts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9px]">
                  {/* FROM Section */}
                  <div className="p-3.5 border border-yellow-500/20 bg-yellow-500/[0.02] rounded-2xl print-bg-white print-border-dark">
                    <h4 className="text-[8px] font-black text-yellow-600 uppercase tracking-widest mb-1.5 border-b border-yellow-500/10 pb-1 print-text-dark">
                      SENDER (FROM)
                    </h4>
                    <p className="font-black text-slate-950 text-xs print-text-dark uppercase">
                      {getSenderDetails(selectedInvoice).name}
                    </p>
                    <p className="text-gray-500 mt-0.5 font-medium print-text-dark">
                      Owner: {getSenderDetails(selectedInvoice).ownerName}
                    </p>
                    
                    <div className="mt-2 space-y-0.5 text-gray-500 font-medium print-text-dark">
                      <div className="flex items-center gap-1.5">
                        <Phone size={10} className="text-yellow-600 shrink-0 print-text-dark" />
                        <span>Phone: {getSenderDetails(selectedInvoice).phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail size={10} className="text-yellow-600 shrink-0 print-text-dark" />
                        <span>Email: {getSenderDetails(selectedInvoice).email}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <MapPin size={10} className="text-yellow-600 mt-0.5 shrink-0 print-text-dark" />
                        <span>
                          {getSenderDetails(selectedInvoice).address}, {getSenderDetails(selectedInvoice).state}, {getSenderDetails(selectedInvoice).country}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TO Section */}
                  <div className="p-3.5 border border-slate-200 bg-slate-500/[0.02] rounded-2xl print-bg-white print-border-dark">
                    <h4 className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-1.5 border-b border-slate-200 pb-1 print-text-dark">
                      SHIP TO (TO / RECEIVER)
                    </h4>
                    <p className="font-black text-slate-950 text-xs print-text-dark uppercase">
                      {selectedInvoice.customerName}
                    </p>

                    <div className="mt-2 space-y-0.5 text-gray-500 font-medium print-text-dark">
                      <div className="flex items-center gap-1.5">
                        <Phone size={10} className="text-slate-600 shrink-0 print-text-dark" />
                        <span className="font-bold text-slate-800 print-text-dark">Phone: {selectedInvoice.phone}</span>
                      </div>
                      {selectedInvoice.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail size={10} className="text-slate-600 shrink-0 print-text-dark" />
                          <span>Email: {selectedInvoice.email}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5">
                        <MapPin size={10} className="text-slate-600 mt-0.5 shrink-0 print-text-dark" />
                        <span>
                          {selectedInvoice.address}
                          {selectedInvoice.landmark && <span className="block text-gray-400 text-[8px]">Landmark: {selectedInvoice.landmark}</span>}
                          <span className="block mt-0.5 font-bold text-slate-700 print-text-dark">
                            {selectedInvoice.city}{selectedInvoice.district ? ', ' + selectedInvoice.district : ''}
                          </span>
                          <span className="block font-bold text-slate-700 print-text-dark">
                            {selectedInvoice.state} - {selectedInvoice.pincode}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display Courier notes on invoice block if present */}
                {courierNotes.trim() && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-2xl text-[9px] text-yellow-800 print-light-bg print-border-dark print-text-dark flex items-start gap-2">
                    <Truck size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black uppercase tracking-wider text-[8px] block mb-0">Courier Instructions</span>
                      <span className="font-semibold">{courierNotes}</span>
                    </div>
                  </div>
                )}

                {/* Products Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[9px] text-left">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[8px] tracking-wider print-border-dark print-text-dark">
                        <th className="py-1.5">Item Details</th>
                        <th className="py-1.5 text-center">Qty</th>
                        <th className="py-1.5 text-right">Unit Price</th>
                        <th className="py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 print-border-dark">
                      {selectedInvoice.items?.map((item, idx) => {
                        const qty = item.quantity || 1;
                        const eff = item.effectivePrice || item.price || 0;
                        return (
                          <tr key={item.id || item.productId || `inv-item-${idx}`} className="print-text-dark">
                            <td className="py-1.5">
                              <div className="flex items-center gap-3">
                                {item.image && (
                                  <img
                                    src={getOptimizedImage(item.image, 'thumbnail')}
                                    alt={item.name}
                                    loading="lazy"
                                    className="w-6 h-6 rounded object-cover border border-gray-100 no-print"
                                  />
                                )}
                                <div>
                                  <span className="font-bold text-gray-800 print-text-dark block text-[10px]">{item.name}</span>
                                  {item.color || item.size ? (
                                    <span className="text-[8px] text-gray-400 mt-0.5 block uppercase tracking-wider">
                                      {item.color} {item.size ? `· Size ${item.size}` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-1.5 text-center text-gray-600 print-text-dark font-medium">{qty}</td>
                            <td className="py-1.5 text-right text-gray-600 print-text-dark font-mono">Rs.{Number(eff).toFixed(2)}</td>
                            <td className="py-1.5 text-right font-bold text-gray-800 print-text-dark font-mono">Rs.{(eff * qty).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Price Summary */}
                <div className="flex justify-end pt-2">
                  <div className="w-60 space-y-1 text-[9px]">
                    <div className="flex justify-between text-gray-500 print-text-dark font-medium">
                      <span>Subtotal:</span>
                      <span className="font-mono">Rs.{selectedInvoice.items?.reduce((a, i) => a + (Number(i.effectivePrice || i.price || 0) * Number(i.quantity || 1)), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 print-text-dark font-medium">
                      <span>Shipping Charge:</span>
                      <span className="font-mono">Rs.{(selectedInvoice.pricing?.shipping || 0).toFixed(2)}</span>
                    </div>
                    {selectedInvoice.pricing?.couponDiscount > 0 && (
                      <div className="flex justify-between text-red-500 font-bold">
                        <span>Coupon Discount:</span>
                        <span className="font-mono">-Rs.{(selectedInvoice.pricing?.couponDiscount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-[10px] text-black pt-1 border-t border-gray-200 print-border-dark print-text-dark">
                      <span>GRAND TOTAL:</span>
                      <span className="font-mono text-xs">Rs.{(selectedInvoice.pricing?.grandTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* Edit Courier Notes Panel (Hidden on actual print) */}
              <div className="mt-8 bg-gray-50 rounded-3xl p-6 border border-gray-150 space-y-4 no-print">
                <label htmlFor="courier-notes" className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <Truck size={16} className="text-yellow-600" /> Edit Courier Instructions
                </label>
                <p className="text-[10px] text-gray-500">Add instructions (e.g. courier routing, gate notes, time slots) to appear on the PDF download and printed copies.</p>
                <textarea
                  id="courier-notes"
                  name="courierNotes"
                  value={courierNotes}
                  onChange={(e) => setCourierNotes(e.target.value)}
                  placeholder="e.g. Handle with care. Leave with neighbor if gate is locked."
                  rows="3"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-yellow-500 text-black placeholder-gray-400 transition-colors"
                />
              </div>

            </div>

            {/* Modal Footer / Actions (Hidden on actual print) */}
            <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                <Printer size={14} /> Print Invoice
              </button>
              <button
                type="button"
                onClick={() => generateInvoice({ ...selectedInvoice, id: selectedInvoice.orderId }, { action: 'download', courierNotes })}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printing Loading Overlay */}
      {isPrinting && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center text-white no-print">
          <Loader2 size={48} className="animate-spin text-yellow-500 mb-4" />
          <h3 className="text-xl font-black uppercase tracking-widest">Generating Invoice...</h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Preparing printable document view</p>
        </div>
      )}

      {/* Hidden Print Container */}
      {printData && (
        <div id="print-area" className="hidden print:block bg-white text-black min-h-screen">
          <InvoicePrintView order={printData.order} />
        </div>
      )}
    </div>
  );
};

export default InvoicesManage;
