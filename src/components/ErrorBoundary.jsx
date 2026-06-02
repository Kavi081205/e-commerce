import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { logSystemError } from '../utils/analytics';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught exception:', error, errorInfo);
    // Log to Firebase Analytics + Firestore errors collection
    logSystemError(error, 'ErrorBoundary', {
      componentStack: errorInfo?.componentStack ?? null,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-950">
          <div className="max-w-md w-full bg-gray-900 border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl shadow-red-950/20 animate-fadeIn">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-red-500/20">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Something Went Wrong</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              We encountered an unexpected error. Please refresh the page or retry.
            </p>
            {this.state.error && (
              <div className="bg-slate-950 border border-gray-800 rounded-xl p-4 mb-6 text-left overflow-x-auto text-[10px] font-mono text-red-400 leading-tight max-h-32">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleRetry}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg shadow-yellow-600/10 active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
            >
              <RefreshCw size={14} className="animate-spin" />
              Retry Connection
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
