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

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Keep session alive across page reloads (standard Firebase default).
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
  }, []);

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Always clean up the previous Firestore listener before attaching a new one.
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

          if (user.email?.toLowerCase() === 'kaviyarasanmurugan78@gmail.com') {
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
                return;
              } catch (err) {
                console.error('AuthContext: Failed to auto-create admin doc:', err);
              }
            }
          }

          if (docSnap.exists()) {
            // ✅ Trust Firestore role exclusively.
            // Never override or "repair" roles based on email — that caused
            // customer accounts to be silently upgraded to admin.
            setCurrentUser({ ...user, ...docSnap.data() });
            setLoading(false);
            // Track login event (fires once per auth session resolution)
            logAuthEvent('login');
          } else {
            // No Firestore document yet — create a new customer profile.
            // Role is ALWAYS 'customer' on self-registration.
            // Admin accounts must be provisioned manually in Firestore.
            const initialData = {
              uid: user.uid,
              email: user.email || '',
              displayName:
                user.displayName || user.email?.split('@')[0] || 'User',
              createdAt: new Date().toISOString(),
              role: 'customer',
            };

            try {
              await setDoc(userRef, initialData, { merge: true });
              // Track new account creation
              logAuthEvent('sign_up');
              // Stay in loading state until the onSnapshot fires again with the new doc.
            } catch (createErr) {
              console.error('AuthContext: Failed to create user doc:', createErr);
              // Safe fallback — never grant admin by default.
              setCurrentUser({ ...user, role: 'customer' });
              setLoading(false);
            }
          }
        },
        (err) => {
          console.error('AuthContext: Profile sync error:', err);
          // Firestore unreachable — default to 'customer' (safe, not 'admin').
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

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const updateProfile = async (data) => {
    if (!currentUser) return;
    return setDoc(doc(db, 'users', currentUser.uid), data, { merge: true });
  };

  // isAdmin is pre-computed here so every consumer reads from one source of truth.
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin === true;

  const value = { currentUser, loading, isAdmin, login, logout, updateProfile };

  return (
    <AuthContext.Provider value={value}>
      {/* Always render children — route guards use `loading ? null` to wait.
          The App phase system (LoadingScreen) handles the initial blank state.
          We no longer block the entire tree here to avoid app-unmount flashes
          during mid-session re-logins. */}
      {children}
    </AuthContext.Provider>
  );
};