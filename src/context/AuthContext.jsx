import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';
import { logAuthEvent } from '../utils/analytics';

const auth = getAuth(app);

// ─── Admin Credentials ────────────────────────────────────────────────────────
// These are the ONLY credentials that grant admin access.
const ADMIN_EMAIL    = (import.meta.env.VITE_ADMIN_EMAIL    || 'kaviyarasanmurugan78@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD =  import.meta.env.VITE_ADMIN_PASSWORD || 'kavi0812@';

// localStorage key for persisting the admin session across page reloads.
const ADMIN_SESSION_KEY = '__admin_session__';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser]     = useState(null);
  const [loading, setLoading]             = useState(true);
  // Local admin session: set when adminLogin() succeeds.
  const [adminSession, setAdminSession]   = useState(
    () => localStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  );

  // Keep Firebase session alive across page reloads.
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
  }, []);

  // ── Firebase Auth listener (handles regular customer accounts) ──────────────
  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous Firestore listener.
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);

      unsubscribeProfile = onSnapshot(
        userRef,
        async (docSnap) => {
          let userData = docSnap.data();

          // Auto-provision admin Firestore document when admin email signs in via Firebase.
          if (user.email?.toLowerCase().trim() === ADMIN_EMAIL) {
            if (!docSnap.exists() || userData?.role !== 'admin' || !userData?.isAdmin) {
              const adminData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Kaviyarasan',
                role: 'admin',
                isAdmin: true,
                createdAt: userData?.createdAt || new Date().toISOString()
              };
              try {
                await setDoc(userRef, adminData, { merge: true });
                return; // Wait for snapshot to re-fire with the updated data.
              } catch (err) {
                console.error('AuthContext: Failed to auto-create admin doc:', err);
              }
            }
          }

          if (docSnap.exists()) {
            setCurrentUser({ ...user, ...docSnap.data() });
            setLoading(false);
            logAuthEvent('login');
          } else {
            // New customer — create profile with role 'customer' (never 'admin').
            const initialData = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              createdAt: new Date().toISOString(),
              role: 'customer',
            };
            try {
              await setDoc(userRef, initialData, { merge: true });
              logAuthEvent('sign_up');
            } catch (createErr) {
              console.error('AuthContext: Failed to create user doc:', createErr);
              setCurrentUser({ ...user, role: 'customer' });
              setLoading(false);
            }
          }
        },
        (err) => {
          console.error('AuthContext: Profile sync error:', err);
          setCurrentUser({ ...user, role: 'customer' });
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // ── Admin Login (direct credential check — no Firebase account required) ─────
  /**
   * Validates email + password directly against the env-configured admin
   * credentials.  On success, persists the session to localStorage so it
   * survives page reloads, and returns { success: true }.
   * On failure, returns { success: false, message: '...' }.
   */
  const adminLogin = (email, password) => {
    const emailTrimmed    = (email    || '').toLowerCase().trim();
    const passwordTrimmed = (password || '').trim();

    if (emailTrimmed === ADMIN_EMAIL && passwordTrimmed === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      setAdminSession(true);
      return { success: true };
    }

    return {
      success: false,
      message: 'Invalid email or password. Please check your credentials.'
    };
  };

  // ── Admin Logout ─────────────────────────────────────────────────────────────
  const adminLogout = async () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminSession(false);
    // Also sign out of Firebase if a Firebase session exists.
    try { await signOut(auth); } catch (_) {}
  };

  // ── Regular Firebase login (customer accounts) ───────────────────────────────
  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = async () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminSession(false);
    return signOut(auth);
  };

  const updateProfile = async (data) => {
    if (!currentUser) return;
    return setDoc(doc(db, 'users', currentUser.uid), data, { merge: true });
  };

  // isAdmin is true when:
  //  a) the local admin session is active (set by adminLogin), OR
  //  b) the Firebase user's Firestore document has role='admin' or isAdmin=true.
  const isAdmin =
    adminSession ||
    currentUser?.role === 'admin' ||
    currentUser?.isAdmin === true;

  const value = {
    currentUser,
    loading,
    isAdmin,
    adminSession,
    login,
    logout,
    adminLogin,
    adminLogout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};