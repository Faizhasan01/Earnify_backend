import express from 'express';
import { createRazorpayOrder, verifyPayment, getRazorpayKey } from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/key', protect, getRazorpayKey);
router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify', protect, verifyPayment);

export default router;
