import express from 'express';
import {
    createGig,
    getAllGigs,
    getGigById,
    getMyGigs,
    acceptGig,
    submitGig,
    approveGig,
    deleteGig
} from '../controllers/gigController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

router.post('/', protect, upload.single('image'), createGig);
router.get('/', getAllGigs);
router.get('/my', protect, getMyGigs);
router.get('/:id', getGigById);
router.patch('/:id/accept', protect, acceptGig);
router.patch('/:id/submit', protect, submitGig);
router.patch('/:id/approve', protect, approveGig);
router.delete('/:id', protect, deleteGig);

export default router;
