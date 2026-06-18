import React from 'react';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, Wifi, Database } from 'lucide-react';
import { logSystemError } from '../utils/analytics';

/**
 * Detects if an error is a Firebase Firestore quota / resource-exhausted error.
 * These require special handling: clear local cache + reload instead of just retry.
 */
function isFirebaseQuotaError(error) {
  if (!error) return false;
  const msg = String(error?.message || error?.code || error || '').toLowerCase();
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quotaexceeded') ||
    msg.includes('backoff delay') ||
    (error?.code === 'resource-exhausted')
  );
}

function isFirebaseNetworkError(error) {
  if (!error) return false;
  const msg = String(error?.message || error?.code || error || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('failed to fetch') ||
    (error?.code === 'unavailable')
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      reported: false,
      reporting: false,
      clearingCache: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught exception:', error, errorInfo);
    this.setState({ errorInfo });
    // Auto-log to Firestore — but only if it's NOT a quota error
    // (logging a quota error to Firestore would ironically make it worse)
    if (!isFirebaseQuotaError(error)) {
      logSystemError(error, 'ErrorBoundaryAuto', {
        componentStack: errorInfo?.componentStack ?? null,
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false, reported: false });
    window.location.reload();
  };

  handleClearCacheAndRetry = async () => {
    this.setState({ clearingCache: true });
    try {
      // Dynamically import so this chunk only loads if needed
      const { forceFirebaseCacheClear } = await import('../utils/clearFirebaseCache.js');
      await forceFirebaseCacheClear();
    } catch (_) { /* ignore */ } finally {
      window.location.reload();
    }
  };

  handleReport = async () => {
    this.setState({ reporting: true });
    try {
      await logSystemError(this.state.error, 'ErrorBoundaryManual', {
        componentStack: this.state.errorInfo?.componentStack ?? null,
        manualReport: true,
      });
      this.setState({ reported: true });
    } catch (err) {
      console.error('Failed to report issue:', err);
    } finally {
      this.setState({ reporting: false });
    }
  };

  render() {
    if (this.state.hasError) {
      const isQuota   = isFirebaseQuotaError(this.state.error);
      const isNetwork = isFirebaseNetworkError(this.state.error);

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-950">
          <div className="max-w-md w-full bg-gray-900 border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl shadow-red-950/20">

            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto border ${
              isQuota
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                : isNetwork
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              {isQuota ? <Database size={32} /> : isNetwork ? <Wifi size={32} /> : <AlertCircle size={32} />}
            </div>

            {/* Title */}
            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">
              {isQuota
                ? 'Service Temporarily Limited'
                : isNetwork
                ? 'Connection Issue'
                : 'Something Went Wrong'}
            </h2>

            {/* Description */}
            <p className="text-gray-400 text-xs mb-6 leading-relaxed tracking-wider font-semibold">
              {isQuota
                ? 'Firebase has temporarily throttled requests due to high usage. Your cached data will be cleared and the app restarted. This usually resolves in a few minutes.'
                : isNetwork
                ? 'Unable to reach the server. Check your internet connection and try again.'
                : 'An unexpected error occurred. Please refresh the page or retry.'}
            </p>

            {/* Technical details (collapsible) */}
            {this.state.error && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                  className="text-[10px] text-yellow-500/80 hover:text-yellow-400 font-black uppercase tracking-wider transition-colors mb-2 focus:outline-none flex items-center gap-1 mx-auto"
                >
                  {this.state.showDetails
                    ? <><span>Hide Details</span> <ChevronUp size={12} /></>
                    : <><span>Show Details</span> <ChevronDown size={12} /></>}
                </button>
                {this.state.showDetails && (
                  <div className="bg-slate-950 border border-gray-800 rounded-xl p-4 text-left overflow-x-auto text-[10px] font-mono text-red-400 leading-tight max-h-40 select-text">
                    <p className="font-bold mb-1">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="whitespace-pre text-neutral-500 mt-2 font-mono text-[9px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {isQuota ? (
                <button
                  type="button"
                  onClick={this.handleClearCacheAndRetry}
                  disabled={this.state.clearingCache}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-60"
                >
                  <Database size={14} />
                  {this.state.clearingCache ? 'Clearing Cache...' : 'Clear Cache & Restart'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <RefreshCw size={14} />
                  Reload Application
                </button>
              )}

              {/* Always show a plain reload option too */}
              {isQuota && (
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-[9px] border border-neutral-700"
                >
                  <RefreshCw size={12} /> Simple Reload
                </button>
              )}

              {/* Report button — only for non-quota errors */}
              {!isQuota && (
                this.state.reported ? (
                  <div className="py-2.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-[9px] font-black uppercase tracking-widest text-center">
                    ✓ Issue reported to admin
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={this.handleReport}
                    disabled={this.state.reporting}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-[9px] disabled:opacity-50 border border-neutral-800"
                  >
                    {this.state.reporting ? 'Submitting...' : 'Report This Issue'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
