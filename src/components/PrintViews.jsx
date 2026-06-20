import React, { useState, useEffect } from 'react';
import { getStoreSettings } from '../firebase/services';
import { getOptimizedImage } from '../utils/cloudinary';

const LOGO_URL = '/logo.png';

const DEFAULT_SETTINGS = {
  name: 'SMKP TRADERS',
  ownerName: 'Kaviyarasan Murugan',
  phone: '9677417185',
  email: 'kaviyarasanmurugan78@gmail.com',
  address: 'Pommalappatti',
  state: 'Tamil Nadu',
  country: 'India'
};

// ─── Gold fallback badge (SVG inline) ────────────────────────────────────────
const FallbackBadge = ({ size = 56, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="SMKP TRADERS logo fallback"
  >
    <circle cx="28" cy="28" r="28" fill="#D4AF37" />
    <circle cx="28" cy="28" r="24" fill="#0f0f0f" />
    <text
      x="28"
      y="33"
      textAnchor="middle"
      fontFamily="Helvetica, Arial, sans-serif"
      fontWeight="900"
      fontSize="13"
      fill="#D4AF37"
      letterSpacing="1"
    >
      SMKP
    </text>
  </svg>
);

// ─── Shared Logo Component ────────────────────────────────────────────────────
const BrandLogo = ({ size = 56, className = '' }) => {
  const [logoError, setLogoError] = useState(false);
  return logoError ? (
    <FallbackBadge size={size} className={className} />
  ) : (
    <img
      src={LOGO_URL}
      alt="SMKP TRADERS Logo"
      width={size}
      height={size}
      onError={() => setLogoError(true)}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      className={className}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  INVOICE PRINT VIEW
// ─────────────────────────────────────────────────────────────────────────────
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
            country: data.country || DEFAULT_SETTINGS.country
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
    const price = Number(item.effectivePrice || item.price || 0);
    const qty   = Number(item.quantity || 1);
    return {
      id: item.productId || item.id || `item-${idx}`,
      name: item.productName || item.name || 'Unknown Product',
      image: item.image || '',
      color: item.color || '',
      size: item.size || '',
      quantity: qty,
      price,
      total: Number(item.total || (price * qty))
    };
  });

  const subtotal       = items.reduce((sum, item) => sum + item.total, 0);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const couponDiscount = Number(order.couponDiscount || 0);
  const grandTotal     = order.totalPrice !== undefined
    ? Number(order.totalPrice)
    : Math.max(0, subtotal + deliveryCharge - couponDiscount);

  const orderDate = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleString('en-IN')
    : order.createdAt
      ? new Date(order.createdAt).toLocaleString('en-IN')
      : new Date().toLocaleString('en-IN');

  const invoiceNo = order.invoiceNumber || `INV-${order.id.slice(-8).toUpperCase()}`;

  return (
    <div className="w-full text-black bg-white font-sans print:p-0 space-y-0">
      {/* ── BRANDED HEADER ─────────────────────────────────────────────── */}
      <div className="bg-[#0f0f0f] text-white px-6 py-4 flex items-center justify-between print:bg-[#0f0f0f] print:text-white">
        {/* Left: Logo + Name */}
        <div className="flex items-center gap-4">
          <BrandLogo size={56} />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-white leading-tight">
              {settings.name}
            </h1>
            <p className="text-[11px] font-semibold text-yellow-400 tracking-widest uppercase mt-0.5">
              Premium E-Commerce Store
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Ph: {settings.phone} &nbsp;|&nbsp; {settings.email}
            </p>
            <p className="text-[10px] text-gray-400">
              {settings.address}, {settings.state}, {settings.country}
            </p>
          </div>
        </div>

        {/* Right: Invoice badge + number */}
        <div className="text-right flex-shrink-0">
          <span className="inline-block px-3 py-1 bg-yellow-500 text-[#0f0f0f] rounded text-[10px] font-black uppercase tracking-widest">
            Retail Invoice
          </span>
          <p className="text-sm font-mono font-bold text-white mt-3">
            {invoiceNo}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">{orderDate}</p>
        </div>
      </div>

      {/* Gold accent stripe */}
      <div className="h-1 bg-yellow-500 w-full print:bg-yellow-500" />

      {/* ── METADATA STRIP ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs">
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Order ID</span>
          <span className="font-mono text-slate-900 font-bold">#{order.id.toUpperCase()}</span>
        </div>
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Payment Method</span>
          <span className="text-slate-900 font-bold uppercase">{order.paymentMethod || 'COD'}</span>
        </div>
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Payment Status</span>
          <span className={`font-black uppercase ${order.paymentStatus?.toLowerCase() === 'paid' ? 'text-green-700' : 'text-orange-600'}`}>
            {order.paymentStatus || 'Pending'}
          </span>
        </div>
        <div>
          <span className="font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Est. Delivery</span>
          <span className="text-slate-900 font-bold">
            {order.estimatedDeliveryDays ? `${order.estimatedDeliveryDays} Days` : 'Standard'}
          </span>
        </div>
      </div>

      {/* ── ADDRESS SECTION ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-0 text-xs border-b border-gray-200">
        {/* FROM */}
        <div className="p-5 border-r border-gray-200 bg-yellow-50/30">
          <h4 className="font-black text-yellow-700 uppercase tracking-wider mb-2 text-[9px] border-b border-yellow-100 pb-1">
            Sender (From)
          </h4>
          <p className="font-bold text-slate-900">{settings.name}</p>
          <p className="text-gray-600 mt-0.5">Ph: {settings.phone}</p>
          <p className="text-gray-600">Email: {settings.email}</p>
          <p className="text-gray-600">{settings.address}, {settings.state}, {settings.country}</p>
        </div>
        {/* TO */}
        <div className="p-5">
          <h4 className="font-black text-slate-600 uppercase tracking-wider mb-2 text-[9px] border-b border-gray-100 pb-1">
            Ship To (Receiver)
          </h4>
          <p className="font-bold text-slate-900">{customer.name}</p>
          <p className="text-slate-900 font-bold">Ph: {customer.phone}</p>
          {customer.email && <p className="text-gray-600">Email: {customer.email}</p>}
          <p className="text-gray-600">{customer.address}</p>
          {customer.landmark && <p className="text-gray-500">Landmark: {customer.landmark}</p>}
          <p className="text-slate-900 font-bold">
            {customer.district ? `${customer.district}, ` : ''}{customer.state} - {customer.pincode}
          </p>
        </div>
      </div>

      {/* ── COURIER NOTES ──────────────────────────────────────────────── */}
      {(order.courierNotes || order.instructions) && (
        <div className="mx-6 my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <div>
            <strong className="uppercase tracking-wider text-[9px] block mb-0.5">Courier Notes</strong>
            <span>{order.courierNotes || order.instructions}</span>
          </div>
        </div>
      )}

      {/* ── PRODUCTS TABLE ─────────────────────────────────────────────── */}
      <div className="px-6 pb-2 pt-4">
        <table className="w-full text-xs text-left border-collapse border border-gray-200">
          <thead>
            <tr className="bg-[#0f0f0f] text-yellow-400 font-bold uppercase text-[9px] tracking-wider">
              <th className="p-3 border-r border-yellow-900/20">Item Details</th>
              <th className="p-3 text-center border-r border-yellow-900/20">Qty</th>
              <th className="p-3 text-right border-r border-yellow-900/20">Unit Price</th>
              <th className="p-3 text-right">Total Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const displayColor = typeof item.color === 'object' ? item.color.name : item.color;
              const details = [displayColor, item.size].filter(Boolean).join(' / ');
              return (
                <tr key={item.id} className="text-slate-800 hover:bg-gray-50">
                  <td className="p-3 border-r border-gray-200">
                    <div className="flex items-center gap-2">
                      {item.image && (
                        <img
                          src={getOptimizedImage(item.image, 'thumbnail')}
                          alt={item.name}
                          loading="lazy"
                          className="w-8 h-8 rounded object-cover border border-gray-100 no-print"
                        />
                      )}
                      <div>
                        <div className="font-bold">{item.name}</div>
                        {details && <div className="text-[10px] text-gray-500 mt-0.5">{details}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center border-r border-gray-200 font-medium">{item.quantity}</td>
                  <td className="p-3 text-right border-r border-gray-200 font-mono">₹{item.price.toFixed(2)}</td>
                  <td className="p-3 text-right font-bold font-mono">₹{item.total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── PRICE SUMMARY ──────────────────────────────────────────────── */}
      <div className="flex justify-end px-6 pb-4 pt-2">
        <div className="w-72 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span className="font-mono">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Shipping Charge:</span>
            <span className="font-mono">₹{deliveryCharge.toFixed(2)}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Coupon Discount:</span>
              <span className="font-mono">-₹{couponDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t-2 border-yellow-400">
            <span>GRAND TOTAL:</span>
            <span className="font-mono text-base text-yellow-600">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0f0f0f] text-center py-4 space-y-1 print:bg-[#0f0f0f]">
        <p className="text-[10px] text-gray-400">
          This is a computer-generated invoice. No signature required.
        </p>
        <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
          Thank you for shopping with {settings.name}!
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  SHIPPING LABEL PRINT VIEW
// ─────────────────────────────────────────────────────────────────────────────
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
            country: data.country || DEFAULT_SETTINGS.country
          });
        }
      } catch (err) {
        console.warn('Failed to load store settings for label printing:', err);
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

  const items = (order.orderedItems || order.items || []).map((item) => ({
    name: item.productName || item.name || 'Product',
    quantity: Number(item.quantity || 1),
    color: item.color || '',
    size: item.size || ''
  }));

  const productSummary = items.map(i => {
    const details = [i.color, i.size].filter(Boolean).join('/');
    return `${i.name}${details ? ` (${details})` : ''} x ${i.quantity}`;
  }).join(', ');

  const isOnline = (order.paymentMethod || '').toUpperCase() === 'ONLINE' ||
                   (order.paymentMethod || '').toUpperCase() === 'RAZORPAY';

  return (
    <div className="w-[100mm] min-h-[150mm] text-black bg-white font-sans border-2 border-black flex flex-col justify-between box-border overflow-hidden">
      
      {/* ── BRANDED HEADER ─────────────────────────────────────────────── */}
      <div className="bg-[#0f0f0f] text-white px-3 py-2.5 flex items-center gap-2.5 print:bg-[#0f0f0f]">
        <BrandLogo size={40} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-white leading-tight truncate">
            {settings.name}
          </h2>
          <p className="text-[8px] font-semibold text-yellow-400 tracking-widest uppercase mt-0.5">
            Premium E-Commerce Store
          </p>
          <p className="text-[8px] text-gray-400 mt-0.5 truncate">
            {settings.ownerName} | Ph: {settings.phone}
          </p>
          <p className="text-[7px] text-gray-500 truncate">{settings.address}, {settings.state}</p>
        </div>
      </div>

      {/* Gold stripe */}
      <div className="h-0.5 bg-yellow-500 w-full print:bg-yellow-500" />

      <div className="px-3 flex-1 flex flex-col">
        {/* ── BARCODE / TRACKING ─────────────────────────────────────────── */}
        <div className="my-3 text-center space-y-1">
          {/* CSS barcode pattern */}
          <div
            className="h-10 w-full mb-1"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #fff, #fff 2px, #000 2px, #000 6px, #fff 6px, #fff 7px, #000 7px, #000 9px)'
            }}
          />
          <span className="text-[10px] font-mono font-black tracking-widest uppercase">
            AWB: SMKP-{order.id.slice(-8).toUpperCase()}
          </span>
        </div>

        <div className="border-t border-dashed border-gray-300 mb-2" />

        {/* ── SHIP TO ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5 text-left">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">
            Ship To (Receiver):
          </span>
          <h3 className="text-sm font-black uppercase leading-tight text-slate-900">
            {customer.name}
          </h3>
          <div className="text-[10px] text-slate-800 space-y-0.5 font-medium">
            <p className="text-xs font-black text-black">Ph: {customer.phone}</p>
            {customer.email && <p className="text-gray-500">{customer.email}</p>}
            <p className="text-slate-700">{customer.address}</p>
            {customer.landmark && (
              <p className="text-gray-500 text-[9px]">Landmark: {customer.landmark}</p>
            )}
            <p className="text-slate-900 font-bold text-[10px] uppercase tracking-wide">
              {customer.district ? `${customer.district}, ` : ''}
              {customer.state} - {customer.pincode}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* ── ITEMS DESCRIPTION ─────────────────────────────────────────── */}
        <div className="border-t border-dashed border-gray-200 pt-2 mt-2 text-left">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">
            Items:
          </span>
          <p className="text-[10px] font-bold text-slate-800 line-clamp-3 leading-relaxed">
            {productSummary}
          </p>
        </div>

        {/* ── COURIER NOTES ────────────────────────────────────────────── */}
        {(order.courierNotes || order.instructions) && (
          <div className="mt-1.5 bg-amber-50 border border-amber-200 p-2 rounded text-left">
            <span className="text-[7px] font-black text-amber-700 uppercase tracking-widest block mb-0.5">
              Instructions:
            </span>
            <p className="text-[9px] font-bold text-amber-900 leading-tight">
              {order.courierNotes || order.instructions}
            </p>
          </div>
        )}

        {/* ── PAYMENT BOX ──────────────────────────────────────────────── */}
        <div className="mt-2 mb-1 border-2 border-black p-2.5 bg-gray-50 flex justify-between items-center">
          <div>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Payment</span>
            <span className={`text-xs font-black uppercase ${isOnline ? 'text-green-700' : 'text-orange-700'}`}>
              {isOnline ? 'PREPAID' : 'COD'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Amount</span>
            <span className="text-sm font-black font-mono">₹{(order.totalPrice || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
