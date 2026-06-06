import React, { useState } from 'react';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';
import { useAuth } from '../context/AuthContext';

const auth = getAuth(app);

// ─── Helper: map Firebase error codes to user-friendly messages ──────────────
const getFriendlyError = (err) => {
  switch (err.code) {
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    default:
      return err.message
        ?.replace('Firebase: ', '')
        .replace(/\s*\(auth\/[^)]+\)\.?/, '')
        || 'Authentication failed. Please try again.';
  }
};

export default function AuthSystem() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [isLoginMode, setIsLoginMode]     = useState(true);
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [success, setSuccess]             = useState(null);

  // ── Save / update Firestore user document ────────────────────────────────────
  // Never overwrites role for returning users — only sets it on brand-new accounts.
  const saveCustomerDoc = async (user, isNewAccount = false) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    if (isNewAccount) {
      await setDoc(userRef, {
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: 'customer',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } else {
      // Returning user — only touch non-role fields
      await setDoc(userRef, {
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        lastLogin: new Date().toISOString()
      }, { merge: true });
    }
  };

  // ── Email/password login and registration ────────────────────────────────────
  const validatePassword = (pass) => /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(pass);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isLoginMode && !validatePassword(password)) {
      setError('Password must be at least 6 characters and contain a mix of letters and numbers.');
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        // AuthContext onSnapshot resolves role → App.jsx auto-redirects
        return;
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await saveCustomerDoc(user, true);
        setSuccess('Account created successfully!');
        navigate('/', { replace: true });
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Auth error:', err.code);
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">

        {/* Toggle Buttons */}
        <div className="flex bg-white/5 backdrop-blur-sm p-1 rounded-2xl mb-8 border border-white/10 shadow-2xl">
          <button
            type="button"
            onClick={() => { setIsLoginMode(true); setError(null); setSuccess(null); }}
            className={`flex-1 py-3.5 text-[10px] font-black rounded-xl uppercase tracking-[0.3em] transition-all ${isLoginMode
              ? 'bg-yellow-500 text-black shadow-lg'
              : 'text-gray-600 hover:text-white hover:bg-white/5'
            }`}
          >
            Access
          </button>
          <button
            type="button"
            onClick={() => { setIsLoginMode(false); setError(null); setSuccess(null); }}
            className={`flex-1 py-3.5 text-[10px] font-black rounded-xl uppercase tracking-[0.3em] transition-all ${!isLoginMode
              ? 'bg-yellow-500 text-black shadow-lg'
              : 'text-gray-600 hover:text-white hover:bg-white/5'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-yellow-900/20 rounded-[2.5rem] p-10 shadow-2xl relative">
          {/* Ambient glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.5em] mb-4 relative z-10 text-center">
            {isLoginMode ? 'Identity Verification' : 'New Registry'}
          </p>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter relative z-10 text-center">
            {isLoginMode ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-10 relative z-10 text-center">
            {isLoginMode ? 'Enter your credentials to proceed.' : 'Register your identity in our system.'}
          </p>

          {/* Status Messages */}
          {error && (
            <div className="mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-black uppercase tracking-widest flex items-start relative z-10">
              <svg className="w-4 h-4 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-8 p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-[10px] font-black uppercase tracking-widest flex items-start relative z-10">
              <svg className="w-4 h-4 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label htmlFor="auth-email" className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">
                Electronic Address
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-5 py-4 bg-black/50 border border-yellow-900/20 rounded-2xl text-white text-sm placeholder-gray-700 focus:outline-none focus:border-yellow-500 transition-all"
                placeholder="name@domain.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="auth-password" className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">
                Access Code
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
                className="w-full px-5 py-4 bg-black/50 border border-yellow-900/20 rounded-2xl text-white text-sm placeholder-gray-700 focus:outline-none focus:border-yellow-500 transition-all"
                placeholder="••••••••"
              />
              {!isLoginMode && (
                <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mt-2">
                  Minimum 6 characters · Mix of letters &amp; numbers required.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] transition-all flex justify-center items-center gap-3 mt-2 mb-4 ${loading
                ? 'bg-yellow-500/50 text-black cursor-not-allowed'
                : 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-[1.02] active:scale-95 shadow-2xl shadow-yellow-500/20'
              }`}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : isLoginMode ? 'Authenticate' : 'Create Identity'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}