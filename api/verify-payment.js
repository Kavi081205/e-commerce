import crypto from 'crypto';

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
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    console.log('[Backend] Incoming request to /api/verify-payment with body:', req.body);

    // Validate body inputs
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      console.error('[Backend] Validation failed: Missing payment verification fields:', req.body);
      return res.status(400).json({ success: false, message: 'Missing payment verification details' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('[Backend] Error: RAZORPAY_KEY_SECRET is not defined in environment variables.');
      return res.status(500).json({ success: false, message: 'Server configuration error: Razorpay secret is not set.' });
    }

    console.log('[Backend] Generating signature using HMAC SHA256...');
    // Verify signature using crypto.createHmac
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    console.log('[Backend] Generated signature:', generated_signature);
    console.log('[Backend] Received signature:', razorpay_signature);

    if (generated_signature === razorpay_signature) {
      console.log('[Backend] Razorpay signature verification passed.');
      return res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      console.error('[Backend] Razorpay signature verification failed. Mismatch between generated and received signature.');
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }
  } catch (error) {
    console.error('[Backend] Exception thrown in verify-payment serverless function:', error);
    return res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
}
