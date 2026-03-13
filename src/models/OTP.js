import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Please provide an email'],
        },
        otp: {
            type: String,
            required: [true, 'OTP is required'],
        },
        purpose: {
            type: String,
            enum: ['verify', 'reset'],
            required: [true, 'Purpose is required'],
        },
        expiresAt: {
            type: Date,
            required: [true, 'Expiry time is required'],
            expires: 0, // TTL index: document will be automatically deleted when expiresAt is reached
        },
        attempts: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
