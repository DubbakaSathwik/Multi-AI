import { Router } from 'express';
import mongoose from 'mongoose';
import { protect } from '../middlewares/auth.middleware.js';
import User from '../models/user.model.js';

const router = Router();

router.get('/preference', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is currently offline. Please ensure MongoDB is started.'
      });
    }

    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      likes: Object.fromEntries(user.likes || new Map()),
      dislikes: Object.fromEntries(user.dislikes || new Map())
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/preference', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is currently offline. Please ensure MongoDB is started.'
      });
    }

    const { model, type } = req.body;

    if (!model || !type || !['like', 'dislike'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid model preference data' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Initialize Map if somehow undefined
    if (!user.likes) user.likes = new Map();
    if (!user.dislikes) user.dislikes = new Map();

    if (type === 'like') {
      const current = user.likes.get(model) || 0;
      user.likes.set(model, current + 1);
    } else {
      const current = user.dislikes.get(model) || 0;
      user.dislikes.set(model, current + 1);
    }

    await user.save();

    res.json({
      success: true,
      likes: Object.fromEntries(user.likes),
      dislikes: Object.fromEntries(user.dislikes)
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
