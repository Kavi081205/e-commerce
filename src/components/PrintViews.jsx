import React, { useState, useEffect } from 'react';
import { getStoreSettings } from '../firebase/services';
import { getOptimizedImage } from '../utils/cloudinary';

const DEFAULT_SETTINGS = {
  name: 'SMKP TRADERS',
  ownerName: 'Kaviyarasan Murugan',
  phone: '9677417185',
  email: 'kaviyarasanmurugan78@gmail.com',
  address: 'Pommalappatti',
  state: 'Tamil Nadu',
  country: 'India',
  gstin: '33IMVPM1670M1Z9'
};

export const InvoicePrintView = ({ order }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getStoreSettings();
        if (data) {
          setSettings({
            name: data.name || DEFAULT_SETTINGS.name,
            ownerName: data.ownerName || DEFAULT_SETTINGS.ownerName,
            phone: data.phone || DEFAULT_SETTINGS.phone,
            email: data.email || DEFAULT_SETTINGS.email,
            address: data.address || DEFAULT_SETTINGS.address,
            state: data.state || DEFAULT_SETTINGS.state,
            country: data.country || DEFAULT_SETTINGS.country,
            gstin: data.gstin || DEFAULT_SETTINGS.gstin
          });
        }
      } catch (err) {
        console.warn('Failed to load store settings for printing:', err);
      }
    };
    fetchSettings();
  }, []);

  if (!order) return null;

  // Safe parsing of customer details
  const customer = {
    name: order.customerDetails?.name || order.customerName || order.name || 'Guest',
    phone: order.customerDetails?.phone || order.phone || '',
    email: order.customerDetails?.email || order.userEmail || '',
    address: order.customerDetails?.address || order.address || '',
    district: order.customerDetails?.district || '',
    state: order.customerDetails?.state || order.state || '',
    pincode: order.customerDetails?.pincode || order.pincode || '',
    landmark: order.customerDetails?.landmark || order.landmark || ''
  };

  // Safe parsing of items
  const items = (order.orderedItems || order.items || []).map((item, idx) => {
    const price = Number(item.effectivePrice || item.price || 0);
    const qty = Number(item.quantity || 1);
    return {
      id: item.productId || item.id || `item-${idx}`,
      name: item.productName || item.name || 'Unknown Product',
      image: item.image || '',
      color: item.color || '',
      size: item.size || '',
      quantity: qty,
      price: price,
      total: Number(item.total || (price * qty))
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const couponDiscount = Number(order.couponDiscount || 0);
  const grandTotal = order.totalPrice !== undefined ? Number(order.totalPrice) : Math.max(0, subtotal + deliveryCharge - couponDiscount);

  // GST splits (18% inclusive)
  const gstTotal = subtotal - (subtotal / 1.18);
  const cgst = gstTotal / 2;
  const sgst = gstTotal / 2;

  const orderDate = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleString('en-IN')
    : order.createdAt
      ? new Date(order.createdAt).toLocaleString('en-IN')
      : new Date().toLocaleString('en-IN');

  const invoiceNo = order.invoiceNumber || `INV-${order.id.slice(-8).toUpperCase()}`;

  return (
    <div className="w-full text-black bg-white font-sans p-8 print:p-0 space-y-6">
      {/* Header Banner */}
      <div className="flex justify-between items-start border-b-2 border-yellow-500 pb-6">
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tight">{settings.name}</h1>
          <p className="text-xs text-gray-600 mt-1">Owner: {settings.ownerName} | Phone: {settings.phone}</p>
          <p className="text-xs text-gray-600">Email: {settings.email}</p>
          <p className="text-xs text-gray-600">Address: {settings.address}, {settings.state}, {settings.country}</p>
          <p className="text-xs font-bold text-slate-900 mt-1">GSTIN: {settings.gstin}</p>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-full text-xs font-black uppercase tracking-wider">
            Tax Invoice
          </span>
          <p className="text-sm font-mono font-bold text-slate-950 mt-4">Invoice No: {invoiceNo}</p>
          <p className="text-xs text-gray-500 mt-1">Date: {orderDate}</p>
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs">
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Order ID</span>
          <span className="font-mono text-slate-950 font-bold">#{order.id.toUpperCase()}</span>
        </div>
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Payment Method</span>
          <span className="text-slate-950 font-bold uppercase">{order.paymentMethod || 'COD'}</span>
        </div>
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Payment Status</span>
          <span className={`font-black uppercase ${order.paymentStatus?.toLowerCase() === 'paid' ? 'text-green-700' : 'text-orange-600'}`}>
            {order.paymentStatus || 'Pending'}
          </span>
        </div>
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Est. Delivery</span>
          <span className="text-slate-950 font-bold">
            {order.estimatedDeliveryDays ? `${order.estimatedDeliveryDays} Days` : 'Standard'}
          </span>
        </div>
      </div>

      {/* FROM/TO Address Section */}
      <div className="grid grid-cols-2 gap-6 text-xs">
        {/* FROM */}
        <div className="p-4 border border-yellow-200 bg-yellow-50/20 rounded-xl">
          <h4 className="font-black text-yellow-800 uppercase tracking-wider mb-2 border-b border-yellow-100 pb-1">
            Sender (From)
          </h4>
          <p className="font-bold text-slate-900">{settings.name}</p>
          <p className="text-gray-600 mt-0.5">Owner: {settings.ownerName}</p>
          <p className="text-gray-600">Phone: {settings.phone}</p>
          <p className="text-gray-600">Email: {settings.email}</p>
          <p className="text-gray-600">Address: {settings.address}, {settings.state}, {settings.country}</p>
        </div>

        {/* TO */}
        <div className="p-4 border border-gray-200 bg-gray-50/30 rounded-xl">
          <h4 className="font-black text-slate-700 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">
            Ship To (Receiver)
          </h4>
          <p className="font-bold text-slate-900">{customer.name}</p>
          <p className="text-slate-900 font-bold">Phone: {customer.phone}</p>
          {customer.email && <p className="text-gray-600">Email: {customer.email}</p>}
          <p className="text-gray-600">{customer.address}</p>
          {customer.landmark && <p className="text-gray-500 font-medium">Landmark: {customer.landmark}</p>}
          <p className="text-slate-900 font-bold">
            {customer.district ? `${customer.district}, ` : ''}{customer.state} - {customer.pincode}
          </p>
        </div>
      </div>

      {/* Courier Notes */}
      {(order.courierNotes || order.instructions) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <div>
            <strong className="uppercase tracking-wider text-[9px] block mb-0.5">Courier Notes / Special Instructions</strong>
            <span>{order.courierNotes || order.instructions}</span>
          </div>
        </div>
      )}

      {/* Products Table */}
      <table className="w-full text-xs text-left border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200 text-slate-700 font-bold uppercase text-[9px] tracking-wider">
            <th className="p-3 border-r border-gray-200">Item Details</th>
            <th className="p-3 text-center border-r border-gray-200">Qty</th>
            <th className="p-3 text-right border-r border-gray-200">Taxable Val</th>
            <th className="p-3 text-right border-r border-gray-200">GST (18%)</th>
            <th className="p-3 text-right">Total Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => {
            const displayColor = typeof item.color === 'object' ? item.color.name : item.color;
            const details = [displayColor, item.size].filter(Boolean).join(' / ');
            return (
              <tr key={item.id} className="text-slate-800">
                <td className="p-3 border-r border-gray-200">
                  <div className="font-bold">{item.name}</div>
                  {details && <div className="text-[10px] text-gray-500 mt-0.5">{details}</div>}
                </td>
                <td className="p-3 text-center border-r border-gray-200 font-medium">{item.quantity}</td>
                <td className="p-3 text-right border-r border-gray-200 font-mono">₹{(item.price / 1.18).toFixed(2)}</td>
                <td className="p-3 text-right border-r border-gray-200 font-mono">₹{(item.price - (item.price / 1.18)).toFixed(2)}</td>
                <td className="p-3 text-right font-bold font-mono">₹{item.total.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Price Summary */}
      <div className="flex justify-end pt-4">
        <div className="w-72 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Taxable Subtotal:</span>
            <span className="font-mono">₹{(subtotal / 1.18).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>CGST (9%):</span>
            <span className="font-mono">₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>SGST (9%):</span>
            <span className="font-mono">₹{sgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Shipping Charges:</span>
            <span className="font-mono">₹{deliveryCharge.toFixed(2)}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Coupon Discount:</span>
              <span className="font-mono">-₹{couponDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t-2 border-gray-200">
            <span>GRAND TOTAL:</span>
            <span className="font-mono text-base text-yellow-600">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-6 text-center text-[10px] text-gray-400 space-y-1">
        <p>This is a computer generated invoice and does not require a signature.</p>
        <p className="font-bold uppercase">Thank you for shopping with {settings.name}!</p>
      </div>
    </div>
  );
};

export const LabelPrintView = ({ order }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getStoreSettings();
        if (data) {
          setSettings({
            name: data.name || DEFAULT_SETTINGS.name,
            ownerName: data.ownerName || DEFAULT_SETTINGS.ownerName,
            phone: data.phone || DEFAULT_SETTINGS.phone,
            email: data.email || DEFAULT_SETTINGS.email,
            address: data.address || DEFAULT_SETTINGS.address,
            state: data.state || DEFAULT_SETTINGS.state,
            country: data.country || DEFAULT_SETTINGS.country,
            gstin: data.gstin || DEFAULT_SETTINGS.gstin
          });
        }
      } catch (err) {
        console.warn('Failed to load store settings for printing:', err);
      }
    };
    fetchSettings();
  }, []);

  if (!order) return null;

  const customer = {
    name: order.customerDetails?.name || order.customerName || order.name || 'Guest',
    phone: order.customerDetails?.phone || order.phone || '',
    email: order.customerDetails?.email || order.userEmail || '',
    address: order.customerDetails?.address || order.address || '',
    district: order.customerDetails?.district || '',
    state: order.customerDetails?.state || order.state || '',
    pincode: order.customerDetails?.pincode || order.pincode || '',
    landmark: order.customerDetails?.landmark || order.landmark || ''
  };

  const items = (order.orderedItems || order.items || []).map((item, idx) => {
    return {
      name: item.productName || item.name || 'Product',
      quantity: Number(item.quantity || 1),
      color: item.color || '',
      size: item.size || ''
    };
  });

  // Product summary string
  const productSummary = items.map(i => {
    const details = [i.color, i.size].filter(Boolean).join('/');
    return `${i.name}${details ? ` (${details})` : ''} x ${i.quantity}`;
  }).join(', ');

  const isOnline = (order.paymentMethod || '').toUpperCase() === 'ONLINE' || (order.paymentMethod || '').toUpperCase() === 'RAZORPAY';

  return (
    <div className="w-[100mm] min-h-[150mm] text-black bg-white font-sans p-6 border-2 border-black flex flex-col justify-between box-border">
      <div>
        {/* Label Header */}
        <div className="border-b-2 border-black pb-3 text-center">
          <h2 className="text-base font-black uppercase tracking-wider">{settings.name}</h2>
          <p className="text-[9px] text-gray-600">Sender: {settings.ownerName} | Ph: {settings.phone}</p>
          <p className="text-[9px] text-gray-600 truncate">{settings.address}, {settings.state}</p>
        </div>

        {/* Tracking block bar */}
        <div className="my-4 py-2 border-b-2 border-black text-center space-y-1">
          {/* Faux Barcode pattern */}
          <div className="flex justify-center items-center gap-[1px] h-10 w-full bg-black overflow-hidden mb-1 opacity-80" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, #fff, #fff 2px, #000 2px, #000 6px, #fff 6px, #fff 7px, #000 7px, #000 9px)'
          }} />
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
            AWB: SMKP-{order.id.slice(-8).toUpperCase()}
          </span>
        </div>

        {/* SHIP TO (RECEIVER DETAILS) */}
        <div className="space-y-2 text-left">
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block">Ship To (Receiver):</span>
          <h3 className="text-base font-black uppercase leading-tight text-slate-900">{customer.name}</h3>
          
          <div className="text-[10px] text-slate-800 space-y-1 font-medium leading-relaxed">
            <p className="text-xs font-black text-black">Phone: {customer.phone}</p>
            {customer.email && <p className="text-gray-500">Email: {customer.email}</p>}
            <p className="text-slate-700">{customer.address}</p>
            {customer.landmark && <p className="text-gray-500 text-[9px]">Landmark: {customer.landmark}</p>}
            <p className="text-slate-900 font-bold text-xs uppercase tracking-wide">
              {customer.district ? `${customer.district}, ` : ''}{customer.state} - {customer.pincode}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        {/* Product Summary Section */}
        <div className="border-t border-dashed border-gray-300 pt-3 text-left">
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block mb-1">Items Description:</span>
          <p className="text-[10px] font-bold text-slate-800 line-clamp-3 leading-relaxed">
            {productSummary}
          </p>
        </div>

        {/* Courier Notes */}
        {(order.courierNotes || order.instructions) && (
          <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg text-left">
            <span className="text-[7px] font-black text-amber-700 uppercase tracking-widest block mb-0.5">Instructions:</span>
            <p className="text-[9px] font-bold text-amber-900 leading-tight">
              {order.courierNotes || order.instructions}
            </p>
          </div>
        )}

        {/* Pricing tag block */}
        <div className="border-2 border-black p-3 bg-gray-50 flex justify-between items-center">
          <div>
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block">Payment Mode</span>
            <span className={`text-xs font-black uppercase ${isOnline ? 'text-green-700' : 'text-orange-700'}`}>
              {isOnline ? 'PREPAID - ONLINE' : 'COD - CASH ON DELIVERY'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block">Amount Due</span>
            <span className="text-sm font-black font-mono">₹{(order.totalPrice || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
