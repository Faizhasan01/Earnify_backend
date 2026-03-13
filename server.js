import dns from "node:dns";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import Gig from './src/models/Gig.js';
import Conversation from './src/models/Conversation.js';
import Message from './src/models/Message.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket Authentication Middleware
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication Error: No token provided"));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (err) {
        return next(new Error("Authentication Error: Invalid token"));
    }
});

io.on('connection', (socket) => {
    console.log(`Socket connected securely: ${socket.id} for internal User ID: ${socket.userId}`);

    // JOIN A SPECIFIC GIG'S CONVERSATION ROOM
    socket.on('join_conversation', async ({ gigId }) => {
        try {
            const gig = await Gig.findById(gigId);
            if (!gig) return socket.emit('chat_error', { message: 'Gig not found' });
            if (gig.status === 'completed') return socket.emit('chat_error', { message: 'Chat permanently closed - task completed' });

            // Validate participant
            if (gig.owner.toString() !== socket.userId && (!gig.assignedTo || gig.assignedTo.toString() !== socket.userId)) {
                return socket.emit('chat_error', { message: 'Unauthorized to join this conversation' });
            }

            const conversation = await Conversation.findOne({ gig: gigId, isActive: true });
            if (!conversation) return socket.emit('chat_error', { message: 'Conversation not active or does not exist' });

            const roomName = conversation._id.toString();
            socket.join(roomName);
            console.log(`User ${socket.userId} securely injected into room: ${roomName}`);
        } catch (error) {
            console.error('Socket Join Error:', error);
            socket.emit('chat_error', { message: 'Internal Server Error' });
        }
    });

    // TRANSMIT AND SAVE SECURE MESSAGE
    socket.on('send_message', async (data) => {
        try {
            const { conversationId, text, imageUrl, imagePublicId } = data;
            if (!conversationId) return socket.emit('chat_error', { message: 'Missing conversationId' });
            if (!text && !imageUrl) return socket.emit('chat_error', { message: 'Cannot emit empty message payload' });

            const conversation = await Conversation.findById(conversationId);
            if (!conversation || !conversation.isActive) {
                return socket.emit('chat_error', { message: 'Conversation is disabled or missing' });
            }

            // Verify Participant Native Level
            const isAuthorized = conversation.participants.some(p => p.toString() === socket.userId.toString());
            if (!isAuthorized) {
                return socket.emit('chat_error', { message: 'Unauthorized send attempt blocked' });
            }

            // Build payload and map native DB
            const newMessage = await Message.create({
                conversation: conversationId,
                sender: socket.userId,
                text,
                imageUrl,
                imagePublicId
            });

            // Native Populating
            await newMessage.populate('sender', 'name email');

            // Broadcast selectively to room scope exclusively
            io.to(conversationId).emit('receive_message', newMessage);

        } catch (error) {
            console.error('Socket Send Error Stack Trace:', error);
            socket.emit('chat_error', { message: error.message || 'Internal send error' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const startServer = async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
};

startServer();
