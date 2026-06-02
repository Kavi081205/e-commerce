import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Zap, Clock, AlertCircle } from 'lucide-react';

const CampaignExpiryManager = ({ initialDate, onDateChange, id = 'campaign-expiry' }) => {
  const [expiryDate, setExpiryDate] = useState(initialDate || '');
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0, expired: true });
  const dateInputRef = useRef(null);

  useEffect(() => {
    if (initialDate) setExpiryDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (!expiryDate) {
      setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0, expired: true });
      return;
    }

    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(expiryDate).getTime();
      const distance = end - now;
      if (distance <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
      return {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((distance % (1000 * 60)) / 1000),
        expired: false
      };
    };

    setTimeLeft(calculateTime());
    const interval = setInterval(() => {
      const t = calculateTime();
      setTimeLeft(t);
      if (t.expired) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setExpiryDate(newDate);
    if (onDateChange) onDateChange(newDate);
  };

  // Reliably open the native date picker across all browsers
  const openPicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch { input.click(); }
    } else {
      input.click();
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="space-y-3">
        <label
          htmlFor={id}
          className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
        >
          Campaign Expiry
        </label>

        {/* Hidden native datetime-local input — programmatically opened */}
        <input
          ref={dateInputRef}
          id={id}
          name={id}
          type="datetime-local"
          value={expiryDate}
          onChange={handleDateChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Visible styled trigger row */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/5 border border-white/10 border-dashed rounded-2xl px-5 h-16 flex items-center gap-4">
            <Calendar
              className={`flex-shrink-0 transition-colors duration-300 ${expiryDate ? 'text-yellow-400' : 'text-gray-500'}`}
              size={20}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">
                Expiry Date &amp; Time
              </span>
              <span className="text-sm font-bold text-white truncate">
                {expiryDate
                  ? new Date(expiryDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  : 'Not Scheduled'}
              </span>
            </div>
          </div>

          {/* Dedicated clickable SET DATE button — always visible, no z-index conflict */}
          <button
            type="button"
            onClick={openPicker}
            className="flex-shrink-0 flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95 border border-yellow-500/30 text-yellow-400 text-[10px] font-black px-4 h-16 rounded-2xl uppercase tracking-widest transition-all"
            aria-label="Open date picker"
          >
            <Calendar size={14} />
            {expiryDate ? 'Change' : 'Set Date'}
          </button>
        </div>

        {/* Clear button when a date is set */}
        {expiryDate && (
          <button
            type="button"
            onClick={() => {
              setExpiryDate('');
              if (onDateChange) onDateChange('');
            }}
            className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-red-500 transition-colors ml-1"
          >
            ✕ Clear date
          </button>
        )}
      </div>

      {/* Countdown display */}
      {expiryDate && (
        <div className={`p-6 rounded-3xl border transition-all duration-500 ${
          timeLeft.expired ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {timeLeft.expired ? (
                <AlertCircle size={16} className="text-red-500" />
              ) : (
                <Zap size={16} className="text-yellow-500 animate-pulse" />
              )}
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                timeLeft.expired ? 'text-red-500' : 'text-yellow-500'
              }`}>
                {timeLeft.expired ? 'Campaign Expired' : 'Time Remaining'}
              </span>
            </div>
            {!timeLeft.expired && <Clock size={16} className="text-gray-600" />}
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Days', value: timeLeft.days },
              { label: 'Hrs',  value: timeLeft.hours },
              { label: 'Min',  value: timeLeft.mins },
              { label: 'Sec',  value: timeLeft.secs }
            ].map((unit, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className={`w-full aspect-square rounded-2xl flex items-center justify-center text-xl font-black shadow-inner border ${
                  timeLeft.expired
                    ? 'bg-gray-800 border-gray-700 text-gray-500'
                    : 'bg-white/5 border-white/10 text-white'
                }`}>
                  {unit.value.toString().padStart(2, '0')}
                </div>
                <span className="text-[8px] font-black text-gray-500 uppercase mt-2 tracking-widest">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignExpiryManager;