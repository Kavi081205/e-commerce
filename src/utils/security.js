/**
 * security.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central security utilities for SMKP Traders.
 * Covers: rate limiting, input validation, sanitization, data masking, secure IDs.
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const LS_KEY_PREFIX           = '__smkp_rl_';    // localStorage namespace

// ─── RATE LIMITING ────────────────────────────────────────────────────────────

/**
 * Returns the localStorage key for a given identifier (email).
 */
const _rlKey = (id) => `${LS_KEY_PREFIX}${btoa(id.toLowerCase().trim()).replace(/=/g, '')}`;

/**
 * Check if a login identifier is currently rate-limited.
 * @param {string} id — email address
 * @returns {{ blocked: boolean, remainingMs: number, attemptsLeft: number }}
 */
export const checkLoginRateLimit = (id) => {
  try {
    const raw = localStorage.getItem(_rlKey(id));
    if (!raw) return { blocked: false, remainingMs: 0, attemptsLeft: RATE_LIMIT_MAX_ATTEMPTS };

    const data = JSON.parse(raw);
    const now  = Date.now();

    // Reset window if expired
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      localStorage.removeItem(_rlKey(id));
      return { blocked: false, remainingMs: 0, attemptsLeft: RATE_LIMIT_MAX_ATTEMPTS };
    }

    const blocked      = data.attempts >= RATE_LIMIT_MAX_ATTEMPTS;
    const remainingMs  = blocked ? Math.max(0, RATE_LIMIT_WINDOW_MS - (now - data.windowStart)) : 0;
    const attemptsLeft = Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - data.attempts);

    return { blocked, remainingMs, attemptsLeft };
  } catch {
    return { blocked: false, remainingMs: 0, attemptsLeft: RATE_LIMIT_MAX_ATTEMPTS };
  }
};

/**
 * Record a failed login attempt.
 * @param {string} id — email address
 */
export const recordFailedLogin = (id) => {
  try {
    const key = _rlKey(id);
    const raw = localStorage.getItem(key);
    const now = Date.now();

    let data = raw ? JSON.parse(raw) : { attempts: 0, windowStart: now };

    // Reset window if expired
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      data = { attempts: 0, windowStart: now };
    }

    data.attempts += 1;
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* silent — never block UI */ }
};

/**
 * Clear rate-limit record on successful login.
 * @param {string} id — email address
 */
export const clearLoginAttempts = (id) => {
  try {
    localStorage.removeItem(_rlKey(id));
  } catch { /* silent */ }
};

/**
 * Format remaining lockout time as a human-readable string.
 * @param {number} ms — milliseconds remaining
 * @returns {string} e.g. "14:32"
 */
export const formatLockoutTime = (ms) => {
  const totalSec = Math.ceil(ms / 1000);
  const mins     = Math.floor(totalSec / 60);
  const secs     = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ─── INPUT VALIDATION ────────────────────────────────────────────────────────

/**
 * Validate email address (RFC-5322 simplified).
 * @param {string} email
 * @returns {{ valid: boolean, message: string }}
 */
export const validateEmail = (email) => {
  const trimmed = (email || '').trim();
  if (!trimmed) return { valid: false, message: 'Email is required' };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(trimmed)) return { valid: false, message: 'Enter a valid email address' };
  return { valid: true, message: '' };
};

/**
 * Validate Indian mobile phone number (10 digits, starts with 6-9).
 * @param {string} phone
 * @returns {{ valid: boolean, message: string }}
 */
export const validatePhone = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return { valid: false, message: 'Phone number is required' };
  if (digits.length !== 10) return { valid: false, message: 'Phone must be 10 digits' };
  if (!/^[6-9]/.test(digits)) return { valid: false, message: 'Enter a valid Indian mobile number' };
  return { valid: true, message: '' };
};

/**
 * Validate Indian PIN code (6 digits, starts with 1-9).
 * @param {string} pincode
 * @returns {{ valid: boolean, message: string }}
 */
export const validatePincode = (pincode) => {
  const digits = (pincode || '').replace(/\D/g, '');
  if (!digits) return { valid: false, message: 'Pincode is required' };
  if (digits.length !== 6) return { valid: false, message: 'Pincode must be 6 digits' };
  if (!/^[1-9]/.test(digits)) return { valid: false, message: 'Enter a valid Indian PIN code' };
  return { valid: true, message: '' };
};

/**
 * Validate full name (min 3 chars, letters/spaces/dots only).
 * @param {string} name
 * @returns {{ valid: boolean, message: string }}
 */
export const validateName = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return { valid: false, message: 'Name is required' };
  if (trimmed.length < 3) return { valid: false, message: 'Name must be at least 3 characters' };
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return { valid: false, message: 'Name contains invalid characters' };
  return { valid: true, message: '' };
};

/**
 * Validate password strength.
 * Requirements: min 8 chars, uppercase, lowercase, number, special char.
 * @param {string} password
 * @returns {{ valid: boolean, strength: 'weak'|'medium'|'strong', message: string }}
 */
export const validatePassword = (password) => {
  const p = password || '';
  if (!p) return { valid: false, strength: 'weak', message: 'Password is required' };

  const checks = {
    length:  p.length >= 8,
    upper:   /[A-Z]/.test(p),
    lower:   /[a-z]/.test(p),
    number:  /[0-9]/.test(p),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  if (!checks.length) return { valid: false, strength: 'weak', message: 'Password must be at least 8 characters' };
  if (!checks.upper)  return { valid: false, strength: 'weak', message: 'Add at least one uppercase letter' };
  if (!checks.lower)  return { valid: false, strength: 'weak', message: 'Add at least one lowercase letter' };
  if (!checks.number) return { valid: false, strength: 'weak', message: 'Add at least one number' };

  if (!checks.special) {
    return { valid: false, strength: 'medium', message: 'Add a special character (!@#$%^&*)' };
  }

  const strength = passed <= 3 ? 'weak' : passed === 4 ? 'medium' : 'strong';
  return { valid: true, strength, message: '' };
};

// ─── SANITIZATION ─────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and XSS-dangerous characters from a string.
 * @param {string} str
 * @returns {string}
 */
export const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')               // strip HTML tags
    .replace(/[<>"'`]/g, '')               // strip XSS chars
    .replace(/javascript:/gi, '')          // strip JS protocol
    .replace(/on\w+\s*=/gi, '')            // strip inline event handlers
    .trim();
};

// ─── DATA MASKING ────────────────────────────────────────────────────────────

/**
 * Mask a phone number for display: 98765*****
 * @param {string} phone
 * @returns {string}
 */
export const maskPhone = (phone) => {
  const str = (phone || '').replace(/\D/g, '');
  if (str.length < 5) return '**********';
  return str.slice(0, 5) + '*'.repeat(Math.max(0, str.length - 5));
};

/**
 * Mask an email for display: ka***@gmail.com
 * @param {string} email
 * @returns {string}
 */
export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
};

// ─── SECURE ID GENERATION ────────────────────────────────────────────────────

/**
 * Generate a collision-resistant order ID.
 * Format: SMKP-YYYYMMDD-HHMMSS-XXXXXX
 * @returns {string}
 */
export const generateSecureOrderId = () => {
  const now    = new Date();
  const date   = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time   = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SMKP-${date}-${time}-${random}`;
};

// ─── CONTENT SECURITY POLICY CHECK ───────────────────────────────────────────

/**
 * Check if the current page is served over HTTPS (production safety check).
 * @returns {boolean}
 */
export const isSecureContext = () => {
  return typeof window !== 'undefined' &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
};
