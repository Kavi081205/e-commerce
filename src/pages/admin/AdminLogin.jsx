import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, ShieldCheck, Loader2 } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import app from '../../firebase';

const auth = getAuth(app);

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { adminLogin, currentUser, isAdmin, loading: authLoading, adminSession } = useAuth();

  // While AuthContext is still resolving, render nothing (avoids flash-redirect).
  if (authLoading) return null;

  // Already authenticated as admin — go straight to dashboard.
  if (isAdmin) return <Navigate to="/admin" replace />;

  // ── Handle Login ─────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Direct credential comparison (trim() to handle spaces/mobile keyboard quirks).
    const result = adminLogin(email, password);

    if (result.success) {
      navigate('/admin', { replace: true });
    } else {
      setError(result.message);
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

            {/* ── Warning Banner: a non-admin Firebase session is active ─────── */}
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

            {/* ── Error Message ─────────────────────────────────────────────── */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-start gap-3">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                {error}
              </div>
            )}

            {/* ── Login Form ────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-bold text-yellow-500/70 uppercase tracking-widest mb-2 ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={18} className="text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                  </div>
                  <input
                    id="admin-email"
                    name="admin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-yellow-900/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 transition-all font-medium"
                    placeholder="kaviyarasanmurugan78@gmail.com"
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
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-yellow-900/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white tracking-wide transition-all ${
                  loading
                    ? 'bg-yellow-600/50 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20 active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin h-5 w-5 text-white" />
                    Verifying...
                  </span>
                ) : 'Sign In to Dashboard'}
              </button>
            </form>
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