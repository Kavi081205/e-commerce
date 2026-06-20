import React, { createContext, useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  getRedirectResult
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logAuthEvent } from '../utils/analytics';
import { logAdminAction, logSuccessfulLogin, logLogout } from '../utils/activityLog';
import { clearLoginAttempts } from '../utils/security';

// ─── Admin email (public — used only for role-checking, not for auth bypass) ──
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'kaviyarasanmurugan78@gmail.com').toLowerCase().trim();

// ─── Inactivity timeout: 30 minutes of no interaction auto-logs out admin ─────
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inactivity timer ref — only active for admin sessions
  const inactivityTimer = useRef(null);

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
  const syncedUid = useRef(null);

  const syncProfileData = useCallback(async (user) => {
    console.log('[AuthContext] Starting Firestore profile sync for user:', user.email);
    const userRef = doc(db, 'users', user.uid);
    try {
      const docSnap = await getDoc(userRef);
      let userData = docSnap.data();
      const isAdminUser = user.email?.toLowerCase().trim() === ADMIN_EMAIL;

      if (isAdminUser) {
        const needsProvisioning = !docSnap.exists() || userData?.role !== 'admin' || !userData?.isAdmin;
        if (needsProvisioning) {
          const adminData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Admin',
            role: 'admin',
            isAdmin: true,
            createdAt: userData?.createdAt || new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            lastDevice: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          };
          await setDoc(userRef, adminData, { merge: true });
          userData = { ...userData, ...adminData };
          console.log('[AuthContext] Provisioned new admin doc in Firestore');
        } else {
          // Task 7: Only update lastLoginAt and lastDevice if changed or older than 15 mins
          const nowDevice = typeof navigator !== 'undefined' ? navigator.userAgent : null;
          const lastLoginTime = userData?.lastLoginAt ? new Date(userData.lastLoginAt).getTime() : 0;
          if (userData?.lastDevice !== nowDevice || (Date.now() - lastLoginTime) > 15 * 60 * 1000) {
            const updates = {
              lastLoginAt: new Date().toISOString(),
              lastDevice: nowDevice,
            };
            await setDoc(userRef, updates, { merge: true });
            userData = { ...userData, ...updates };
            console.log('[AuthContext] Updated admin lastLoginAt in Firestore');
          }
        }
      } else {
        // Customer user
        if (!docSnap.exists()) {
          const initialData = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            createdAt: new Date().toISOString(),
            role: 'customer',
          };
          await setDoc(userRef, initialData, { merge: true });
          userData = { ...userData, ...initialData };
          console.log('[AuthContext] Created new customer doc in Firestore');
        } else {
          // Task 7: Only update returning user details if there is actual change
          const newName = userData?.name || user.displayName || user.email?.split('@')[0] || 'User';
          const newEmail = userData?.email || user.email || '';
          const lastLoginTime = userData?.lastLogin ? new Date(userData.lastLogin).getTime() : 0;
          if (userData?.name !== newName || userData?.email !== newEmail || (Date.now() - lastLoginTime) > 15 * 60 * 1000) {
            const updates = {
              name: newName,
              email: newEmail,
              lastLogin: new Date().toISOString(),
            };
            await setDoc(userRef, updates, { merge: true });
            userData = { ...userData, ...updates };
            console.log('[AuthContext] Updated customer details in Firestore');
          }
        }
      }

      logAuthEvent('login');
      console.log('[AuthContext] Profile sync complete for:', user.email);
      return userData;
    } catch (err) {
      console.error('[AuthContext] Profile sync error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = null;

    const init = async () => {
      try {
        console.log('[Auth] Setting persistence...');
        await setPersistence(auth, browserLocalPersistence);

        console.log('[Auth] Checking getRedirectResult...');
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log('[Auth] Redirect completed');
        }
      } catch (err) {
        console.error('[Auth] Error during initialization:', err);
      }

      if (!active) return;

      console.log('[Auth] Registering onAuthStateChanged...');
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('[Auth] Firebase user detected:', user?.email || 'null');

        if (!user) {
          syncedUid.current = null;
          setCurrentUser(null);
          console.log('[Auth] loading=false');
          setLoading(false);
          return;
        }

        // Avoid duplicate syncs if user hasn't changed
        if (syncedUid.current === user.uid) {
          console.log('[Auth] loading=false');
          setLoading(false);
          return;
        }
        syncedUid.current = user.uid;

        // Ensure loading state remains/sets to true while we sync with Firestore
        setLoading(true);

        try {
          // Wait until Firestore finishes (ensuring customer doc exists and lastLogin is updated)
          const userData = await syncProfileData(user);
          console.log('[Auth] Firestore sync completed');

          // Build a plain object instead of storing the Firebase User class directly
          const plainUser = {
            uid:           user.uid,
            email:         user.email,
            displayName:   user.displayName || userData?.displayName || userData?.name || user.email?.split('@')[0] || 'User',
            photoURL:      user.photoURL || userData?.photoURL || null,
            emailVerified: user.emailVerified,
            ...userData
          };

          setCurrentUser(plainUser);
          console.log('[Auth] currentUser updated');
          console.log('[Auth] loading=false');
          setLoading(false);
          console.log('[Auth] Navigate Home');
        } catch (err) {
          console.error('[AuthContext] Error syncing profile in onAuthStateChanged:', err);
          // Fallback to Firebase user state as a plain object if Firestore fails
          const plainUser = {
            uid:           user.uid,
            email:         user.email,
            displayName:   user.displayName || user.email?.split('@')[0] || 'User',
            photoURL:      user.photoURL || null,
            emailVerified: user.emailVerified
          };
          setCurrentUser(plainUser);
          console.log('[Auth] currentUser updated');
          console.log('[Auth] loading=false');
          setLoading(false);
        }
      });
    };

    init();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [syncProfileData]);

  // ── Inactivity Auto-Logout Watcher for Admin ───────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const isAdminUser = currentUser.email?.toLowerCase().trim() === ADMIN_EMAIL;
    if (!isAdminUser) return;

    const stopWatch = startInactivityWatch();
    return () => {
      stopWatch();
    };
  }, [currentUser, startInactivityWatch]);

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
      console.error('Admin Auth failed details - Code:', err.code, 'Message:', err.message, 'Error object:', err);
      const code = err.code || '';
      let message = 'Invalid email or password. Please check your credentials.';
      if (code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
      } else if (code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please wait a moment and try again.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection.';
      } else {
        const cleanMsg = err.message
          ?.replace('Firebase: ', '')
          .replace(/\s*\(auth\/[^)]+\)\.?/, '')
          ?.trim();
        if (cleanMsg && cleanMsg !== 'Error') {
          message = cleanMsg;
        } else {
          message = `Authentication failed (${code || 'unknown'}). Please check your credentials.`;
        }
      }
      return { success: false, message };
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const adminLogout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await logLogout(uid, 'manual');
    try { await signOut(auth); } catch (_) { }
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

  // isAdmin: true when the Firebase user's Firestore document has role='admin' OR email matches ADMIN_EMAIL.
  // This prevents race conditions during async Firestore profile loading.
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const isEmailAdmin = currentUser.email?.toLowerCase().trim() === ADMIN_EMAIL;
    return currentUser.role === 'admin' || currentUser.isAdmin === true || isEmailAdmin;
  }, [currentUser]);

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