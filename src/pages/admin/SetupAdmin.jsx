/**
 * SetupAdmin.jsx — One-time admin role provisioning tool
 *
 * Visit /admin/setup while logged in as your admin Firebase account.
 * After running successfully, remove this route from App.jsx.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import logo from '../../assets/logo.png';
import { ShieldCheck, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react';

// fix #1: use getAuth() with no argument — relies on default Firebase app
const auth = getAuth();

const SetupAdmin = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [existingRole, setExistingRole] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // fix #2: wrap getDoc in try/catch so Firestore errors surface
        try {
          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setExistingRole(snap.data().role);
          }
        } catch (err) {
          console.error('Failed to fetch existing role:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleSetupAdmin = async () => {
    if (!user) {
      setStatus('error');
      setMessage('You must be logged in to Firebase Auth first. Go to /admin-login.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      // fix #3: guard against null email (e.g. phone-auth users)
      const displayName =
        user.displayName ||
        (user.email ? user.email.split('@')[0] : user.uid);

      await setDoc(
        doc(db, 'users', user.uid),
        {
          displayName,
          email: user.email ?? '',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setStatus('success');
      setExistingRole('admin');
      setMessage(`Admin role granted to ${user.email ?? user.uid} (UID: ${user.uid})`);
    } catch (err) {
      console.error('Setup error:', err);
      setStatus('error');
      if (err.code === 'permission-denied') {
        setMessage(
          'Permission denied. Your Firestore rules block writing to the users collection. ' +
          'Temporarily set rules to: allow write: if request.auth != null; — then run setup, then restore strict rules.'
        );
      } else {
        setMessage(`Error: ${err.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src={logo} alt="Logo" className="h-20 w-auto mx-auto object-contain" />
          </div>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
            <ShieldCheck size={32} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Setup Tool</h1>
          <p className="text-gray-400 text-sm mt-2">One-time Firestore role provisioning</p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-900 border border-yellow-900/30 rounded-2xl overflow-hidden shadow-2xl">

          {/* Auth Status */}
          <div className="px-6 py-4 border-b border-gray-800">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Logged-in Firebase User</p>
            {user ? (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <div>
                  <p className="text-white font-bold text-sm">{user.email ?? '(no email)'}</p>
                  <p className="text-gray-500 text-xs font-mono">{user.uid}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <AlertCircle size={16} />
                Not logged in — go to <Link to="/admin-login" className="underline">/admin-login</Link> first
              </div>
            )}
          </div>

          {/* fix #5: only render existingRole banner once user is confirmed */}
          {existingRole && user && (
            <div className="px-6 py-3 bg-yellow-500/5 border-b border-gray-800">
              <p className="text-xs text-yellow-400 font-bold">
                ✓ users/{user.uid} already exists with role: <span className="uppercase">{existingRole}</span>
              </p>
            </div>
          )}

          <div className="p-6 space-y-5">

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
              <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300 space-y-1 leading-relaxed">
                <p className="font-bold">What this does:</p>
                <p>Creates <code className="bg-blue-900/40 px-1 rounded">users/{'{'}uid{'}'}</code> in Firestore with <code className="bg-blue-900/40 px-1 rounded">role: "admin"</code>.</p>
                <p>Your Firestore rules will then allow this UID to write to products &amp; orders.</p>
              </div>
            </div>

            {/* Status Messages */}
            {status === 'success' && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex gap-3">
                <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-400 font-black text-sm">Setup Complete!</p>
                  <p className="text-green-300 text-xs mt-1">{message}</p>
                  <p className="text-gray-400 text-xs mt-2">
                    Now paste the Firestore rules below and remove this route from App.jsx.
                  </p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs leading-relaxed">{message}</p>
              </div>
            )}

            {/* fix #4: disable button after successful setup to prevent re-runs */}
            <button
              onClick={handleSetupAdmin}
              disabled={!user || status === 'loading' || status === 'success'}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2
                ${!user || status === 'loading' || status === 'success'
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-600/20 active:scale-95'
                }`}
            >
              {status === 'loading'
                ? <><Loader2 size={16} className="animate-spin" /> Provisioning...</>
                : status === 'success'
                  ? <><CheckCircle size={16} /> Role Granted</>
                  : <><ShieldCheck size={16} /> Grant Admin Role</>
              }
            </button>

            {/* Firestore Rules */}
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                Step 2 — Paste these rules in Firebase Console → Firestore → Rules
              </p>
              <pre className="bg-slate-950 border border-gray-700 rounded-xl p-4 text-xs text-yellow-300 overflow-x-auto leading-relaxed font-mono">
                {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /orders/{orderId} {
      allow create: if request.auth != null;
      allow read, update: if isAdmin() || 
        request.auth.uid == resource.data.userId;
    }

    match /users/{userId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == userId || isAdmin());
    }

    match /wishlist/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
  }
}`}
              </pre>
            </div>

          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Remove <code className="text-gray-400">/admin/setup</code> route from App.jsx after completing setup.
        </p>
      </div>
    </div>
  );
};

export default SetupAdmin;