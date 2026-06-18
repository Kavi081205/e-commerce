/**
 * activityLog.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Secure activity logging to Firestore `activity_logs` collection.
 * All admin actions, login events, and order changes are tracked here.
 * Only admins can READ these logs (enforced by Firestore rules).
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const _getClientInfo = () => ({
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  url:       typeof window    !== 'undefined' ? window.location.href : null,
  timestamp: new Date().toISOString(),
});

/**
 * Base writer — all log functions funnel through here.
 * Never throws — logging must never break the main flow.
 */
const _writeLog = async (entry) => {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      ...entry,
      ..._getClientInfo(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Silent fail — logging should never block the user
    console.warn('[ActivityLog] Failed to write log:', err?.message);
  }
};

// ─── ADMIN ACTIONS ────────────────────────────────────────────────────────────

/**
 * Log an admin panel action (login, product edit, order update, etc.)
 * @param {string} action  — e.g. 'admin_login', 'product_updated', 'order_status_changed'
 * @param {Object} details — additional context
 * @param {string} adminId — Firebase UID of the admin
 */
export const logAdminAction = async (action, details = {}, adminId = null) => {
  await _writeLog({
    type:    'admin_action',
    action,
    adminId,
    details,
  });
};

// ─── AUTH EVENTS ──────────────────────────────────────────────────────────────

/**
 * Log a failed login attempt (for brute-force monitoring).
 * @param {string} email  — attempted email
 * @param {string} source — 'admin_login' | 'customer_login'
 */
export const logFailedLogin = async (email, source = 'customer_login') => {
  await _writeLog({
    type:   'failed_login',
    action: 'login_failed',
    email:  email ? email.toLowerCase().trim() : null,
    source,
  });
};

/**
 * Log a successful login.
 * @param {string} userId  — Firebase UID
 * @param {string} email
 * @param {string} source  — 'admin_login' | 'customer_login' | 'google'
 */
export const logSuccessfulLogin = async (userId, email, source = 'customer_login') => {
  await _writeLog({
    type:   'auth_event',
    action: 'login_success',
    userId,
    email:  email ? email.toLowerCase().trim() : null,
    source,
  });
};

/**
 * Log a logout event.
 * @param {string} userId
 * @param {string} reason — 'manual' | 'inactivity' | 'security'
 */
export const logLogout = async (userId, reason = 'manual') => {
  await _writeLog({
    type:   'auth_event',
    action: 'logout',
    userId,
    reason,
  });
};

// ─── ORDER EVENTS ─────────────────────────────────────────────────────────────

/**
 * Log an order lifecycle event.
 * @param {string} orderId
 * @param {string} event   — 'order_created' | 'status_changed' | 'order_cancelled'
 * @param {Object} details — { oldStatus, newStatus, updatedBy, etc. }
 */
export const logOrderEvent = async (orderId, event, details = {}) => {
  await _writeLog({
    type:    'order_event',
    action:  event,
    orderId,
    details,
  });
};

// ─── SECURITY EVENTS ──────────────────────────────────────────────────────────

/**
 * Log a security-relevant event (rate limit hit, suspicious activity, etc.)
 * @param {string} event   — e.g. 'rate_limit_hit', 'payment_verify_failed'
 * @param {Object} details
 */
export const logSecurityEvent = async (event, details = {}) => {
  await _writeLog({
    type:    'security_event',
    action:  event,
    details,
  });
};

/**
 * Log when an admin reveals a masked customer phone number.
 * @param {string} orderId   — which order's phone was revealed
 * @param {string} adminId   — who revealed it
 */
export const logPhoneReveal = async (orderId, adminId) => {
  await _writeLog({
    type:    'security_event',
    action:  'phone_number_revealed',
    orderId,
    adminId,
    details: { sensitiveDataAccess: true },
  });
};
