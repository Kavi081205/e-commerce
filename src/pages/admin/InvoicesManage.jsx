import React, { useState, useEffect } from 'react';
import { getInvoices } from '../../firebase/services';
import { generateInvoice } from '../../utils/invoiceGenerator';
import { getOptimizedImage } from '../../utils/cloudinary';
import { FileText, Download, Printer, Search, Loader2, X, Eye } from 'lucide-react';

const GSTIN = "33IMVPM1670M1Z9";

const InvoicesManage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const data = await getInvoices();
        setInvoices(data);
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

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

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Invoice Repository</h1>
          <p className="text-gray-500 text-sm font-medium">Verify, audit, print, and download generated tax invoices</p>
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
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => generateInvoice({ ...inv, id: inv.orderId }, { action: 'download' })}
                          className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-lg transition-all"
                          title="Download Invoice"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => generateInvoice({ ...inv, id: inv.orderId }, { action: 'print' })}
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
                      onClick={() => setSelectedInvoice(inv)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-xl border border-yellow-900/10 transition-all"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => generateInvoice({ ...inv, id: inv.orderId }, { action: 'download' })}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-xl border border-yellow-900/10 transition-all"
                      title="Download Invoice"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => generateInvoice({ ...inv, id: inv.orderId }, { action: 'print' })}
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
            className="bg-white text-black rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl animate-scaleIn flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                <FileText size={20} className="text-yellow-600" /> Invoice Preview
              </h2>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-2 bg-gray-200 rounded-full text-gray-600 hover:bg-gray-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Invoice Sheet */}
            <div className="flex-1 p-10 overflow-y-auto space-y-8">
              {/* Logo / Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-black tracking-tight">SMKP TRADERS</h3>
                  <p className="text-xs text-gray-500 mt-1">Chennai, Tamil Nadu, India</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">GSTIN: {selectedInvoice.businessDetails?.gstin || GSTIN}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    TAX INVOICE
                  </span>
                  <p className="text-sm font-bold mt-3">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">Date: {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Billed To / Details */}
              <div className="grid grid-cols-2 gap-8 text-xs">
                <div>
                  <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-2">Order Information</h4>
                  <p><span className="font-medium text-gray-500">Order ID:</span> #{selectedInvoice.orderId ? selectedInvoice.orderId.toUpperCase() : ''}</p>
                  <p className="mt-1"><span className="font-medium text-gray-500">Payment Mode:</span> {selectedInvoice.paymentMethod}</p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</h4>
                  <p className="font-bold text-black">{selectedInvoice.customerName}</p>
                  <p className="text-gray-500 mt-1">{selectedInvoice.address}, {selectedInvoice.city} - {selectedInvoice.pincode}</p>
                  <p className="text-gray-500 mt-1">Phone: {selectedInvoice.phone}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Discount</th>
                    <th className="py-2 text-right">GST</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedInvoice.items?.map((item, idx) => {
                    const qty = item.quantity || 1;
                    const eff = item.effectivePrice || item.price || 0;
                    const orig = item.price || item.effectivePrice || 0;
                    const disc = orig > eff ? (orig - eff) * qty : 0;
                    return (
                      <tr key={idx}>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={getOptimizedImage(item.image, 'thumbnail')}
                                alt={item.name}
                                loading="lazy"
                                className="w-8 h-8 rounded object-cover border border-gray-100"
                              />
                            )}
                            <span className="font-bold text-gray-800">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-center text-gray-600">{qty}</td>
                        <td className="py-3 text-right text-gray-600">Rs.{(eff / 1.18).toFixed(2)}</td>
                        <td className="py-3 text-right text-red-500">-Rs.{(disc / 1.18).toFixed(2)}</td>
                        <td className="py-3 text-right text-gray-600">Rs.{(eff - (eff / 1.18)).toFixed(2)}</td>
                        <td className="py-3 text-right font-bold text-gray-800">Rs.{(eff * qty).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary */}
              <div className="flex justify-end pt-4">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal (excl. GST):</span>
                    <span>Rs.{(selectedInvoice.pricing?.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {selectedInvoice.pricing?.discount > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Discount (excl. GST):</span>
                      <span>-Rs.{(selectedInvoice.pricing?.discount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping:</span>
                    <span>Rs.{(selectedInvoice.pricing?.shipping || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>GST (18%):</span>
                    <span>Rs.{(selectedInvoice.pricing?.gst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-base text-black pt-2 border-t border-gray-200">
                    <span>Grand Total:</span>
                    <span>Rs.{(selectedInvoice.pricing?.grandTotal || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => generateInvoice({ ...selectedInvoice, id: selectedInvoice.orderId }, { action: 'print' })}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                <Printer size={14} /> Print
              </button>
              <button
                type="button"
                onClick={() => generateInvoice({ ...selectedInvoice, id: selectedInvoice.orderId }, { action: 'download' })}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesManage;
