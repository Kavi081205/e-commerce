import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (!razorpayKeyId || !razorpayKeySecret) {
  console.error('ERROR: Razorpay key credentials are missing in .env file!');
}

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

export default razorpay;
