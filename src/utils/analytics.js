/**
 * analytics.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised wrapper around Firebase Analytics, Performance Monitoring,
 * and Firestore error logging.
 *
 * Usage:
 *   import { logEvent, logSystemError, logPurchase, logProductView } from './analytics';
 */

import { getAnalytics, logEvent as firebaseLogEvent, isSupported } from 'firebase/analytics';
import { getPerformance } from 'firebase/performance';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';

// ── Lazy-initialise so SSR / environments without window don't crash ──────────
let _analytics = null;
let _performance = null;
let _analyticsReady = false;

const initAnalytics = async () => {
  if (_analyticsReady) return _analytics;
  try {
    const supported = await isSupported();
    if (supported && !import.meta.env.DEV) {
      _analytics = getAnalytics(app);
      // Performance Monitoring (auto-instruments page loads & network requests)
      try { _performance = getPerformance(app); } catch (_) { /* optional */ }
    }
  } catch (err) {
    console.warn('[Analytics] Initialisation skipped:', err.message);
  }
  _analyticsReady = true;
  return _analytics;
};

// Initialise eagerly (non-blocking)
initAnalytics();

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Log a generic Firebase Analytics event.
 * @param {string} name  – event name (snake_case per GA4 convention)
 * @param {Object} params – event parameters
 */
export const logEvent = async (name, params = {}) => {
  try {
    const analytics = await initAnalytics();
    if (analytics) {
      firebaseLogEvent(analytics, name, params);
    }
  } catch (err) {
    console.warn('[Analytics] logEvent failed:', err.message);
  }
};

/**
 * Track a product detail page view (GA4 `view_item`).
 * @param {Object} product – Firestore product document
 */
export const logProductView = async (product) => {
  if (!product?.id) return;
  await logEvent('view_item', {
    currency: 'INR',
    items: [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      price: Number(product.price || 0),
    }],
  });
};

/**
 * Track a completed purchase (GA4 `purchase`).
 * @param {string} orderId
 * @param {number} revenue   – total order value (including shipping)
 * @param {Array}  items     – enriched cart items
 */
export const logPurchase = async (orderId, revenue, items = []) => {
  await logEvent('purchase', {
    transaction_id: orderId,
    value: revenue,
    currency: 'INR',
    items: items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      item_category: item.category,
      price: Number(item.effectivePrice || item.price || 0),
      quantity: item.quantity || 1,
    })),
  });
};

/**
 * Track a login / signup event.
 * @param {'login'|'sign_up'} type
 * @param {string} method – e.g. 'email'
 */
export const logAuthEvent = async (type, method = 'email') => {
  await logEvent(type, { method });
};

/**
 * Log a runtime error both to Firebase Analytics and Firestore `errors` collection.
 * Safe to call anywhere — never throws.
 *
 * @param {Error|string} error   – caught exception or message
 * @param {string}       context – e.g. 'ErrorBoundary', 'Checkout'
 * @param {Object}       extra   – any additional metadata to persist
 */
export const logSystemError = async (error, context = 'unknown', extra = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;

  // Ignore harmless Google logging/CORB warnings
  const ignorePatterns = [
    'log?key=',
    'firebaselogging.googleapis.com',
    'googleapis'
  ];
  const lowerMsg = message.toLowerCase();
  if (ignorePatterns.some(pattern => lowerMsg.includes(pattern))) {
    console.info('[CORB Filter] Ignored system error logging:', message);
    return;
  }

  // 1. Analytics event (non-blocking)
  await logEvent('exception', {
    description: `[${context}] ${message}`,
    fatal: false,
  });

  // 2. Persist to Firestore `errors` collection for admin review
  try {
    await addDoc(collection(db, 'errors'), {
      context,
      message,
      stack: stack ?? null,
      extra,
      createdAt: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
    });
  } catch (writeErr) {
    console.warn('[Analytics] Could not persist error to Firestore:', writeErr.message);
  }
};

export { _performance };
