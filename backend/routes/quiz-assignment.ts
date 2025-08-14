import express, { Request, Response } from 'express';
import User from '../models/User';

const router = express.Router();

// Assign quiz type to a user
router.post('/assign-quiz-type', async (req: Request, res: Response) => {
  try {
    const { userId, quizType } = req.body;

    if (!userId || !quizType) {
      return res.status(400).json({ message: 'User ID and quiz type are required' });
    }

    if (!['normal', 'ai'].includes(quizType)) {
      return res.status(400).json({ message: 'Quiz type must be either "normal" or "ai"' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user's quiz type
    user.quizType = quizType;
    await user.save();

    res.status(200).json({ 
      message: `Quiz type assigned successfully: ${quizType}`, 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        quizType: user.quizType
      }
    });
  } catch (err: any) {
    console.error('Error assigning quiz type:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's assigned quiz type
router.get('/quiz-type/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('quizType name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ 
      quizType: user.quizType,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err: any) {
    console.error('Error fetching quiz type:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 