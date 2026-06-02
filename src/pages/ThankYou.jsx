import React, { useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Download, Package, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { generateInvoice } from "../utils/invoiceGenerator";

const ThankYou = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // orderData is the full order payload; orderId / total / items are kept for backward-compat
  const { orderId, total, items = [], orderData } = location.state || {};

  useEffect(() => {
    if (!orderId) {
      navigate('/', { replace: true });
      return;
    }

    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, [orderId, navigate]);

  const handleDownloadInvoice = async () => {
    if (!orderId) return;
    // Use the full orderData if passed via state (auto-set by Checkout), otherwise fall back
    const order = orderData
      ? { ...orderData, id: orderId }
      : { id: orderId, totalPrice: total, customerName: 'Customer', createdAt: { toDate: () => new Date() }, items };
    await generateInvoice(order);
  };

  const shortId = orderId?.slice(-8).toUpperCase() ?? '';
  const supportMessage = `Hi SMKP TRADERS, I just placed an order (#${shortId}). I need some assistance with my purchase.`;
  const whatsappUrl = `https://wa.me/919677417185?text=${encodeURIComponent(supportMessage)}`;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20 bg-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-gray-900/60 backdrop-blur-xl rounded-[3rem] shadow-2xl p-12 text-center border border-yellow-900/20 relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-28 h-28 bg-yellow-500 text-black rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-yellow-500/30 relative z-10">
          <CheckCircle size={52} />
        </div>

        <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.6em] mb-4 relative z-10">
          Order Confirmed
        </p>
        <h1 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase relative z-10">
          Order Placed
        </h1>
        <p className="text-gray-500 font-medium mb-12 text-sm uppercase tracking-widest leading-relaxed relative z-10">
          Order <span className="text-yellow-500 font-black">#{shortId}</span> has been successfully placed.
        </p>

        <div className="bg-black/50 rounded-[2rem] p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-6 border border-yellow-900/10 relative z-10">
          <div className="text-left">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Payment Mode</p>
            <p className="font-black text-white uppercase tracking-widest text-xs">Cash on Delivery</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">Total Amount</p>
            <p className="text-4xl font-black text-yellow-400 tracking-tighter">
              ₹{total?.toLocaleString() ?? '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14 relative z-10">
          <Link
            to="/my-orders"
            className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[9px] hover:border-yellow-500/30 transition-all active:scale-95"
          >
            <Package size={16} /> My Orders
          </Link>
          <Link
            to="/products"
            className="flex items-center justify-center gap-3 bg-yellow-500 text-black py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[9px] hover:bg-yellow-400 transition-all active:scale-95 shadow-2xl shadow-yellow-500/20"
          >
            Browse More <ArrowRight size={16} />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-12 pt-10 border-t border-white/5 relative z-10">
          <button
            onClick={handleDownloadInvoice}
            className="flex flex-col items-center gap-3 group outline-none"
          >
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-gray-600 group-hover:text-yellow-500 group-hover:border-yellow-500/30 transition-all">
              <Download size={20} />
            </div>
            <span className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em]">Invoice</span>
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 group outline-none"
          >
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-gray-600 group-hover:text-yellow-500 group-hover:border-yellow-500/30 transition-all">
              <Smartphone size={20} />
            </div>
            <span className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em]">Support</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default ThankYou;