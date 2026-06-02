import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, X, Info } from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
  const resolvedType = ['success', 'error', 'info'].includes(type) ? type : 'info';

  const iconMap = {
    success: <CheckCircle className="text-yellow-500" size={18} />,
    error: <XCircle className="text-red-500" size={18} />,
    info: <Info className="text-blue-400" size={18} />,
  };

  const bgMap = {
    success: 'border-yellow-500/20 bg-gray-950 shadow-yellow-500/5',
    error: 'border-red-500/20 bg-gray-950 shadow-red-500/5',
    info: 'border-blue-500/20 bg-gray-950 shadow-blue-500/5',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-2xl min-w-[300px] max-w-md backdrop-blur-xl ${bgMap[resolvedType]}`}
    >
      <div className="flex-shrink-0">
        {iconMap[resolvedType]}
      </div>
      <div className="flex-1">
        <p className="text-xs font-black text-white uppercase tracking-widest leading-tight">{message}</p>
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-gray-700 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export default Toast;