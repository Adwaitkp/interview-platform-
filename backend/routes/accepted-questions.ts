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


    // If setNumber filter is applied, use the same logic as the AI questions route for consistency
    if (setNumber) {
      const setNumberInt = parseInt(setNumber as string);
      if (setNumberInt > 0) {
        // Use a separate query to get all questions for accurate set mapping, ignoring existing filters
        const allQuestionsForSetMapping = await AIQuestions.find()
          .populate('generatedBy', 'name')
          .populate('assignedTo', 'name');

        const candidateSets = new Map<string, Map<string, Date>>();
        allQuestionsForSetMapping.forEach((q: any) => {
          const generatedByName = (q.generatedBy && typeof q.generatedBy === 'object' && 'name' in q.generatedBy) ? q.generatedBy.name : '';
          const assignedToName = (q.assignedTo && typeof q.assignedTo === 'object' && 'name' in q.assignedTo) ? q.assignedTo.name : '';
          const candidateName = generatedByName || assignedToName || 'Not Assigned';

          if (!candidateSets.has(candidateName)) {
            candidateSets.set(candidateName, new Map<string, Date>());
          }

          const setMap = candidateSets.get(candidateName)!;
          if (q.setid && !setMap.has(q.setid)) {
            setMap.set(q.setid, q.createdAt);
          }
        });

        const matchingSetIds: string[] = [];
        candidateSets.forEach(setMap => {
          const entries = Array.from(setMap.entries());
          const sortedSetIds = entries
            .sort((a, b) => {
              const aDate = new Date(a[1]).getTime();
              const bDate = new Date(b[1]).getTime();
              // If creation dates are very close (within 1 minute), sort by setid for consistency
              if (Math.abs(aDate - bDate) < 60000) {
                return a[0].localeCompare(b[0]);
              }
              return aDate - bDate;
            })
            .map(entry => entry[0]);

          if (sortedSetIds[setNumberInt - 1]) {
            matchingSetIds.push(sortedSetIds[setNumberInt - 1]);
          }
        });

        if (matchingSetIds.length > 0) {
          filter.setid = { $in: matchingSetIds };
        } else {
          // If no sets match, return no results
          filter._id = { $in: [] };
        }
      }
    }

    // Get the count of documents that match the filter
    const total = await AIQuestions.countDocuments(filter);

    // Get the paginated questions based on the final filter
    const paginatedQuestions = await AIQuestions.find(filter)
      .populate('assignedTo', 'name')
      .populate('generatedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(pageNum * limitNum)
      .limit(limitNum);

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
