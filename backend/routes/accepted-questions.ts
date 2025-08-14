import express, { Request, Response } from 'express';
import { AIQuestions } from '../models/AIQuestions';
import isAdmin from '../middleware/isadmin';
import User from '../models/User';

const router = express.Router();

// Get approved AI questions (Admin only)
router.get('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const { skill, level, limit, candidateName } = req.query;
    const filter: any = { reviewStatus: 'approved' };

    if (skill) filter.skill = new RegExp('^' + skill + '$', 'i');
    if (level) filter.level = new RegExp('^' + level + '$', 'i');
    
    // If candidateName is provided, find the user first
    if (candidateName) {
      const users = await User.find({
        name: new RegExp(candidateName as string, 'i'),
        role: 'interviewee'
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      if (userIds.length > 0) {
        filter.assignedTo = { $in: userIds };
      }
    }

    let query = AIQuestions.find(filter).populate('assignedTo', 'name');
    if (limit) {
      const lim = parseInt(limit as string, 10);
      if (!isNaN(lim) && lim > 0) query = query.limit(lim);
    }

    const approvedAIQuestions = await query.sort({ createdAt: -1 });
    res.status(200).json(approvedAIQuestions);
  } catch (error: any) {
    console.error('Error fetching approved AI questions:', error.message || error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;