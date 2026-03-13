import Gig from '../models/Gig.js';
import Order from '../models/Order.js';
import { PLATFORM_FEE_PERCENT } from '../config/platform.js';
import { cloudinary } from '../utils/cloudinary.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import TokenTransaction from '../models/TokenTransaction.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export const createGig = async (req, res) => {
    try {
        const { title, description, price, category } = req.body;

        if (!title || !description || price === undefined || !category) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields (title, description, price, category)',
            });
        }

        let imageUrl = null;
        let imagePublicId = null;

        if (req.file) {
            imageUrl = req.file.path;
            imagePublicId = req.file.filename;
        }

        const gig = await Gig.create({
            title,
            description,
            price,
            category,
            owner: req.user._id,
            imageUrl,
            imagePublicId,
            status: 'open',
            history: [{ status: 'open' }],
        });

        res.status(201).json({
            success: true,
            gig,
        });
    } catch (error) {
        console.error(`Error in createGig controller: ${error.message}`);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const getAllGigs = async (req, res) => {
    try {
        const gigs = await Gig.find({ isActive: true, status: 'open' })
            .sort({ createdAt: -1 })
            .populate('owner', 'name email')
            .populate('assignedTo', 'name email');

        res.status(200).json({ success: true, count: gigs.length, gigs });
    } catch (error) {
        console.error(`Error in getAllGigs controller: ${error.message}`);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const getMyGigs = async (req, res) => {
    try {
        const gigs = await Gig.find({
            $or: [{ owner: req.user._id }, { assignedTo: req.user._id }]
        })
            .sort({ createdAt: -1 })
            .populate('owner', 'name email')
            .populate('assignedTo', 'name email');

        res.status(200).json({ success: true, count: gigs.length, gigs });
    } catch (error) {
        console.error(`Error in getMyGigs controller: ${error.message}`);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const getGigById = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id)
            .populate('owner', 'name email')
            .populate('assignedTo', 'name email');

        if (!gig) return res.status(404).json({ success: false, message: 'Gig not found' });
        res.status(200).json({ success: true, gig });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Lifecycle: OPEN -> ASSIGNED
export const acceptGig = async (req, res) => {
    try {
        // STEP 1: Atomically lock the Gig FIRST targeting the "open" state safely
        const lockedGig = await Gig.findOneAndUpdate(
            { _id: req.params.id, status: 'open', owner: { $ne: req.user._id } },
            {
                $set: { status: 'assigned', assignedTo: req.user._id },
                $push: { history: { status: 'assigned' } }
            },
            { new: true }
        );

        if (!lockedGig) {
            return res.status(400).json({ success: false, message: 'Gig cannot be accepted. It is already taken, closed, or belongs to you.' });
        }

        // STEP 2: Atomically deduct 2 Tokens safely
        const userUpdate = await User.findOneAndUpdate(
            { _id: req.user._id, tokens: { $gte: 2 } },
            { $inc: { tokens: -2 } },
            { new: true }
        );

        if (!userUpdate) {
            // CRITICAL: ROLLBACK TRANSACTION natively removing the assignment mapping
            await Gig.findByIdAndUpdate(
                req.params.id,
                {
                    $set: { status: 'open', assignedTo: null },
                    $pull: { history: { status: 'assigned' } }
                }
            );
            return res.status(400).json({ success: false, message: 'Insufficient Tokens. You need at least 2 tokens to accept a task.' });
        }

        // STEP 3: Log the Token ledger trace
        await TokenTransaction.create({
            user: req.user._id,
            change: -2,
            type: 'task_accept',
            referenceId: lockedGig._id
        });

        // Deep populate for front-end rendering cleanly
        await lockedGig.populate('owner', 'name email');
        await lockedGig.populate('assignedTo', 'name email');

        res.status(200).json({ success: true, gig: lockedGig });
    } catch (error) {
        console.error("Accept gig error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Lifecycle: ASSIGNED -> SUBMITTED
export const submitGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id).populate('owner', 'name email').populate('assignedTo', 'name email');

        if (!gig) return res.status(404).json({ success: false, message: 'Gig not found' });

        if (!gig.assignedTo || gig.assignedTo._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the assigned worker can submit this task' });
        }

        if (gig.status !== 'assigned') {
            return res.status(400).json({ success: false, message: 'Gig must be in assigned status before you can submit work' });
        }

        gig.status = 'submitted';
        gig.submittedAt = new Date();
        gig.history.push({ status: 'submitted' });
        await gig.save();

        res.status(200).json({ success: true, gig });
    } catch (error) {
        console.error("Submit gig error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Lifecycle: SUBMITTED -> COMPLETED
export const approveGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id).populate('owner', 'name email').populate('assignedTo', 'name email');

        if (!gig) return res.status(404).json({ success: false, message: 'Gig not found' });

        if (gig.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the owner can approve' });
        }

        if (gig.status !== 'submitted') {
            return res.status(400).json({ success: false, message: 'Gig must be submitted before you can approve it' });
        }

        if (gig.owner._id.toString() === (gig.assignedTo ? gig.assignedTo._id.toString() : '')) {
            return res.status(400).json({ success: false, message: 'Prevent owner approving own work' });
        }

        gig.status = 'completed';
        gig.completedAt = new Date();
        gig.history.push({ status: 'completed' });
        await gig.save();

        // Phase 2 Chat Constraint: Auto-close the conversation WebSockets instantly when the Gig finishes
        await Conversation.findOneAndUpdate({ gig: gig._id }, { isActive: false });

        res.status(200).json({ success: true, gig });
    } catch (error) {
        console.error("Approve gig error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Deletion Endpoint
export const deleteGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id);

        if (!gig) return res.status(404).json({ success: false, message: 'Gig not found' });

        if (gig.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the gig owner can delete it' });
        }

        if (gig.status !== 'completed' && gig.status !== 'open') {
            return res.status(400).json({ success: false, message: 'Only open or completed gigs can be permanently deleted.' });
        }

        // Clean up Cloudinary storage if image exists
        if (gig.imagePublicId) {
            await cloudinary.uploader.destroy(gig.imagePublicId);
        }

        // Cascade delete all conversations and messages associated directly with this Gig natively
        const convs = await Conversation.find({ gig: gig._id });
        const convIds = convs.map(c => c._id);
        if (convIds.length > 0) {
            await Message.deleteMany({ conversation: { $in: convIds } });
            await Conversation.deleteMany({ gig: gig._id });
        }

        await Gig.findByIdAndDelete(gig._id);

        res.status(200).json({ success: true, message: 'Gig successfully deleted forever' });
    } catch (error) {
        console.error("Delete gig error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
