import mongoose from 'mongoose';

const tokenPurchaseSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        packType: {
            type: String,
            required: true,
            enum: ['STARTER', 'PRO', 'ELITE']
        },
        packSize: {
            type: Number,
            required: true,
        },
        amountPaid: {
            type: Number,
            required: true, // In INR (rupees)
        },
        razorpayOrderId: {
            type: String,
            required: true,
        },
        razorpayPaymentId: {
            type: String,
        },
        razorpaySignature: {
            type: String,
        },
        status: {
            type: String,
            enum: ['created', 'paid', 'failed'],
            default: 'created',
        }
    },
    {
        timestamps: true,
    }
);

// Optimize checking order status
tokenPurchaseSchema.index({ razorpayOrderId: 1 });

const TokenPurchase = mongoose.model('TokenPurchase', tokenPurchaseSchema);
export default TokenPurchase;
