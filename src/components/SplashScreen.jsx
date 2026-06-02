import React, { useEffect, useState, useRef } from 'react';
import logo from '../assets/logo.png';

const STORAGE_KEY = 'smkp_visited';

const SplashScreen = ({ onDone }) => {
  const [phase, setPhase] = useState('in'); // 'in' | 'hold' | 'out'

  // ✅ Keep a stable ref to onDone so timers never call a stale closure
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    // Phase timeline: 300ms (ease-in) → 1800ms (hold) → 500ms (fade-out)
    const holdTimer = setTimeout(() => setPhase('hold'), 300);
    const outTimer = setTimeout(() => setPhase('out'), 2100);
    const doneTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, '1');
      onDoneRef.current(); // ✅ Always calls the latest onDone
    }, 2700);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, []); // ✅ Empty deps — runs once; onDone is accessed via ref

  // ✅ Derived boolean avoids repeating `phase !== 'in'` three times
  const isVisible = phase !== 'in';

  return (
    // ✅ aria-label + aria-live so screen readers announce the splash
    <div
      className={`splash-screen splash-screen--${phase}`}
      role="status"
      aria-label="Loading SMKP Traders"
      aria-live="polite"
    >
      {/* Ambient blobs */}
      <div className="splash-blob splash-blob--tl" aria-hidden="true" />
      <div className="splash-blob splash-blob--br" aria-hidden="true" />

      <div className="splash-content">
        <div className={`splash-logo-wrap ${isVisible ? 'splash-logo-wrap--visible' : ''}`}>
          <div className="splash-logo-glow" aria-hidden="true" />
          <img src={logo} alt="SMKP Traders logo" className="splash-logo" />
        </div>

        <div className={`splash-text-wrap ${isVisible ? 'splash-text-wrap--visible' : ''}`}>
          <h1 className="splash-brand">Welcome to SMKP TRADERS</h1>
          <p className="splash-tagline">Quality You Can Trust</p>
        </div>

        {/* Gold accent line */}
        <div
          className={`splash-line ${isVisible ? 'splash-line--visible' : ''}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

// ✅ SSR-safe: guard against environments where localStorage doesn't exist
export const shouldShowSplash = () => {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false; // If localStorage is unavailable, skip the splash
  }
};

export default SplashScreen;