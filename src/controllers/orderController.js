import Order from '../models/Order.js';
import Gig from '../models/Gig.js';

export const createOrder = async (req, res) => {
    try {
        const { gigId } = req.body;

        if (!gigId) {
            return res.status(400).json({ success: false, message: 'Please provide a gig ID' });
        }

        const gig = await Gig.findById(gigId);

        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        if (gig.status !== 'assigned') {
            return res.status(400).json({ success: false, message: 'Gig must be assigned to a worker before you can process payment on it' });
        }

        if (gig.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the gig owner can fund the escrow' });
        }

        if (!gig.assignedTo) {
            return res.status(400).json({ success: false, message: 'Wait for a user to accept this task before paying.' });
        }

        const amount = gig.price;

        const order = await Order.create({
            buyer: req.user._id, // Owner playing the buyer role
            seller: gig.assignedTo, // Worker playing the seller role
            gig: gig._id,
            amount,
            status: 'pending',
        });

        res.status(201).json({ success: true, order });
    } catch (error) {
        console.error(`Error in createOrder controller: ${error.message}`);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [{ buyer: req.user._id }, { seller: req.user._id }]
        })
            .sort({ createdAt: -1 })
            .populate('buyer', 'name email')
            .populate('seller', 'name email')
            .populate('gig', 'title category price status owner assignedTo'); // Populated new gig fields so the dashboard reads them properly

        res.status(200).json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error(`Error in getMyOrders controller: ${error.message}`);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
