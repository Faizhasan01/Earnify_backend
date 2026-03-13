import express from 'express';
import { register, login, getMe, verifyEmail, requestPasswordReset, resetPassword, updateProfile, updatePassword } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// OTP and Password Reset Routes
router.post('/verify-email', verifyEmail);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Profile Settings Routes
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);

export default router;
