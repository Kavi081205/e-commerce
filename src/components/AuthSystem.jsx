import React, { useState } from 'react';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';
import { useAuth } from '../context/AuthContext';

const auth = getAuth(app);

export default function AuthSystem() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Only write a 'customer' role document for brand-new accounts.
  // For existing users (e.g. admins using the same Firebase Auth),
  // we use getDoc first so we never overwrite an existing role.
  const saveCustomerDoc = async (user, isNewAccount = false) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    if (isNewAccount) {
      // Brand-new account: safe to set role = 'customer'
      await setDoc(
        userRef,
        {
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          role: 'customer',
          createdAt: new Date().toISOString()
        },
        { merge: true }
      );
    } else {
      // Returning user login: only update non-role fields — never overwrite role
      await setDoc(
        userRef,
        {
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          lastLogin: new Date().toISOString()
        },
        { merge: true }
      );
    }
  };

  const validatePassword = (pass) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
    return regex.test(pass);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isLoginMode && !validatePassword(password)) {
      setError("Password must be at least 6 characters and contain a mix of letters and numbers.");
      return;
    }

    setLoading(true);

    try {
      let userCredential;
      if (isLoginMode) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        await saveCustomerDoc(userCredential.user, false); // returning user — never overwrites role

        // Success: AuthContext onSnapshot will resolve the user role and App.jsx will auto-redirect.
        return;
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveCustomerDoc(userCredential.user, true); // new account — sets role: 'customer'
        setSuccess('Account created successfully!');
        navigate('/', { replace: true });
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("An account with this email already exists. Try logging in.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Invalid email or password.");
      } else {
        const cleanMessage = err.message.replace('Firebase: ', '');
        setError(cleanMessage || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Google sign-in: treat as returning user — never overwrite existing role
      await saveCustomerDoc(result.user, false);

      // Success: AuthContext onSnapshot will resolve the user role and App.jsx will auto-redirect.
    } catch (err) {
      const cleanMessage = err.message.replace('Firebase: ', '');
      setError(cleanMessage);
    } finally {
      setLoading(false);
    }
  };

  // Removed automatic redirect on mount to avoid UI leakage and keep navigation explicit

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
        <div className="bg-gray-900/60 backdrop-blur-xl border border-yellow-900/20 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.5em] mb-4 relative z-10">
            {isLoginMode ? 'Identity Verification' : 'New Registry'}
          </p>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter relative z-10">
            {isLoginMode ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-10 relative z-10">
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
              className={`w-full py-5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] transition-all flex justify-center items-center gap-3 mt-2 ${loading
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

          {/* Google Sign In */}
          <div className="mt-10 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-transparent text-[9px] font-black text-gray-700 uppercase tracking-[0.3em]">Or proceed with</span>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center px-6 py-4 border border-white/10 rounded-2xl bg-white/5 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:border-yellow-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed gap-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}