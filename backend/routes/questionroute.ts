import express, { Request, Response } from 'express';
import questionCRUDRouter from './question-crud/questionCRUD';
import { Questions } from '../models/Questions';
import User from '../models/User';
import mongoose from 'mongoose';
import isAdmin from '../middleware/isadmin';

const router = express.Router();

// Fisher–Yates shuffle (unbiased O(n))
function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* GET /questions */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { skill, level, limit, userId, page, search } = req.query;
    const pageNum = parseInt(page as string) || 0;
    const limitNum = parseInt(limit as string) || 10;
    const searchTerm = (search as string) || '';

    if (userId) {
      try {
        const user = await User.findById(userId);
        if (!user || !user.questionCounts) {
          return res.status(200).json([]);
        }

        const allQuestions: any[] = [];
        const assignedQuestionsMap = new Map<string, string[]>();

        for (const userSkill in user.questionCounts) {
          for (const userLevel in user.questionCounts[userSkill]) {
            const count = user.questionCounts[userSkill][userLevel];
            if (count > 0) {
              // Ensure consistent key format
              const safeSkill = userSkill.replace(/\./g, '__');
              const key = `${safeSkill}_${userLevel}`;

              // Check if questions already assigned
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
                  hasAssignedQuestions = Object.prototype.hasOwnProperty.call(
                    user.assignedQuestions,
                    key
                  );
                  if (hasAssignedQuestions) {
                    existingIds = (user.assignedQuestions as any)[key] || [];
                  }
                }
              }

              if (hasAssignedQuestions && existingIds.length > 0) {
                // Use existing assigned questions, preserving saved order
                try {
                  const questions = await Questions.find({
                    _id: {
                      $in: existingIds.map((id) => new mongoose.Types.ObjectId(id)),
                    },
                  });

                  // sort docs to match existingIds order
                  const order = new Map(
                    existingIds.map((id: string, idx: number) => [id, idx])
                  );
                  questions.sort(
                    (a: any, b: any) =>
                      (order.get(a._id.toString()) ?? 0) -
                      (order.get(b._id.toString()) ?? 0)
                  );

                  allQuestions.push(...questions);
                } catch (err) {
                  // Handle error silently
                }
              } else {
                // Assign new questions (randomize once, persist that order)
                try {
                  const availableQuestions = await Questions.find({
                    skill: new RegExp(`^${userSkill}$`, 'i'),
                    level: new RegExp(`^${userLevel}$`, 'i'),
                  });

                  let selectedQuestions = availableQuestions.slice();
                  // shuffle then slice to 'count'
                  shuffleInPlace(selectedQuestions);
                  if (selectedQuestions.length > count) {
                    selectedQuestions = selectedQuestions.slice(0, count);
                  }

                  if (selectedQuestions.length > 0) {
                    allQuestions.push(...selectedQuestions);
                    assignedQuestionsMap.set(
                      key,
                      selectedQuestions.map((q) =>
                        (q._id as mongoose.Types.ObjectId).toString()
                      )
                    );
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

        // Group by skill (case-insensitive keys)
        const buckets: Record<string, any[]> = {};
        for (const q of allQuestions) {
          const k = (q.skill || '').toLowerCase().trim();
          if (!buckets[k]) buckets[k] = [];
          buckets[k].push(q);
        }

        // Define desired skill order
        const skillsInOrder: string[] = [];
        const skillVariants: Record<string, string[]> = {
          nodejs: ['nodejs', 'node js', 'node.js'],
          react: ['react', 'reactjs', 'react.js'],
          mongodb: ['mongodb', 'mongo db', 'mongo'],
          git: ['git'],
          django: ['django'],
          docker: ['docker'],
          typescript: ['typescript', 'ts'],
        };

        // Get skills in the order they appear in user.questionCounts
        for (const userSkill in user.questionCounts) {
          const normalizedSkill = userSkill.toLowerCase().trim();
          // Find which main skill this belongs to
          let mainSkill = normalizedSkill;
          for (const [k, variants] of Object.entries(skillVariants)) {
            if (variants.some((v) => v === normalizedSkill)) {
              mainSkill = k;
              break;
            }
          }
          if (!skillsInOrder.includes(mainSkill)) {
            skillsInOrder.push(mainSkill);
          }
        }

        // Create desired order array with all variants
        const desiredOrder: string[] = [];
        for (const s of skillsInOrder) {
          if (skillVariants[s]) {
            desiredOrder.push(...skillVariants[s]);
          } else {
            desiredOrder.push(s);
          }
        }

        // Build final list: preferred skills in order, then any remaining skills
        const finalQuestions: any[] = [];
        const used = new Set<string>();

        for (const k of desiredOrder) {
          const normalized = k.toLowerCase().trim();
          if (buckets[normalized] && buckets[normalized].length) {
            // DO NOT sort here; preserve assigned order
            finalQuestions.push(...buckets[normalized]);
            used.add(normalized);
          }
        }

        // Append any other skills (if present), preserving assigned order
        for (const [k, list] of Object.entries(buckets)) {
          if (!used.has(k) && list.length) {
            // DO NOT sort here; preserve assigned order
            finalQuestions.push(...list);
          }
        }

        return res.status(200).json(finalQuestions);
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
        { level: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Get total count for pagination
    const total = await Questions.countDocuments(filter);

    // Apply pagination
    let query = Questions.find(filter).skip(pageNum * limitNum).limit(limitNum).sort({ createdAt: -1 });
    const questions = await query;

    res.status(200).json({
      questions,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalQuestions: total,
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

router.use('/', questionCRUDRouter);

export default router;
