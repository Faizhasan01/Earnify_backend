import mongoose from 'mongoose';

const tokenTransactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        change: {
            type: Number, // e.g., +50 for purchase, -2 for accepting 
            required: true,
        },
        type: {
            type: String,
            enum: ['purchase', 'task_accept', 'admin_adjustment'],
            required: true,
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true, // E.g., The TokenPurchase ID or the Gig ID
        }
    },
    {
        timestamps: true,
        // Optional immutable constraint: transactions shouldn't be edited once written
    }
);

// High velocity queries for User ledger calculations
tokenTransactionSchema.index({ user: 1, createdAt: -1 });

const TokenTransaction = mongoose.model('TokenTransaction', tokenTransactionSchema);
export default TokenTransaction;
