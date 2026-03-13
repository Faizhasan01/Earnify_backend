import mongoose from 'mongoose';

const gigSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Please provide a gig title'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Please provide a gig description'],
        },
        price: {
            type: Number,
            required: [true, 'Please provide a gig price'],
            min: [0, 'Price cannot be negative'],
        },
        category: {
            type: String,
            required: [true, 'Please select a category'],
            enum: ['notes', 'assignment', 'delivery', 'tutoring', 'other', 'academic', 'errand', 'technical'],
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Owner reference is required'],
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        imageUrl: {
            type: String,
            default: null,
        },
        imagePublicId: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['open', 'assigned', 'submitted', 'completed'],
            default: 'open',
        },
        submittedAt: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        history: [
            {
                status: String,
                updatedAt: { type: Date, default: Date.now },
            }
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

gigSchema.index({ owner: 1 });
gigSchema.index({ assignedTo: 1 });

const Gig = mongoose.model('Gig', gigSchema);

export default Gig;
