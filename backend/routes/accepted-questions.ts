import express, { Request, Response } from 'express';
import { AIQuestions } from '../models/AIQuestions';
import isAdmin from '../middleware/isadmin';
import User from '../models/User';

const router = express.Router();

// Get approved AI questions (Admin only)
router.get('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const { skill, level, limit, candidateName, page, search, setNumber } = req.query;
    
    let filter: any = { reviewStatus: 'approved' };
    
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
    
    // First, get all questions matching the current filter (without setNumber filter)
    // Remove the explicit type annotation to let TypeScript infer the type
    let allQuestions = await AIQuestions.find(filter)
      .populate('assignedTo', 'name')
      .populate('generatedBy', 'name')
      .sort({ createdAt: -1 });

    // If setNumber filter is applied, filter by set number logic
    if (setNumber) {
      const targetSetNumber = parseInt(setNumber as string, 10);
      
      // Group questions by candidate and determine set numbers
      const candidateQuestions = new Map();
      
      allQuestions.forEach(question => {
        // Handle populated fields safely
        const assignedToName = question.assignedTo && typeof question.assignedTo === 'object' && 'name' in question.assignedTo 
          ? (question.assignedTo as any).name 
          : null;
        const generatedByName = question.generatedBy && typeof question.generatedBy === 'object' && 'name' in question.generatedBy 
          ? (question.generatedBy as any).name 
          : null;
        
        const candidateName = assignedToName || generatedByName || 'Not Assigned';
        
        if (!candidateQuestions.has(candidateName)) {
          candidateQuestions.set(candidateName, []);
        }
        candidateQuestions.get(candidateName)!.push(question);
      });

      // Filter questions that belong to the target set number
      const filteredQuestions: any[] = [];
      
      candidateQuestions.forEach((questions, candidateName) => {
        // Group by setid and sort to get consistent set numbering
        const setGroups = new Map();
        
        questions.forEach((q: any) => {
          if (q.setid) {
            if (!setGroups.has(q.setid)) {
              setGroups.set(q.setid, []);
            }
            setGroups.get(q.setid)!.push(q);
          }
        });

        // Sort setids to ensure consistent ordering
        const sortedSetIds = Array.from(setGroups.keys()).sort();
        
        // Check if this candidate has the target set number
        if (sortedSetIds.length >= targetSetNumber) {
          const targetSetId = sortedSetIds[targetSetNumber - 1];
          const targetSetQuestions = setGroups.get(targetSetId) || [];
          filteredQuestions.push(...targetSetQuestions);
        }
      });

      allQuestions = filteredQuestions;
    }

    // Calculate pagination after filtering
    const total = allQuestions.length;
    const paginatedQuestions = allQuestions.slice(
      pageNum * limitNum,
      (pageNum + 1) * limitNum
    );

    res.status(200).json({
      questions: paginatedQuestions,
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
