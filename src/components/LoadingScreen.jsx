import React, { useEffect, useState, useRef } from 'react';

const LoadingScreen = ({ onDone }) => {
  const [fadeOut, setFadeOut] = useState(false);

  // ✅ Stable ref — prevents stale closure if parent re-renders before timers fire
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    // Start fade-out after 1.4s, call onDone after transition ends (1.9s)
    const fadeTimer = setTimeout(() => setFadeOut(true), 1400);
    const doneTimer = setTimeout(() => onDoneRef.current(), 1900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []); // ✅ Safe empty deps — onDone accessed via ref

  return (
    <div
      className={`loading-screen ${fadeOut ? 'loading-screen--out' : ''}`}
      role="status"
      aria-label="Loading SMKP Traders, please wait"
    >
      {/* Decorative ambient blobs — hidden from screen readers */}
      <div className="loading-blob loading-blob--tl" aria-hidden="true" />
      <div className="loading-blob loading-blob--br" aria-hidden="true" />

      <div className="loading-content">

        {/* Logo */}
        <div className="loading-logo-wrap">
          <div className="loading-logo-glow" aria-hidden="true" />
          {/* ✅ alt="" because brand name is already in the h1 below */}
          <img src="/logo.png" alt="" role="presentation" className="loading-logo" />
        </div>

        {/* Brand */}
        <h1 className="loading-brand">SMKP TRADERS</h1>
        <p className="loading-tagline">Quality You Can Trust</p>

        {/* Spinner — decorative, label provided by parent role="status" */}
        <div className="loading-spinner-wrap" aria-hidden="true">
          <div className="loading-spinner" />
        </div>

        {/* ✅ hidden from screen readers — aria-label on parent already says this */}
        <p className="loading-text" aria-hidden="true">Loading SMKP TRADERS...</p>

      </div>
    </div>
  );
};

export default LoadingScreen;