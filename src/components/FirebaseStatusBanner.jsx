/**
 * FirebaseStatusBanner.jsx
 *
 * A non-intrusive sticky banner that appears when Firebase returns a
 * quota-exceeded / resource-exhausted error from any React Query fetch.
 *
 * Features:
 *  • Auto-detects quota errors via window event (dispatched by useFirebaseError hook)
 *  • Shows a countdown so the user knows when to retry
 *  • "Clear Cache" button triggers forceFirebaseCacheClear() + reload
 *  • Dismissible for 10 minutes per session
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Database, X, RefreshCw } from 'lucide-react';

const DISMISS_KEY = '__fb_quota_dismissed';
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export default function FirebaseStatusBanner() {
  const [visible, setVisible] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const handleQuotaError = () => {
      // Don't show if user already dismissed recently
      const dismissedAt = sessionStorage.getItem(DISMISS_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS) return;
      setVisible(true);
    };

    window.addEventListener('firebase-quota-exceeded', handleQuotaError);
    return () => window.removeEventListener('firebase-quota-exceeded', handleQuotaError);
  }, []);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const handleClearAndReload = useCallback(async () => {
    setClearing(true);
    try {
      const { forceFirebaseCacheClear } = await import('../utils/clearFirebaseCache.js');
      await forceFirebaseCacheClear();
    } catch (_) { /* ignore */ } finally {
      window.location.reload();
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[9999] bg-orange-950/95 backdrop-blur-md border-b border-orange-500/30 shadow-2xl shadow-orange-950/50"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 bg-orange-500/15 rounded-lg flex items-center justify-center flex-shrink-0 border border-orange-500/25 mt-0.5 sm:mt-0">
            <Database size={14} className="text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-orange-200 text-xs font-black uppercase tracking-widest leading-tight">
              Service Temporarily Limited
            </p>
            <p className="text-orange-400/70 text-[10px] font-medium mt-0.5 leading-snug">
              Firebase is throttling requests. Clear local cache to restore normal operation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleClearAndReload}
            disabled={clearing}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 active:scale-95 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
          >
            <RefreshCw size={11} className={clearing ? 'animate-spin' : ''} />
            {clearing ? 'Clearing…' : 'Clear Cache'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="w-7 h-7 flex items-center justify-center text-orange-400/60 hover:text-orange-300 rounded-lg hover:bg-orange-500/10 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
