import { db, collection, query, where, getDocs } from './utils/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { code, userId, phone, email, subtotal } = req.body;
    console.log('[Backend Coupon] Validating coupon request:', req.body);

    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing coupon code' });
    }

    const uppercaseCode = code.trim().toUpperCase();

    // 1. Fetch the Welcome Offer settings from Firestore site_settings/welcome_offer
    const welcomeOfferRef = doc(db, 'site_settings', 'welcome_offer');
    const welcomeOfferSnap = await getDoc(welcomeOfferRef);
    
    if (!welcomeOfferSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Welcome offer not configured.' });
    }

    const welcomeOffer = welcomeOfferSnap.data();

    // If code does not match the welcome offer code, return error
    if (uppercaseCode !== welcomeOffer.code.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code.' });
    }

    // Check if welcome offer is enabled
    if (!welcomeOffer.enabled) {
      return res.status(400).json({ success: false, message: 'This coupon is not active.' });
    }

    // Check expiry date
    if (welcomeOffer.expiryDate && new Date(welcomeOffer.expiryDate + 'T23:59:59') < new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    // Check minimum order value
    if (subtotal !== undefined && subtotal !== null && Number(subtotal) < welcomeOffer.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order of ₹${Number(welcomeOffer.minOrderValue).toLocaleString()} required.`
      });
    }

    // Normalizing identifiers for checking order history
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanUserId = (userId && userId !== 'guest') ? userId.trim() : '';

    console.log('[Backend Coupon] Checking eligibility for:', { cleanUserId, cleanPhone, cleanEmail });

    // 2. Scan the orders collection in Firestore to see if any order has completed status or coupon usage
    // We will query all orders matching either userId, phone, or email to perform a strict verification.
    let isFirstTime = true;
    let alreadyUsed = false;

    // Helper to evaluate eligibility on an array of order documents
    const evaluateOrders = (ordersSnap) => {
      ordersSnap.forEach((docSnap) => {
        const order = docSnap.data();
        const status = (order.status || order.orderStatus || '').toLowerCase();
        const orderCoupon = (order.couponCode || '').trim().toUpperCase();

        // An order is completed if its status is 'delivered'
        if (status === 'delivered') {
          isFirstTime = false;
        }

        // An order has coupon code applied if it matches and is not cancelled
        if (orderCoupon === uppercaseCode && status !== 'cancelled') {
          alreadyUsed = true;
        }
      });
    };

    // Query A: Query by userId
    if (cleanUserId) {
      const qUser = query(collection(db, 'orders'), where('userId', '==', cleanUserId));
      const snapUser = await getDocs(qUser);
      evaluateOrders(snapUser);
    }

    // Query B: Query by phone
    if (cleanPhone && (isFirstTime && !alreadyUsed)) {
      const qPhone = query(collection(db, 'orders'), where('phone', '==', phone));
      const snapPhone = await getDocs(qPhone);
      evaluateOrders(snapPhone);

      // Try with cleaned 10-digit number just in case
      if (phone !== cleanPhone) {
        const qCleanPhone = query(collection(db, 'orders'), where('phone', '==', cleanPhone));
        const snapCleanPhone = await getDocs(qCleanPhone);
        evaluateOrders(snapCleanPhone);
      }
    }

    // Query C: Query by email
    if (cleanEmail && (isFirstTime && !alreadyUsed)) {
      const qEmail = query(collection(db, 'orders'), where('userEmail', '==', cleanEmail));
      const snapEmail = await getDocs(qEmail);
      evaluateOrders(snapEmail);

      // Check customerDetails.email
      const qCustEmail = query(collection(db, 'orders'), where('customerDetails.email', '==', cleanEmail));
      const snapCustEmail = await getDocs(qCustEmail);
      evaluateOrders(snapCustEmail);
    }

    // Apply strict validation rules
    if (!isFirstTime || alreadyUsed) {
      console.warn('[Backend Coupon] Eligibility rejected. isFirstTime:', isFirstTime, 'alreadyUsed:', alreadyUsed);
      return res.status(400).json({
        success: false,
        message: 'This coupon is only valid for first-time customers.'
      });
    }

    console.log('[Backend Coupon] Verification passed successfully.');

    return res.status(200).json({
      success: true,
      message: `🎉 Congratulations! ₹${welcomeOffer.discountAmount} Welcome Discount Applied.`,
      discountAmount: Number(welcomeOffer.discountAmount),
      code: welcomeOffer.code
    });

  } catch (error) {
    console.error('[Backend Coupon] Exception thrown in validate-coupon:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during coupon validation.',
      error: error.toString()
    });
  }
}
