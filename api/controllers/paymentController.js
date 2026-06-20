import razorpay from '../utils/razorpay.js';
import crypto from 'crypto';

export const createOrder = async (req, res) => {
  try {
    // 7. Log that the endpoint was reached and print process.env.RAZORPAY_KEY_ID
    console.log('[Backend] Incoming request to /api/create-order');
    console.log('[Backend] RAZORPAY_KEY_ID loaded:', process.env.RAZORPAY_KEY_ID);

    const { amount } = req.body;
    console.log('[Backend] Incoming request body:', req.body);

    if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) {
      console.warn('[Backend] Invalid amount validation failed:', amount);
      return res.status(400).json({ success: false, message: 'Invalid or missing amount' });
    }

    // Amount must be an integer in paise (e.g. ₹500.00 is 50000 paise)
    const amountInPaise = Math.round(Number(amount));

    // 4. Ensure backend creates order like options
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    console.log('[Backend] Razorpay order creation options:', options);

    const order = await razorpay.orders.create(options);
    console.log('[Backend] Razorpay API response:', order);

    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      }
    });
  } catch (error) {
    console.error('[Backend] Exception thrown in createOrder:', error);
    
    // 3. Return Razorpay specific error details if available
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create order',
      code: error.error?.code || error.code || null,
      description: error.error?.description || error.description || null
    });
  }
};

export const verifyPayment = (req, res) => {
  try {
    console.log('[Backend] Incoming request to /api/verify-payment');
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    console.log('[Backend] Incoming request body:', req.body);

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      console.warn('[Backend] Missing verification details in request.');
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('[Backend] RAZORPAY_KEY_SECRET not set in environment.');
      return res.status(500).json({ success: false, message: 'Razorpay secret key not found in backend' });
    }

    // Verify signature using HMAC SHA256
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      console.log('[Backend] Signature verification passed.');
      return res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      console.warn('[Backend] Razorpay signature mismatch.');
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }
  } catch (error) {
    console.error('[Backend] Exception thrown in verifyPayment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
};
