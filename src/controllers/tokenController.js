import crypto from 'crypto';
import razorpayInstance from '../config/razorpay.js';
import TokenPurchase from '../models/TokenPurchase.js';
import TokenTransaction from '../models/TokenTransaction.js';
import User from '../models/User.js';

// Server-Side Strict Pricing Mapping
const PACKAGES = {
    'STARTER': { size: 10, price: 49 },
    'PRO': { size: 20, price: 99 },
    'ELITE': { size: 30, price: 179 }
};

// @desc    Generate a Razorpay Order ID for a Token Pack
// @route   POST /api/tokens/create-order
// @access  Private
export const createTokenOrder = async (req, res) => {
    try {
        const { packType } = req.body;

        if (!packType || !PACKAGES[packType]) {
            return res.status(400).json({ success: false, message: 'Invalid token package selected' });
        }

        const pack = PACKAGES[packType];

        // Ensure razorpayInstance is valid (this uses your existing razorpayX config hook)
        const options = {
            amount: pack.price * 100, // paise
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
        };

        const order = await razorpayInstance.orders.create(options);

        // Pre-create the strict tracking payload
        const tokenPurchase = await TokenPurchase.create({
            user: req.user._id,
            packType: packType,
            packSize: pack.size,
            amountPaid: pack.price,
            razorpayOrderId: order.id,
            status: 'created'
        });

        res.status(200).json({
            success: true,
            orderId: order.id,
            amount: options.amount,
            currency: options.currency,
            packSize: pack.size,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Error in createTokenOrder:', error);
        res.status(500).json({ success: false, message: 'Failed to initialize payment gateway' });
    }
};

// @desc    Verify Razorpay Signature and Mint Tokens
// @route   POST /api/tokens/verify
// @access  Private
export const verifyTokenPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify authenticity of callback
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Fetch our chronological tracking payload
        const purchase = await TokenPurchase.findOne({ razorpayOrderId: razorpay_order_id });

        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Matching order not found' });
        }

        // Critical Idempotency Lock: Prevent Double Credits on retried callbacks
        if (purchase.status === 'paid') {
            return res.status(200).json({ success: true, message: 'Payment already verified previously' });
        }

        // Log the payment
        purchase.status = 'paid';
        purchase.razorpayPaymentId = razorpay_payment_id;
        purchase.razorpaySignature = razorpay_signature;
        await purchase.save();

        // Atomically increment global tokens
        const user = await User.findByIdAndUpdate(
            purchase.user,
            { $inc: { tokens: purchase.packSize } },
            { new: true } // Returns the fresh updated document
        );

        // Defensively build audit trail
        await TokenTransaction.create({
            user: user._id,
            change: purchase.packSize,
            type: 'purchase',
            referenceId: purchase._id
        });

        res.status(200).json({
            success: true,
            message: 'Payment Verified. Tokens added automatically!',
            tokens: user.tokens
        });

    } catch (error) {
        console.error('Error verifying token payment:', error);
        res.status(500).json({ success: false, message: 'Server verification failure' });
    }
};
