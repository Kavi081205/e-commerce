import React, { useState, useEffect } from 'react';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  validateEmail,
  validatePassword as validatePasswordStrength,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  formatLockoutTime
} from '../utils/security';
import { logFailedLogin, logSuccessfulLogin } from '../utils/activityLog';

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
    case 'auth/popup-blocked':
      return 'The login popup was blocked by your browser. Please allow popups or use redirect login.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In. Please notify the administrator.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window closed before completion. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in request was cancelled. Please try again.';
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
  const [redirectLoading, setRedirectLoading] = useState(false);

  // Inline validation & rate limiting state
  const [emailError, setEmailError]       = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ strength: 'weak', message: '' });
  const [isBlocked, setIsBlocked]         = useState(false);
  const [remainingMs, setRemainingMs]     = useState(0);

  // Monitor login rate limiting for the entered email (only if in login mode)
  useEffect(() => {
    if (!email || !isLoginMode) {
      setIsBlocked(false);
      setRemainingMs(0);
      return;
    }
    const checkLimit = () => {
      const status = checkLoginRateLimit(email);
      setIsBlocked(status.blocked);
      setRemainingMs(status.remainingMs);
    };
    checkLimit();
    const interval = setInterval(checkLimit, 1000);
    return () => clearInterval(interval);
  }, [email, isLoginMode]);

  // Mobile/Safari browser detection
  const isMobileDevice = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/i.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    return isIOS || isAndroid || isSafari || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 1);
  };

  // Handle redirect login result on mount
  useEffect(() => {
    const checkRedirect = async () => {
      setRedirectLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await saveCustomerDoc(result.user);
          setSuccess('Signed in with Google!');
          await logSuccessfulLogin(result.user.uid, result.user.email, 'customer_google');
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Redirect sign-in error:', err.code, err.message);
        setError(getFriendlyError(err));
      } finally {
        setRedirectLoading(false);
      }
    };
    checkRedirect();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      if (isMobileDevice()) {
        await signInWithRedirect(auth, provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          await saveCustomerDoc(result.user);
          setSuccess('Signed in with Google!');
          await logSuccessfulLogin(result.user.uid, result.user.email, 'customer_google');
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      console.error('Google Auth error:', err.code);
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Save / update Firestore user document ────────────────────────────────────
  // Never overwrites role for returning users — only sets it on brand-new accounts.
  const saveCustomerDoc = async (user, isNewAccount = false) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);
      const exists = userSnap.exists();

      if (isNewAccount || !exists) {
        await setDoc(userRef, {
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          role: 'customer',
          createdAt: userSnap.data()?.createdAt || new Date().toISOString()
        }, { merge: true });
      } else {
        // Returning user — only touch non-role fields
        await setDoc(userRef, {
          name: userSnap.data()?.name || user.displayName || user.email?.split('@')[0] || 'User',
          email: userSnap.data()?.email || user.email || '',
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to save user document in Firestore:', err);
    }
  };

  // Inline validation handlers
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (val) {
      const res = validateEmail(val);
      setEmailError(res.message);
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (!isLoginMode) {
      const res = validatePasswordStrength(val);
      setPasswordStrength({ strength: res.strength, message: res.message });
      setPasswordError(res.message);
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate inputs before submitting
    const emailRes = validateEmail(email);
    if (!emailRes.valid) {
      setEmailError(emailRes.message);
      return;
    }

    if (!isLoginMode) {
      const passRes = validatePasswordStrength(password);
      if (!passRes.valid) {
        setPasswordError(passRes.message);
        return;
      }
    }

    if (isLoginMode && isBlocked) {
      setError(`Too many failed login attempts. Locked out. Please try again in ${formatLockoutTime(remainingMs)}.`);
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        clearLoginAttempts(email);
        await logSuccessfulLogin(auth.currentUser?.uid, email, 'customer_login');
        return;
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await saveCustomerDoc(user, true);
        setSuccess('Account created successfully!');
        await logSuccessfulLogin(user.uid, email, 'customer_register');
        navigate('/', { replace: true });
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Auth error:', err.code);
      if (isLoginMode) {
        recordFailedLogin(email);
        await logFailedLogin(email, 'customer_login');
      }
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
            disabled={loading || redirectLoading}
            onClick={() => { setIsLoginMode(true); setError(null); setSuccess(null); }}
            className={`flex-1 py-3.5 text-[10px] font-black rounded-xl uppercase tracking-[0.3em] transition-all ${
              loading || redirectLoading ? 'opacity-50 cursor-not-allowed' : ''
            } ${isLoginMode
              ? 'bg-yellow-500 text-black shadow-lg'
              : 'text-gray-600 hover:text-white hover:bg-white/5'
            }`}
          >
            Access
          </button>
          <button
            type="button"
            disabled={loading || redirectLoading}
            onClick={() => { setIsLoginMode(false); setError(null); setSuccess(null); }}
            className={`flex-1 py-3.5 text-[10px] font-black rounded-xl uppercase tracking-[0.3em] transition-all ${
              loading || redirectLoading ? 'opacity-50 cursor-not-allowed' : ''
            } ${!isLoginMode
              ? 'bg-yellow-500 text-black shadow-lg'
              : 'text-gray-600 hover:text-white hover:bg-white/5'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-yellow-900/20 rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-10 shadow-2xl relative">
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
                onChange={handleEmailChange}
                required
                disabled={loading || redirectLoading || (isLoginMode && isBlocked)}
                className={`w-full px-5 py-4 bg-black/50 border rounded-2xl text-white text-sm placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  emailError ? 'border-red-500/50 focus:border-red-500' : 'border-yellow-900/20 focus:border-yellow-500'
                }`}
                placeholder="name@domain.com"
              />
              {emailError && (
                <p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-1">
                  {emailError}
                </p>
              )}
              {isLoginMode && isBlocked && (
                <p className="text-[9px] text-red-500 font-black uppercase tracking-widest mt-1">
                  Rate-limited. Try again in {formatLockoutTime(remainingMs)}
                </p>
              )}
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
                onChange={handlePasswordChange}
                required
                disabled={loading || redirectLoading || (isLoginMode && isBlocked)}
                className={`w-full px-5 py-4 bg-black/50 border rounded-2xl text-white text-sm placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  passwordError ? 'border-red-500/50 focus:border-red-500' : 'border-yellow-900/20 focus:border-yellow-500'
                }`}
                placeholder="••••••••"
              />
              {passwordError && (
                <p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-1">
                  {passwordError}
                </p>
              )}
              {!isLoginMode && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    <div className={`h-full flex-1 rounded-full ${passwordStrength.strength === 'weak' ? 'bg-red-500' : passwordStrength.strength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <div className={`h-full flex-1 rounded-full ${passwordStrength.strength === 'weak' ? 'bg-white/10' : passwordStrength.strength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <div className={`h-full flex-1 rounded-full ${passwordStrength.strength === 'strong' ? 'bg-green-500' : 'bg-white/10'}`} />
                  </div>
                  <p className={`text-[9px] uppercase font-black tracking-widest ${
                    passwordStrength.strength === 'weak' ? 'text-red-400' : passwordStrength.strength === 'medium' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    Strength: {passwordStrength.strength}
                  </p>
                </div>
              )}
              {!isLoginMode && !password && (
                <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mt-2">
                  Minimum 8 characters · Mix of uppercase, lowercase, numbers, and special characters required.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || redirectLoading || (isLoginMode && isBlocked)}
              className={`w-full py-5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] transition-all flex justify-center items-center gap-3 mt-2 mb-4 ${
                loading || redirectLoading || (isLoginMode && isBlocked)
                  ? 'bg-yellow-500/50 text-black cursor-not-allowed opacity-50'
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

          {/* Divider */}
          <div className="relative flex py-4 items-center justify-center no-print">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || redirectLoading}
            className={`w-full py-5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex justify-center items-center gap-3 border no-print min-h-[44px] ${
              loading || redirectLoading
                ? 'bg-white/5 border-white/5 text-gray-500 cursor-not-allowed'
                : 'bg-white text-black border-transparent hover:bg-yellow-500 hover:text-black hover:scale-[1.02] active:scale-95 shadow-lg shadow-white/5'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {loading || redirectLoading ? 'Processing...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  );
}