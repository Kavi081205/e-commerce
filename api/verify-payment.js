/**
 * api/verify-payment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — Razorpay Payment Signature Verification
 *
 * POST /api/verify-payment
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *
 * Returns: { verified: true } or { verified: false, error: '...' }
 *
 * The Razorpay secret key (RAZORPAY_SECRET) is ONLY available server-side.
 * It is NEVER sent to the browser. This prevents payment tampering.
 *
 * Setup: Add RAZORPAY_SECRET to Vercel project environment variables
 * (do NOT prefix with VITE_ — keep it server-side only).
 */

import crypto from 'crypto';

// Simple in-memory rate limiter (resets per function cold-start — sufficient for edge protection)
const requestLog = new Map();
const RATE_WINDOW_MS  = 60 * 1000; // 1 minute
const RATE_MAX_CALLS  = 20;        // max 20 verification calls per IP per minute

function isRateLimited(ip) {
  const now  = Date.now();
  const data = requestLog.get(ip) || { count: 0, windowStart: now };

  if (now - data.windowStart > RATE_WINDOW_MS) {
    // Reset window
    requestLog.set(ip, { count: 1, windowStart: now });
    return false;
  }

  data.count += 1;
  requestLog.set(ip, data);
  return data.count > RATE_MAX_CALLS;
}

export default function handler(req, res) {
  // ── CORS: only allow requests from your production domain ────────────────────
  const allowedOrigins = [
    'https://e-commerce-smkp-traders.vercel.app',
    'https://smkptraders.com',
    'https://www.smkptraders.com',
  ];
  const origin = req.headers.origin || '';

  // In development, also allow localhost
  if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Method guard ─────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ verified: false, error: 'Method not allowed' });
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ verified: false, error: 'Too many requests. Please try again later.' });
  }

  // ── Check secret is configured ───────────────────────────────────────────────
  const secret = process.env.RAZORPAY_SECRET;
  if (!secret) {
    console.error('[verify-payment] RAZORPAY_SECRET is not configured.');
    // Return success:false so the order is not created — fail safe
    return res.status(500).json({ verified: false, error: 'Payment verification service unavailable.' });
  }

  // ── Validate request body ────────────────────────────────────────────────────
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: 'Missing required payment fields.' });
  }

  // ── HMAC-SHA256 Verification ─────────────────────────────────────────────────
  // Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
  try {
    const body      = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected  = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (isValid) {
      return res.status(200).json({ verified: true });
    } else {
      console.warn('[verify-payment] Signature mismatch — possible tampering attempt.', { clientIp });
      return res.status(200).json({ verified: false, error: 'Payment signature is invalid.' });
    }
  } catch (err) {
    console.error('[verify-payment] Verification error:', err.message);
    return res.status(500).json({ verified: false, error: 'Verification failed. Please contact support.' });
  }
}
