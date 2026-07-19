require('dotenv').config();
// Connects to local emulator or production depending on environment variables

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp();

const app = express();

app.use((req, res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});

app.use(cors({
 origin: true,
 credentials: true
}));

app.options("*", cors());

app.use(express.json());

/**
 * Route: Health Check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

console.log("--- REGISTERED EXPRESS ROUTES ---");
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(', ');
    console.log(`Route: [${methods}] ${r.route.path}`);
  }
});
console.log("---------------------------------");

exports.api = functions.https.onRequest(app);

const db = admin.firestore();

exports.validateOrderCoupon = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const orderData = snap.data();
    const couponCode = (orderData.couponCode || '').trim().toUpperCase();
    
    if (!couponCode) return;

    // Fetch welcome offer config from site_settings/welcome_offer doc
    const welcomeOfferSnap = await db.doc('site_settings/welcome_offer').get();
    if (!welcomeOfferSnap.exists) return;
    
    const welcomeOffer = welcomeOfferSnap.data();
    const welcomeOfferCode = (welcomeOffer.code || 'FIRSTORDER').trim().toUpperCase();
    
    // Only intercept if the applied coupon code is the Welcome Offer code
    if (couponCode !== welcomeOfferCode) return;

    // Check configuration status
    if (!welcomeOffer.enabled) {
      console.warn(`[Backend Trigger] Welcome offer is disabled but used in order ${snap.id}. Cancelling.`);
      await snap.ref.update({
        status: 'cancelled',
        orderStatus: 'cancelled',
        couponDiscount: 0,
        totalPrice: orderData.totalPrice + (orderData.couponDiscount || 0),
        profit: orderData.profit + (orderData.couponDiscount || 0),
        cancellationReason: 'Welcome offer is currently disabled.'
      });
      return;
    }

    const userId = orderData.userId;
    const phone = orderData.phone;
    const email = orderData.userEmail || (orderData.customerDetails && orderData.customerDetails.email);

    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanUserId = (userId && userId !== 'guest') ? userId.trim() : '';

    console.log('[Backend Trigger] Validating eligibility for order:', snap.id, { cleanUserId, cleanPhone, cleanEmail });

    let isEligible = true;

    const checkOrders = (snapshot) => {
      let violation = false;
      snapshot.forEach(docSnap => {
        if (docSnap.id === snap.id) return; // ignore current order

        const otherOrder = docSnap.data();
        const status = (otherOrder.status || otherOrder.orderStatus || '').toLowerCase();
        const otherCoupon = (otherOrder.couponCode || '').trim().toUpperCase();

        // Delivered order means they are not a first-time buyer
        if (status === 'delivered') {
          violation = true;
        }
        // If they already have an active order with this coupon code
        if (otherCoupon === welcomeOfferCode && status !== 'cancelled') {
          violation = true;
        }
      });
      return violation;
    };

    // 1. Check by userId
    if (cleanUserId && cleanUserId !== 'guest') {
      const snapUser = await db.collection('orders').where('userId', '==', cleanUserId).get();
      if (checkOrders(snapUser)) isEligible = false;
    }

    // 2. Check by phone number
    if (cleanPhone && isEligible) {
      const snapPhone = await db.collection('orders').where('phone', '==', phone).get();
      if (checkOrders(snapPhone)) isEligible = false;

      if (phone !== cleanPhone && isEligible) {
        const snapCleanPhone = await db.collection('orders').where('phone', '==', cleanPhone).get();
        if (checkOrders(snapCleanPhone)) isEligible = false;
      }
    }

    // 3. Check by email
    if (cleanEmail && cleanEmail !== 'unknown' && isEligible) {
      const snapEmail = await db.collection('orders').where('userEmail', '==', cleanEmail).get();
      if (checkOrders(snapEmail)) isEligible = false;

      const snapCustEmail = await db.collection('orders').where('customerDetails.email', '==', cleanEmail).get();
      if (checkOrders(snapCustEmail)) isEligible = false;
    }

    // If validation fails, update the order as cancelled with a reason
    if (!isEligible) {
      console.warn(`[Backend Trigger] Reverting welcome offer for order ${snap.id} because the customer is not a first-time buyer.`);
      
      const discountApplied = Number(orderData.couponDiscount || 0);
      
      await snap.ref.update({
        status: 'cancelled',
        orderStatus: 'cancelled',
        couponDiscount: 0,
        totalPrice: Number(orderData.totalPrice || 0) + discountApplied,
        profit: Number(orderData.profit || 0) + discountApplied,
        cancellationReason: 'This coupon is only valid for first-time customers.'
      });
    } else {
      console.log('[Backend Trigger] Order welcome offer validation passed.');
    }
  });
