import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to local MongoDB');

        const users = [
            {
                name: 'Faiz',
                email: 'hfaiz6750@gmail.com',
                password: '12345678',
                role: 'freelancer',
                isVerified: true,
                tokens: 50
            },
            {
                name: 'Sussy Baka',
                email: 'sussybaka00199@gmail.com',
                password: '12345678',
                role: 'buyer',
                isVerified: true,
                tokens: 50
            }
        ];

        for (let u of users) {
            const existing = await User.findOne({ email: u.email });
            if (!existing) {
                await User.create(u);
                console.log(`Created user ${u.email}`);
            } else {
                console.log(`User ${u.email} already exists`);
                existing.isVerified = true;
                existing.tokens = 50;
                existing.password = '12345678';
                await existing.save();
            }
        }

        console.log('Seed complete');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
