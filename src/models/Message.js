import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String
    },
    imagePublicId: {
        type: String
    }
}, { timestamps: true });

// Pre-save validation: Ensure either text OR imageUrl is mapped so ghost blank messages aren't pushed
messageSchema.pre('save', function () {
    if (!this.text && !this.imageUrl) {
        throw new Error('A message must contain either text or an image payload.');
    }
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
