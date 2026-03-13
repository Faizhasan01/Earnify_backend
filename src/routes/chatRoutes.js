import express from 'express';
import { getConversation, uploadImage, deleteConversation, getMyConversations } from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';

// Setup multer for generic memory storage mapped to Cloudinary
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

// Cloudinary Configuration mappings will be injected inside chatController natively, 
// but multer config must sit here to intercede the route

// Ensure config exists for cloudinary parser
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'earnify_chat',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB explicit limit
});


router.get('/my', protect, getMyConversations);

router.route('/:gigId')
    .get(protect, getConversation)
    .delete(protect, deleteConversation);

router.post('/upload', protect, upload.single('image'), uploadImage);

export default router;
