import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ShieldCheck, Loader2, Eye, EyeOff, AlertTriangle, Clock } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import app from '../../firebase';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  formatLockoutTime,
} from '../../utils/security';
import { logFailedLogin, logSecurityEvent } from '../../utils/activityLog';

const auth = getAuth(app);

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Rate-limit state
  const [isBlocked, setIsBlocked]       = useState(false);
  const [remainingMs, setRemainingMs]   = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  const { adminLogin, currentUser, isAdmin, loading: authLoading } = useAuth();

  // ── Countdown ticker for lockout timer ──────────────────────────────────────
  useEffect(() => {
    if (!isBlocked || remainingMs <= 0) return;
    const interval = setInterval(() => {
      setRemainingMs(prev => {
        if (prev <= 1000) {
          clearInterval(interval);
          setIsBlocked(false);
          setError('');
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isBlocked, remainingMs]);

  // ── Check rate limit on email change ────────────────────────────────────────
  const refreshRateLimit = useCallback((em) => {
    if (!em) return;
    const { blocked, remainingMs: ms, attemptsLeft: left } = checkLoginRateLimit(em);
    setIsBlocked(blocked);
    setRemainingMs(ms);
    setAttemptsLeft(left);
    if (blocked) {
      setError('');
    }
  }, []);

  useEffect(() => { refreshRateLimit(email); }, [email, refreshRateLimit]);

  // While AuthContext is still resolving, render nothing.
  if (authLoading) return null;

  // Already authenticated as admin — go straight to dashboard.
  if (isAdmin) return <Navigate to="/admin" replace />;

  // ── Handle Login ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailTrimmed = email.toLowerCase().trim();

    // Re-check rate limit right before submission
    const { blocked, remainingMs: ms, attemptsLeft: left } = checkLoginRateLimit(emailTrimmed);
    if (blocked) {
      setIsBlocked(true);
      setRemainingMs(ms);
      await logSecurityEvent('rate_limit_hit', { source: 'admin_login', email: emailTrimmed });
      return;
    }

    setLoading(true);
    const result = await adminLogin(emailTrimmed, password);

    if (result.success) {
      navigate('/admin', { replace: true });
    } else {
      // Record failure for rate limiting
      recordFailedLogin(emailTrimmed);
      await logFailedLogin(emailTrimmed, 'admin_login');
      refreshRateLimit(emailTrimmed);

      const { blocked: nowBlocked, remainingMs: nowMs } = checkLoginRateLimit(emailTrimmed);
      if (nowBlocked) {
        setIsBlocked(true);
        setRemainingMs(nowMs);
        setError('');
        await logSecurityEvent('admin_locked_out', { email: emailTrimmed });
      } else {
        setError(result.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-gray-900 border border-yellow-900/30 rounded-2xl shadow-2xl overflow-hidden shadow-yellow-900/20">
          <div className="bg-gradient-to-br from-gray-900 to-slate-900 py-10 px-6 text-center border-b border-yellow-900/20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-5">
              <ShieldCheck size={40} className="text-yellow-400" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Admin Portal</h2>
            <p className="text-yellow-500/60 mt-2 text-sm font-medium tracking-widest uppercase">Secure Login</p>
          </div>

          <div className="p-8 sm:p-10 bg-gray-900/50">

            {/* ── Warning: customer session active ──────────────────────────── */}
            {currentUser && !isAdmin && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex flex-col gap-3">
                <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest">
                  ⚠ Logged in as customer
                </p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  <span className="text-white font-semibold">{currentUser.email}</span> does not have
                  admin privileges. Sign out below, then log in with your admin account.
                </p>
                <button
                  type="button"
                  onClick={async () => { await signOut(auth); }}
                  className="self-start text-[11px] font-black uppercase tracking-widest text-yellow-400 border border-yellow-500/30 px-4 py-2 rounded-lg hover:bg-yellow-500/10 transition-all"
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* ── Rate-limit lockout banner ──────────────────────────────────── */}
            {isBlocked && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-black uppercase tracking-widest text-xs mb-1">Account Temporarily Locked</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Too many failed attempts. Please wait before trying again.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-5 py-3">
                  <Clock size={16} className="text-red-400" />
                  <span className="text-red-300 font-black text-xl tracking-widest font-mono">
                    {formatLockoutTime(remainingMs)}
                  </span>
                </div>
              </div>
            )}

            {/* ── Attempts-left warning ──────────────────────────────────────── */}
            {!isBlocked && attemptsLeft < 5 && attemptsLeft > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                <AlertTriangle size={14} className="text-orange-400 shrink-0" />
                <p className="text-orange-400 text-xs font-bold">
                  {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before lockout
                </p>
              </div>
            )}

            {/* ── Error Message ──────────────────────────────────────────────── */}
            {error && !isBlocked && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-start gap-3">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                {error}
              </div>
            )}

            {/* ── Login Form ─────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-bold text-yellow-500/70 uppercase tracking-widest mb-2 ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={18} className="text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                  </div>
                  <input
                    id="admin-email"
                    name="admin-email"
                    type="email"
                    required
                    disabled={isBlocked || loading}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-yellow-900/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="admin@smkptraders.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-xs font-bold text-yellow-500/70 uppercase tracking-widest mb-2 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={18} className="text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                  </div>
                  <input
                    id="admin-password"
                    name="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isBlocked || loading}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-950 border border-yellow-900/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-yellow-400 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isBlocked}
                className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white tracking-wide transition-all ${
                  loading || isBlocked
                    ? 'bg-yellow-600/50 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20 active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin h-5 w-5 text-white" />
                    Verifying...
                  </span>
                ) : isBlocked ? (
                  <span className="flex items-center gap-2">
                    <Clock size={18} />
                    Locked — {formatLockoutTime(remainingMs)}
                  </span>
                ) : 'Sign In to Dashboard'}
              </button>
            </form>

            {/* ── Security notice ────────────────────────────────────────────── */}
            <p className="mt-6 text-center text-gray-700 text-[10px] leading-relaxed">
              🔒 This portal is protected. All login attempts are logged and monitored.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-gray-400 text-xs tracking-widest uppercase font-medium">
          SMKP TRADERS © {new Date().getFullYear()} — Authorized Personnel Only
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;