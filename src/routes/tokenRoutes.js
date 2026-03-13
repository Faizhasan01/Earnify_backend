import express from 'express';
import { createTokenOrder, verifyTokenPayment } from '../controllers/tokenController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/create-order', protect, createTokenOrder);
router.post('/verify', protect, verifyTokenPayment);

export default router;
