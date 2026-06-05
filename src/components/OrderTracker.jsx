import React from 'react';
import { CheckCircle2, Circle, Clock, Truck, ShoppingBag } from 'lucide-react';

const STEPS = [
  { id: 'ordered', label: 'Order Placed', icon: Clock },
  { id: 'processing', label: 'Processing', icon: ShoppingBag },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const OrderTracker = ({ currentStatus = 'ordered' }) => {
  const currentIdx = STEPS.findIndex(s => s.id === currentStatus?.toLowerCase());

  return (
    <div className="w-full bg-black/40 rounded-xl py-5 px-3 md:px-6">
      <div className="relative flex justify-between items-start">

        {/* Track line */}
        <div className="absolute top-[16px] left-[10%] right-[10%] h-[2px] bg-neutral-800 z-0">
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
              {/* Node Circle */}
              <div
                className={[
                  'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500 border',
                  isCompleted
                    ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                    : 'bg-black border-neutral-800 text-neutral-600',
                  isActive ? 'scale-110 ring-4 ring-yellow-500/15' : '',
                ].join(' ')}
              >
                {isCompleted ? <Icon size={14} className="md:size-16" /> : <Circle size={10} className="text-neutral-700" />}
              </div>

              {/* Step Label */}
              <div className="mt-3 text-center px-0.5">
                <p className={`text-[7px] md:text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'text-neutral-200' : 'text-neutral-600'}`}>
                  {step.label}
                </p>
                {isActive && (
                  <span className="inline-block text-[6px] md:text-[8px] font-bold mt-0.5 px-1.5 py-0.2 bg-yellow-500/10 text-yellow-500 rounded border border-yellow-500/20 uppercase tracking-wider animate-pulse">
                    Active
                  </span>
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