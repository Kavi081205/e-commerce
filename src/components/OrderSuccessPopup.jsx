import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Package, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const OrderSuccessPopup = ({ orderId, total, onClose }) => {
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(true);

  /* ── Confetti auto-stop (already had cleanup — kept as-is) ── */
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  /* ── FIX 3: safe orderId display — coerce to string first ─── */
  const displayId = orderId
    ? String(orderId).slice(-8).toUpperCase()
    : '--------';

  /* ── FIX 4: total fallback ────────────────────────────────── */
  const displayTotal =
    total != null ? Number(total).toLocaleString() : '—';

  /* ── FIX 5: navigate first, then close so we don't call      
     navigate on an unmounted component ─────────────────────── */
  const handleNavigate = useCallback((path) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  return (
    /* ── FIX 1: AnimatePresence wraps the whole popup so exit   
       animations actually play when the parent removes it ───── */
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* FIX 2: Confetti given explicit z-index below the modal */}
        {showConfetti && (
          <div className="fixed inset-0 z-[110] pointer-events-none">
            <Confetti
              width={width}
              height={height}
              numberOfPieces={200}
              recycle={false}
              colors={['#facc15', '#eab308', '#ffffff', '#d4af37', '#fef3c7']}
            />
          </div>
        )}

        {/* Modal Card — z-[120] sits above confetti */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          className="bg-gray-950 w-full max-w-md rounded-[3rem] p-10 md:p-12 shadow-2xl relative z-[120] text-center border border-yellow-900/20 overflow-hidden"
        >
          {/* Ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-6 right-6 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-600 hover:text-white transition-all"
          >
            <X size={18} />
          </button>

          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.2 }}
            className="w-24 h-24 bg-yellow-500 text-black rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-yellow-500/30 relative z-10"
          >
            <CheckCircle size={44} />
          </motion.div>

          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.5em] mb-3">
            Order Confirmed
          </p>
          <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">
            Order Placed
          </h2>
          <p className="text-gray-500 font-medium mb-10 text-xs px-4 uppercase tracking-widest leading-relaxed">
            Reference ID{' '}
            {/* FIX 3: safe string display */}
            <span className="text-yellow-500 font-black">#{displayId}</span>{' '}
            has been successfully placed.
          </p>

          {/* Summary card */}
          <div className="bg-black/60 rounded-[2rem] p-8 mb-10 border border-yellow-900/10">
            <div className="grid grid-cols-2 gap-6 divide-x divide-white/5">
              <div className="text-left pr-6">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-2">
                  Payment Mode
                </span>
                <p className="text-xs font-black text-white uppercase tracking-widest">
                  Cash On Delivery
                </p>
              </div>
              <div className="text-right pl-6">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-2">
                  Total Amount
                </span>
                {/* FIX 4: fallback when total is undefined */}
                <p className="text-3xl font-black gold-text tracking-tighter">
                  ₹{displayTotal}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons — FIX 5: navigate() before onClose() */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleNavigate('/my-orders')}
              className="w-full bg-white/5 border border-white/10 hover:border-yellow-500/30 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-[9px] active:scale-95 transition-all"
            >
              <Package size={16} /> My Orders
            </button>
            <button
              onClick={() => handleNavigate('/')}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-[9px] shadow-2xl shadow-yellow-500/20 active:scale-95 transition-all"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OrderSuccessPopup;