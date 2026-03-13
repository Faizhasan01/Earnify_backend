import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Gig from '../models/Gig.js';
import mongoose from 'mongoose';

let razorpayInstance = null;
const getRazorpayInstance = () => {
    if (!razorpayInstance && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
};

export const getRazorpayKey = (req, res) => {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });
};

export const createRazorpayOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Please provide an order ID' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.buyer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to pay for this order' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Order is not in pending status' });
        }

        const options = {
            amount: Math.round(order.amount * 100),
            currency: 'INR',
            receipt: `receipt_order_${order._id}`,
        };

        const razorpay = getRazorpayInstance();
        if (!razorpay) {
            return res.status(500).json({ success: false, message: 'Razorpay is not configured on the server.' });
        }

        const razorpayOrder = await razorpay.orders.create(options);

        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        res.status(200).json({
            success: true,
            razorpayOrder,
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Could not create Razorpay order' });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found in DB' });
        }

        if (order.status === 'paid' || order.razorpayPaymentId) {
            return res.status(400).json({ success: false, message: 'Idempotency reject: Order already paid' });
        }

        if (order.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({ success: false, message: 'Order ID mismatch' });
        }

        const gig = await Gig.findById(order.gig);

        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig associated with order not found' });
        }

        if (gig.status !== 'assigned') {
            return res.status(400).json({ success: false, message: 'Gig is not assigned. Cannot accept payment.' });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        order.razorpayPaymentId = razorpay_payment_id;
        order.status = 'paid';
        await order.save();

        gig.status = 'paid';
        gig.history.push({ status: 'paid' });
        await gig.save();

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully and Escrow Locked.',
            order,
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};
