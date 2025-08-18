import express, { Request, Response } from 'express';
import { AIQuestions } from '../models/AIQuestions';
import isAdmin from '../middleware/isadmin';
import User from '../models/User';

const router = express.Router();

// Get approved AI questions (Admin only)
router.get('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const { skill, level, limit, candidateName, page, search } = req.query;
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
    
    // Add search functionality
    if (search) {
      const searchTerm = search as string;
      filter.$or = [
        { question: { $regex: searchTerm, $options: 'i' } },
        { skill: { $regex: searchTerm, $options: 'i' } },
        { level: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Parse pagination parameters
    const pageNum = parseInt(page as string, 10) || 0;
    const limitNum = parseInt(limit as string, 10) || 10;
    
    // Get total count for pagination
    const total = await AIQuestions.countDocuments(filter);
    
    // Apply pagination
    let query = AIQuestions.find(filter)
      .populate('assignedTo', 'name')
      .populate('generatedBy', 'name')
      .skip(pageNum * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const approvedAIQuestions = await query;
    
    res.status(200).json({
      questions: approvedAIQuestions,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalQuestions: total
    });
  } catch (error: any) {
    console.error('Error fetching approved AI questions:', error.message || error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;