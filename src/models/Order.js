import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
    {
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Order must belong to a buyer'],
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Order must belong to a seller'],
        },
        gig: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Gig',
            required: [true, 'Order must belong to a gig'],
        },
        amount: {
            type: Number,
            required: [true, 'Order amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'in-progress', 'completed', 'cancelled'],
            default: 'pending',
        },
        razorpayOrderId: {
            type: String,
        },
        razorpayPaymentId: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for fast querying
orderSchema.index({ buyer: 1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ status: 1 }); // Optional

const Order = mongoose.model('Order', orderSchema);

export default Order;
