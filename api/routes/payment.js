import express from 'express';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/api/create-order', createOrder);
router.post('/api/verify-payment', verifyPayment);

export default router;
