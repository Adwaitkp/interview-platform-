import express, { Request, Response } from 'express';
import questionCRUDRouter from './question-crud/questionCRUD';
import { Questions } from '../models/Questions';
import User from '../models/User';
import mongoose from 'mongoose';

const router = express.Router();

/* GET /questions */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { skill, level, limit, userId, page, search, questionTypeConfig } = req.query;
    const pageNum = parseInt(page as string) || 0;
    const limitNum = parseInt(limit as string) || 10;
    const searchTerm = search as string || '';

    if (userId) {
      try {
        const user = await User.findById(userId);
        if (!user || !user.questionCounts) {
          return res.status(200).json([]);
        }

        const allQuestions: any[] = [];
        const assignedQuestionsMap = new Map<string, string[]>();

        // Use question type configuration from user record if available
        let configArray = user.questionTypeConfig || [];

        for (const userSkill in user.questionCounts) {
          for (const userLevel in user.questionCounts[userSkill]) {
            const count = user.questionCounts[userSkill][userLevel];
            if (count > 0) {
              // Ensure consistent key format
              const safeSkill = userSkill.replace(/\./g, '__');
              const key = `${safeSkill}_${userLevel}`;

              // Find configuration for this skill-level combination
              const config = configArray.find((c: any) =>
                c.skill === userSkill && c.level === userLevel
              );

              // Check if questions already assigned
              // Handle both Map objects and plain objects (from MongoDB)
              let hasAssignedQuestions = false;
              let existingIds: string[] = [];

              if (user.assignedQuestions) {
                if (user.assignedQuestions instanceof Map) {
                  hasAssignedQuestions = user.assignedQuestions.has(key);
                  if (hasAssignedQuestions) {
                    existingIds = user.assignedQuestions.get(key) || [];
                  }
                } else if (typeof user.assignedQuestions === 'object') {
                  // Handle case where MongoDB returns a plain object instead of a Map
                  hasAssignedQuestions = Object.prototype.hasOwnProperty.call(user.assignedQuestions, key);
                  if (hasAssignedQuestions) {
                    existingIds = (user.assignedQuestions as any)[key] || [];
                  }
                }
              }

              if (hasAssignedQuestions && existingIds.length > 0) {
                // Return existing questions if they are already assigned
                try {
                  const questions = await Questions.find({
                    _id: { $in: existingIds.map(id => new mongoose.Types.ObjectId(id)) }
                  });

                  // Maintain the exact order as stored in assignedQuestions
                  const orderedQuestions = existingIds.map(id =>
                    questions.find(q => String(q._id) === id)
                  ).filter(Boolean);

                  allQuestions.push(...orderedQuestions);
                } catch (err) {
                  // Handle error silently
                }
              }
              else {
                // Assign new questions based on configuration or default
                try {
                  const selectedQuestions: any[] = [];

                  if (config) {
                    // Use question type configuration
                    const { multipleChoice = 0, trueFalse = 0, singleChoice = 0 } = config;

                    // Validate that total doesn't exceed available count
                    const requestedTotal = multipleChoice + trueFalse + singleChoice;
                    if (requestedTotal > count) {
                      console.warn(`Requested questions (${requestedTotal}) exceed available count (${count}) for ${userSkill}-${userLevel}`);
                      continue;
                    }

                    // Fetch Single Choice Questions (type 'single')
                    if (singleChoice > 0) {
                      const availableSingle = await Questions.find({
                        skill: new RegExp(`^${userSkill}$`, 'i'),
                        level: new RegExp(`^${userLevel}$`, 'i'),
                        type: 'single'
                      });

                      if (availableSingle.length < singleChoice) {
                        console.warn(`Not enough single choice questions available. Requested: ${singleChoice}, Available: ${availableSingle.length}`);
                      }

                      const shuffledSingle = availableSingle.sort(() => 0.5 - Math.random()).slice(0, singleChoice);
                      selectedQuestions.push(...shuffledSingle);
                    }

                    // Fetch Multiple Choice Questions (type 'multiple')  
                    if (multipleChoice > 0) {
                      const availableMultiple = await Questions.find({
                        skill: new RegExp(`^${userSkill}$`, 'i'),
                        level: new RegExp(`^${userLevel}$`, 'i'),
                        type: 'multiple'
                      });

                      if (availableMultiple.length < multipleChoice) {
                        console.warn(`Not enough multiple choice questions available. Requested: ${multipleChoice}, Available: ${availableMultiple.length}`);
                      }

                      const shuffledMultiple = availableMultiple.sort(() => 0.5 - Math.random()).slice(0, multipleChoice);
                      selectedQuestions.push(...shuffledMultiple);
                    }

                    // Fetch True/False Questions (type 'truefalse')
                    if (trueFalse > 0) {
                      const availableTrueFalse = await Questions.find({
                        skill: new RegExp(`^${userSkill}$`, 'i'),
                        level: new RegExp(`^${userLevel}$`, 'i'),
                        type: 'truefalse'
                      });

                      if (availableTrueFalse.length < trueFalse) {
                        console.warn(`Not enough true/false questions available. Requested: ${trueFalse}, Available: ${availableTrueFalse.length}`);
                      }

                      const shuffledTrueFalse = availableTrueFalse.sort(() => 0.5 - Math.random()).slice(0, trueFalse);
                      selectedQuestions.push(...shuffledTrueFalse);
                    }

                    // Final shuffle of all selected questions
                    selectedQuestions.sort(() => 0.5 - Math.random());
                  } else {
                    // Default behavior - random questions without type filtering
                    const availableQuestions = await Questions.find({
                      skill: new RegExp(`^${userSkill}$`, 'i'),
                      level: new RegExp(`^${userLevel}$`, 'i')
                    });

                    // Randomly select 'count' questions if we have more than needed
                    selectedQuestions.push(...availableQuestions
                      .sort(() => 0.5 - Math.random())
                      .slice(0, count));
                  }

                  if (selectedQuestions.length > 0) {
                    allQuestions.push(...selectedQuestions);
                    assignedQuestionsMap.set(key, selectedQuestions.map(q => (q._id as mongoose.Types.ObjectId).toString()));
                  }
                } catch (err) {
                  // Handle error silently
                }
              }
            }
          }
        }

        // Update assigned questions if new ones were assigned
        if (assignedQuestionsMap.size > 0) {
          // Create a new map if it doesn't exist
          if (!user.assignedQuestions) {
            user.assignedQuestions = new Map<string, string[]>();
          } else if (!(user.assignedQuestions instanceof Map)) {
            // Convert from plain object to Map if needed
            const tempMap = new Map<string, string[]>();
            for (const [key, value] of Object.entries(user.assignedQuestions as any)) {
              tempMap.set(key, value as string[]);
            }
            user.assignedQuestions = tempMap;
          }

          // Merge the new assignments with existing ones
          for (const [key, value] of assignedQuestionsMap.entries()) {
            user.assignedQuestions.set(key, value);
          }

          // Save the user with the updated map
          try {
            await user.save();
          } catch (err) {
            // Handle error silently
          }
        }

        // REMOVED: Final shuffle - return questions in consistent order
        return res.status(200).json(allQuestions);

      } catch (err) {
        return res.status(500).json({ message: 'Internal server error (userId logic)' });
      }
    }

    // Original non-userId logic with pagination and search
    const filter: any = {};
    if (skill) filter.skill = new RegExp(`^${skill}$`, 'i');
    if (level) filter.level = new RegExp(`^${level}$`, 'i');

    // Add search functionality
    if (searchTerm) {
      filter.$or = [
        { question: { $regex: searchTerm, $options: 'i' } },
        { skill: { $regex: searchTerm, $options: 'i' } },
        { level: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const total = await Questions.countDocuments(filter);

    // Apply pagination
    let query = Questions.find(filter)
      .skip(pageNum * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const questions = await query;

    res.status(200).json({
      questions,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalQuestions: total
    });
  } catch (err: any) {
    console.error('Error fetching questions:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/* GET /questions/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid question ID format' });
    }
    const question = await Questions.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.status(200).json(question);
  } catch (err: any) {
    console.error('Error fetching question:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/* GET /questions/skill/:skill */
router.get('/skill/:skill', async (req: Request, res: Response) => {
  try {
    const { skill } = req.params;
    const { level, limit } = req.query;
    const filter: any = { skill: new RegExp(`^${skill}$`, 'i') };
    if (level) filter.level = new RegExp(`^${level}$`, 'i');
    let query = Questions.find(filter);
    if (limit) {
      const lim = parseInt(limit as string, 10);
      if (!isNaN(lim) && lim > 0) query = query.limit(lim);
    }
    res.status(200).json(await query);
  } catch (err: any) {
    console.error('Error fetching questions by skill:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/* GET /questions/level/:level */
router.get('/level/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const { skill, limit } = req.query;
    const filter: any = { level: new RegExp(`^${level}$`, 'i') };
    if (skill) filter.skill = new RegExp(`^${skill}$`, 'i');
    let query = Questions.find(filter);
    if (limit) {
      const lim = parseInt(limit as string, 10);
      if (!isNaN(lim) && lim > 0) query = query.limit(lim);
    }
    res.status(200).json(await query);
  } catch (err: any) {
    console.error('Error fetching questions by level:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
/* PUT /questions/users/:userId/question-type-config */
router.put('/users/:userId/question-type-config', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { questionTypeConfig } = req.body;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { questionTypeConfig: questionTypeConfig },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Question type configuration updated successfully', user });
  } catch (err: any) {
    console.error('Error updating question type config:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.use('/', questionCRUDRouter);
export default router;
