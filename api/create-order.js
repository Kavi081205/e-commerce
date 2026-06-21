import Razorpay from 'razorpay';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { amount } = req.body;
    console.log('[Backend] Incoming request to /api/create-order with body:', req.body);

    // Validate request body
    if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) {
      console.error('[Backend] Validation failed: Invalid or missing amount:', amount);
      return res.status(400).json({ success: false, message: 'Invalid or missing amount' });
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      console.error('[Backend] Error: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined in environment variables.');
      return res.status(500).json({ success: false, message: 'Server configuration error: Razorpay keys are not set.' });
    }

    console.log('[Backend] Initializing Razorpay SDK with Key ID prefix:', key_id.substring(0, 8) + '...');
    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });
    console.log('[Backend] Razorpay SDK initialized successfully.');

    const amountInPaise = Math.round(Number(amount));
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    console.log('[Backend] Calling razorpay.orders.create with options:', options);
    const order = await razorpay.orders.create(options);
    console.log('[Backend] razorpay.orders.create succeeded. Order:', order);

    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      }
    });
  } catch (error) {
    console.error('[Backend] Exception thrown in create-order serverless function:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create order',
      code: error.error?.code || error.code || null,
      description: error.error?.description || error.description || null,
      raw: error
    });
  }
}
