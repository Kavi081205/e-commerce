import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, Package, Truck, ShoppingBag } from 'lucide-react';

const STEPS = [
  { id: 'ordered', label: 'Order Placed', icon: Clock },
  { id: 'processing', label: 'Processing', icon: ShoppingBag },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const OrderTracker = ({ currentStatus = 'ordered' }) => {
  const currentIdx = STEPS.findIndex(s => s.id === currentStatus?.toLowerCase());

  return (
    <div className="w-full bg-black rounded-xl py-8 px-4">
      <div className="relative flex justify-between items-start">

        {/* Track line */}
        <div className="absolute top-[22px] left-0 w-full h-[2px] bg-white/5 z-0">
          <div
            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(0, (currentIdx / (STEPS.length - 1)) * 100)}%` }}
          />
        </div>

        {STEPS.map((step, idx) => {
          const isCompleted = idx <= currentIdx;
          const isActive = idx === currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
              <div
                className={[
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 border-2',
                  isCompleted
                    ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_16px_rgba(234,179,8,0.4)]'
                    : 'bg-black border-white/10 text-gray-700',
                  isActive ? 'scale-125 ring-4 ring-yellow-500/20' : '',
                ].join(' ')}
              >
                {isCompleted ? <Icon size={18} /> : <Circle size={14} />}
              </div>

              <div className="mt-4 text-center px-1">
                <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isCompleted ? 'text-white' : 'text-gray-700'}`}>
                  {step.label}
                </p>
                {isActive && (
                  <p className="text-[8px] font-bold mt-1 animate-pulse uppercase tracking-tighter text-yellow-500">
                    Current
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderTracker;