import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, Download, MessageCircle, Package, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function OrderConfirmation() {
  const location = useLocation();

  const { orderId, total } = location.state || {
    orderId: "ZON8IQBP",
    total: 889,
  };

  useEffect(() => {
    try {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#facc15', '#eab308', '#ffffff', '#d4af37']
      });
    } catch (error) {
      console.error("Confetti error:", error);
    }
  }, []);

  const whatsappUrl = `https://wa.me/919677417185?text=Order%20Placed%20%23${orderId}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-gray-900/60 backdrop-blur-xl max-w-[700px] w-full rounded-[3rem] shadow-2xl p-12 text-center relative mt-12 border border-yellow-900/20 overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="absolute -top-14 left-1/2 -translate-x-1/2">
          <div className="w-28 h-28 bg-yellow-500 rounded-full flex items-center justify-center shadow-2xl shadow-yellow-500/30 border-[6px] border-black">
            <CheckCircle size={48} className="text-black" />
          </div>
        </div>

        <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.6em] mb-3 mt-12 relative z-10">
          Order Confirmed
        </p>

        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter uppercase relative z-10">
          Order Placed
        </h1>

        <p className="text-gray-500 mb-12 text-xs font-black uppercase tracking-widest leading-relaxed relative z-10">
          Order <span className="text-yellow-500 font-black">#{orderId}</span> has been successfully placed.
        </p>

        <div className="bg-black/50 rounded-[2rem] p-8 flex justify-between items-center mb-12 border border-yellow-900/10 relative z-10">
          <div className="text-left">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em] mb-2">
              Payment Mode
            </p>
            <p className="text-sm font-black text-white uppercase tracking-widest">
              Cash on Delivery
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em] mb-2">
              Total Amount
            </p>
            <p className="text-4xl font-black gold-text tracking-tighter">
              Rs.{total?.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-14 relative z-10">
          <Link
            to="/my-orders"
            className="flex-1 bg-white/5 border border-white/10 hover:border-yellow-500/30 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-[9px] transition-all active:scale-95"
          >
            <Package size={16} /> My Orders
          </Link>
          <Link
            to="/"
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-5 rounded-2xl font-black shadow-2xl shadow-yellow-500/20 flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-[9px] transition-all active:scale-95"
          >
            Continue <ArrowRight size={16} />
          </Link>
        </div>

        <div className="flex justify-center gap-14 relative z-10">

          <button
            onClick={() => {
              if (orderId) {
                const orderData = {
                  id: orderId,
                  totalPrice: total,
                  customerName: "Customer",
                  createdAt: { toDate: () => new Date() },
                  items: []
                };
                import('../utils/invoiceGenerator').then(module => {
                  module.generateInvoice(orderData);
                });
              }
            }}
            className="flex flex-col items-center gap-3 group transition-all"
          >
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-gray-600 group-hover:text-yellow-500 group-hover:border-yellow-500/30 transition-all">
              <Download size={20} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-700 group-hover:text-gray-500">
              Invoice
            </span>
          </button>

          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 group transition-all">
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-gray-600 group-hover:text-yellow-500 group-hover:border-yellow-500/30 transition-all">
              <MessageCircle size={20} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-700 group-hover:text-gray-500">
              Support
            </span>
          </a>

        </div>
      </motion.div>
    </div>
  );
}