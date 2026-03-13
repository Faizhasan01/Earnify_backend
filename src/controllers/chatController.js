import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Gig from '../models/Gig.js';


export const getConversation = async (req, res) => {
    try {
        const { gigId } = req.params;

        const gig = await Gig.findById(gigId);
        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        // Validate Participant Authority
        const isOwner = gig.owner.toString() === req.user._id.toString();
        const isAssigned = gig.assignedTo && gig.assignedTo.toString() === req.user._id.toString();

        if (!isOwner && !isAssigned) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this chat room' });
        }

        let conversation = await Conversation.findOne({ gig: gigId });

        // Factory Bootstrap if missing
        if (!conversation) {
            conversation = await Conversation.create({
                gig: gigId,
                participants: [gig.owner, gig.assignedTo].filter(Boolean)
            });
        } else {
            if (gig.assignedTo) {
                const hasAssigned = conversation.participants.some(p => p && p.toString() === gig.assignedTo.toString());
                if (!hasAssigned) {
                    conversation.participants.push(gig.assignedTo);
                    await conversation.save();
                }
            }
        }

        // Logic sync: If standard Gig lifecycle completed, shut down the chat
        if (gig.status === 'completed' && conversation.isActive) {
            conversation.isActive = false;
            await conversation.save();
        }

        // If previously deleted, but they re-accessed from the Task Page, un-archive natively!
        let isUndeleted = false;
        if (conversation.deletedBy && conversation.deletedBy.some(id => id && id.toString() === req.user._id.toString())) {
            conversation.deletedBy = conversation.deletedBy.filter(id => id && id.toString() !== req.user._id.toString());
            isUndeleted = true;
        }

        if (isUndeleted) {
            await conversation.save();
        }

        // Find clearedAt timestamp for this specific user organically
        const clearedEntry = conversation.clearedBy && conversation.clearedBy.find(c => c.user && c.user.toString() === req.user._id.toString());
        const userClearedAt = clearedEntry ? clearedEntry.clearedAt : new Date(0);

        // Fetch paginated messages hiding previous history from this user
        const messages = await Message.find({
            conversation: conversation._id,
            createdAt: { $gt: userClearedAt }
        })
            .populate('sender', 'name email')
            .sort({ createdAt: 1 }); // Oldest to newest for front-end native stacking

        res.status(200).json({
            success: true,
            conversationId: conversation._id,
            isActive: conversation.isActive,
            messages
        });

    } catch (error) {
        console.error('Chat Fetch Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// RELAY IMAGE TO CLOUDINARY
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        // Multer-Storage-Cloudinary auto-injects exactly to req.file.path and req.file.filename
        res.status(200).json({
            success: true,
            imageUrl: req.file.path,
            imagePublicId: req.file.filename
        });
    } catch (error) {
        console.error('Image Upload Error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
};

// DELETE CONVERSATION (Hard cascade if both members delete)
export const deleteConversation = async (req, res) => {
    try {
        const { gigId } = req.params;

        const conversation = await Conversation.findOne({ gig: gigId });
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation missing' });
        }

        const isParticipant = conversation.participants && conversation.participants.some(p => p && p.toString() === req.user._id.toString());
        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Add to deletion tracking array without duplicating
        const hasDeleted = conversation.deletedBy && conversation.deletedBy.some(id => id && id.toString() === req.user._id.toString());
        if (!hasDeleted) {
            conversation.deletedBy.push(req.user._id);
        }

        // Add or update clearedAt timestamp for this exact user natively
        const clearedIdx = conversation.clearedBy.findIndex(c => c.user && c.user.toString() === req.user._id.toString());
        if (clearedIdx > -1) {
            conversation.clearedBy[clearedIdx].clearedAt = new Date();
        } else {
            conversation.clearedBy.push({ user: req.user._id, clearedAt: new Date() });
        }

        // If both sides deleted it, nuke cleanly
        if (conversation.deletedBy.length === conversation.participants.length) {
            await Message.deleteMany({ conversation: conversation._id });
            await Conversation.findByIdAndDelete(conversation._id);
        } else {
            await conversation.save();
        }

        res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Delete Conversation Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// FETCH ALL CONVERSATIONS FOR A USER (GLOBAL INBOX)
export const getMyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate('gig', 'title status price owner assignedTo')
            .populate('participants', 'name email avatar')
            .sort({ updatedAt: -1 });

        // Filter out conversations deleted by this specific user natively
        const activeConversations = conversations.filter(conv => {
            if (!conv.gig) return false; // Filter out Ghost Tasks / Orphans dynamically
            const hasDeleted = conv.deletedBy && conv.deletedBy.some(id => id && id.toString() === req.user._id.toString());
            return !hasDeleted;
        });

        // We also want to natively attach the latest message to each conversation for preview
        const conversationsWithLastMessage = await Promise.all(activeConversations.map(async (conv) => {
            // Respect the user's specific clear timestamp natively so the preview isn't a deleted message
            const clearedEntry = conv.clearedBy && conv.clearedBy.find(c => c.user && c.user.toString() === req.user._id.toString());
            const userClearedAt = clearedEntry ? clearedEntry.clearedAt : new Date(0);

            const lastMessage = await Message.findOne({
                conversation: conv._id,
                createdAt: { $gt: userClearedAt }
            })
                .sort({ createdAt: -1 })
                .select('text imageUrl createdAt');

            return {
                ...conv.toObject(),
                lastMessage
            };
        }));

        res.status(200).json({ success: true, count: conversationsWithLastMessage.length, conversations: conversationsWithLastMessage });
    } catch (error) {
        console.error('Fetch My Conversations Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
