import React, { createContext, useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';
import { logAuthEvent } from '../utils/analytics';
import { logAdminAction, logSuccessfulLogin, logLogout } from '../utils/activityLog';
import { clearLoginAttempts } from '../utils/security';

const auth = getAuth(app);

// ─── Admin email (public — used only for role-checking, not for auth bypass) ──
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'kaviyarasanmurugan78@gmail.com').toLowerCase().trim();

// ─── Inactivity timeout: 30 minutes of no interaction auto-logs out admin ─────
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser]   = useState(null);
  const [loading, setLoading]           = useState(true);

  // Inactivity timer ref — only active for admin sessions
  const inactivityTimer = useRef(null);

  // Keep Firebase session alive across page reloads.
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
  }, []);

  // ── Inactivity Auto-Logout ──────────────────────────────────────────────────
  // Resets on any user interaction. If 30 minutes pass with no activity, admin is signed out.
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      const user = auth.currentUser;
      if (user?.email?.toLowerCase().trim() === ADMIN_EMAIL) {
        console.info('[Security] Admin session expired due to inactivity. Signing out.');
        await logLogout(user.uid, 'inactivity');
        await signOut(auth);
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  // Attach inactivity listeners only for admin users
  const startInactivityWatch = useCallback(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, resetInactivityTimer, { passive: true }));
    resetInactivityTimer(); // start the first timer
    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // ── Firebase Auth listener ──────────────────────────────────────────────────
  useEffect(() => {
    let stopInactivity     = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous inactivity watcher.
      if (stopInactivity)     { stopInactivity();     stopInactivity     = null; }
      if (inactivityTimer.current) { clearTimeout(inactivityTimer.current); }

      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const isAdminUser = user.email?.toLowerCase().trim() === ADMIN_EMAIL;

      // Start inactivity watcher for admin sessions only
      if (isAdminUser) {
        stopInactivity = startInactivityWatch();
      }

      const userRef = doc(db, 'users', user.uid);

      try {
        const docSnap = await getDoc(userRef);
        let userData = docSnap.data();

        // Auto-provision admin Firestore document when admin email signs in via Firebase.
        if (isAdminUser) {
          const needsProvisioning = !docSnap.exists() || userData?.role !== 'admin' || !userData?.isAdmin;
          if (needsProvisioning) {
            const adminData = {
              uid:          user.uid,
              email:        user.email,
              displayName:  user.displayName || 'Admin',
              role:         'admin',
              isAdmin:      true,
              lastLoginAt:  new Date().toISOString(),
              lastDevice:   typeof navigator !== 'undefined' ? navigator.userAgent : null,
              createdAt:    userData?.createdAt || new Date().toISOString(),
            };
            await setDoc(userRef, adminData, { merge: true });
            userData = { ...userData, ...adminData };
          } else {
            // Update last login info on admin session start (once per session/refresh, not looped)
            const lastLoginAt = new Date().toISOString();
            const lastDevice = typeof navigator !== 'undefined' ? navigator.userAgent : null;
            await setDoc(userRef, { lastLoginAt, lastDevice }, { merge: true });
            userData = { ...userData, lastLoginAt, lastDevice };
          }
        }

        if (docSnap.exists() || isAdminUser) {
          setCurrentUser({ ...user, ...userData });
          setLoading(false);
          logAuthEvent('login');
        } else {
          // New customer — create profile with role 'customer' (NEVER 'admin').
          const initialData = {
            uid:         user.uid,
            email:       user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            createdAt:   new Date().toISOString(),
            role:        'customer',
          };
          await setDoc(userRef, initialData, { merge: true });
          setCurrentUser({ ...user, ...initialData });
          setLoading(false);
          logAuthEvent('sign_up');
        }
      } catch (err) {
        console.error('AuthContext: Profile sync error:', err);
        setCurrentUser({ ...user, role: 'customer' });
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (stopInactivity)     stopInactivity();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [startInactivityWatch]);

  // ── Admin Login via Firebase Auth (no plain-text password in bundle) ─────────
  /**
   * Signs in via Firebase signInWithEmailAndPassword.
   * The admin password lives only in Firebase Auth — never in the JS bundle.
   * Returns { success: true } or { success: false, message: '...' }.
   */
  const adminLogin = useCallback(async (email, password) => {
    const emailTrimmed = (email || '').toLowerCase().trim();
    try {
      const cred = await signInWithEmailAndPassword(auth, emailTrimmed, password);
      clearLoginAttempts(emailTrimmed);

      // Verify this Firebase account is actually the admin email
      if (cred.user.email?.toLowerCase().trim() !== ADMIN_EMAIL) {
        await signOut(auth);
        return { success: false, message: 'This account does not have admin access.' };
      }

      // Log successful admin login to activity trail
      await logSuccessfulLogin(cred.user.uid, cred.user.email, 'admin_login');
      await logAdminAction('admin_login', { device: navigator?.userAgent }, cred.user.uid);

      return { success: true };
    } catch (err) {
      const code = err.code || '';
      let message = 'Invalid email or password. Please check your credentials.';
      if (code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Firebase has temporarily blocked this account.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection.';
      }
      return { success: false, message };
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const adminLogout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await logLogout(uid, 'manual');
    try { await signOut(auth); } catch (_) {}
  }, []);

  const login = useCallback((email, password) =>
    signInWithEmailAndPassword(auth, email, password), []);

  const logout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await logLogout(uid, 'manual');
    return signOut(auth);
  }, []);

  const updateProfile = useCallback(async (data) => {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    setCurrentUser(prev => prev ? { ...prev, ...data } : null);
  }, []);

  // isAdmin: true when the Firebase user's Firestore document has role='admin'.
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin === true;

  // adminSession is kept for backwards compatibility with AdminRoute guard in App.jsx
  const adminSession = isAdmin;

  const value = useMemo(() => ({
    currentUser,
    loading,
    isAdmin,
    adminSession,
    login,
    logout,
    adminLogin,
    adminLogout,
    updateProfile,
  }), [currentUser, loading, isAdmin, adminSession, login, logout, adminLogin, adminLogout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};