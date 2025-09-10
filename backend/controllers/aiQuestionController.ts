import { Request, Response } from 'express';
import { AIQuestions } from '../models/AIQuestions';
import mongoose from 'mongoose';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Helper function to call Gemini API
async function generateQuestionsWithGemini(skill: string, level: string, count: number): Promise<any[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `
You are a skilled exam designer.

Generate exactly ${count} **unique and non-overlapping** multiple-choice questions to assess **${skill}** at the **${level}** level.  

### Rules for uniqueness:
- **No repeated or similar questions** across different generations.  
- Do not just rephrase an earlier question — every question must test a **different concept, scenario, or problem type**.  
- If a previous question tested the same formula, logic, or idea, skip it and create something completely new.  
- Questions across different sets (Set-1, Set-2, etc.) must also be **mutually unique**.  

### Question format:
- Each question must include a **clear and unique question text**.  
- Provide 4 distinct options labeled "a", "b", "c", "d".  
- Exactly one correct answer.  

### Output format:
Return only this exact JSON array (no text outside JSON):

[
  {
    "question": "Question text here?",
    "options": {
      "a": "Option A text",
      "b": "Option B text",
      "c": "Option C text",
      "d": "Option D text"
    },
    "correctanswer": "a"
  }
]
`;


  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedText = response.data.candidates[0].content.parts[0].text;

    const jsonMatch = generatedText.match(/`json\n([\s\S]*?)\n`/);
    if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('Invalid response format from Gemini API: No JSON block found');
    }

    const questions = JSON.parse(jsonMatch[1]);

    if (!Array.isArray(questions)) {
      throw new Error('Response is not an array');
    }

    return questions.map(q => ({
      ...q,
      skill,
      level
    }));
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error('Failed to generate questions with AI');
  }
}

export const generateAiQuestions = async (req: Request, res: Response) => {
    const { skillLevels, generatedBy, setid, useExistingSet, targetSetNumber } = req.body;

    let effectiveSetId: string;
    let setLabel: string;

    const User = mongoose.model('User');
    const user = await User.findById(generatedBy);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (useExistingSet === true && setid) {
        effectiveSetId = setid;
        // Find the label for this setId
        const userSet = user.userSpecificSets?.find((s: any) => s.setId === setid);
        setLabel = userSet ? userSet.label : 'Unknown Set';
       
    } else if (useExistingSet === true && targetSetNumber) {
        // Get the set by target number from user's specific sets
        const userSets = user.userSpecificSets || [];
        if (userSets.length >= targetSetNumber) {
            const targetSet = userSets[targetSetNumber - 1];
            effectiveSetId = targetSet.setId;
            setLabel = targetSet.label;
        } else {
            // Create new set
            effectiveSetId = uuidv4();
            setLabel = `Set-${userSets.length + 1}`;
            if (!user.userSpecificSets) {
                user.userSpecificSets = [];
            }
            user.userSpecificSets.push({ setId: effectiveSetId, label: setLabel });
            user.markModified('userSpecificSets');
            await user.save();
        }
    } else {
        // Create new set
        effectiveSetId = uuidv4();
        const userSets = user.userSpecificSets || [];
        setLabel = `Set-${userSets.length + 1}`;
        if (!user.userSpecificSets) {
            user.userSpecificSets = [];
        }
        user.userSpecificSets.push({ setId: effectiveSetId, label: setLabel });
        user.markModified('userSpecificSets');
        await user.save();
    }

    try {
        if (!skillLevels || !Array.isArray(skillLevels) || !generatedBy) {
            return res.status(400).json({ message: 'Missing required fields: skillLevels array and generatedBy' });
        }

        const generatedQuestions = [];

        for (const skillLevel of skillLevels) {
            const { skill, level, count } = skillLevel;

            if (!skill || !level || !count || count < 1) {
                return res.status(400).json({ message: 'Invalid skill level configuration' });
            }

            try {
                const aiQuestions = await generateQuestionsWithGemini(skill, level, count);

                for (const question of aiQuestions) {
                    const aiQuestion = new AIQuestions({
                        skill: question.skill,
                        level: question.level,
                        question: question.question,
                        options: question.options,
                        correctanswer: question.correctanswer,
                        reviewStatus: 'pending',
                        source: 'AI',
                        generatedBy,
                        questionCount: count,
                        setid: String(effectiveSetId)
                    });

                    await aiQuestion.save();
                    generatedQuestions.push(aiQuestion);
                }
            } catch (error) {
                console.error(`Error generating questions for ${skill} ${level}:`, error);
                return res.status(500).json({
                    message: `Failed to generate questions for ${skill} ${level}`,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        res.json({
            message: 'AI questions generated successfully',
            count: generatedQuestions.length,
            setId: String(effectiveSetId),
            setLabel: setLabel
        });
    } catch (error) {
        console.error('Error generating AI questions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getUserSets = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: 'Missing userId' });
        }

        const User = mongoose.model('User');
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userSets = user.userSpecificSets || [];
        res.json({ sets: userSets });
    } catch (error) {
        console.error('Error fetching user sets:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getAllAiQuestions = async (req: Request, res: Response) => {
    try {
        const { generatedBy, reviewStatus, skill, level, excludeApproved, search, page, limit, candidateName, setNumber } = req.query;

        const candidateNameStr = candidateName as string;
        const query: any = {};

        if (generatedBy) query.generatedBy = generatedBy;
        if (reviewStatus) {
            query.reviewStatus = reviewStatus;
        } else if (excludeApproved === 'true') {
            query.reviewStatus = { $ne: 'approved' };
        }
        if (limit === '10000') delete query.reviewStatus;
        if (skill) query.skill = { $regex: new RegExp(`^${skill}$`, 'i') };
        if (level) query.level = { $regex: new RegExp(`^${level}$`, 'i') };
        if (search) {
            query.$or = [
                { question: { $regex: search, $options: 'i' } },
                { skill: { $regex: search, $options: 'i' } },
                { level: { $regex: search, $options: 'i' } },
                { correctanswer: { $regex: search, $options: 'i' } }
            ];
        }

        if (setNumber) {
            const setNumberInt = parseInt(setNumber as string);
            if (setNumberInt > 0) {
                // Get all users and find sets by label
                const User = mongoose.model('User');
                const users = await User.find({});
                const matchingSetIds: string[] = [];
                
                users.forEach((user: any) => {
                    const userSets = user.userSpecificSets || [];
                    const targetSet = userSets.find((s: any) => s.label === `Set-${setNumberInt}`);
                    if (targetSet) {
                        matchingSetIds.push(targetSet.setId);
                    }
                });

                if (matchingSetIds.length > 0) {
                    query.setid = { $in: matchingSetIds };
                } else {
                    query._id = { $in: [] }; // No results
                }
            }
        }

        const pageNum = parseInt(page as string) || 0;
        const limitNum = parseInt(limit as string) || 10;
        let questions: any[];
        let totalQuestions: number;

        if (candidateNameStr && candidateNameStr.trim()) {
            const allQuestions = await AIQuestions.find(query).populate('generatedBy', 'name').populate('assignedTo', 'name').sort({ createdAt: -1 });
            const filtered = allQuestions.filter((q: any) => 
                (q.generatedBy?.name?.toLowerCase().includes(candidateNameStr.toLowerCase())) || 
                (q.assignedTo?.name?.toLowerCase().includes(candidateNameStr.toLowerCase()))
            );
            if (limitNum === 10000) return res.json(filtered);
            questions = filtered.slice(pageNum * limitNum, (pageNum * limitNum) + limitNum);
            totalQuestions = filtered.length;
        } else {
            if (limitNum === 10000) return res.json(await AIQuestions.find(query).populate('generatedBy', 'name').populate('assignedTo', 'name').sort({ createdAt: -1 }));
            questions = await AIQuestions.find(query).populate('generatedBy', 'name').populate('assignedTo', 'name').sort({ createdAt: -1 }).skip(pageNum * limitNum).limit(limitNum);
            totalQuestions = await AIQuestions.countDocuments(query);
        }

        res.json({
            questions,
            totalPages: Math.ceil(totalQuestions / limitNum),
            currentPage: pageNum,
            totalQuestions
        });
    } catch (error) {
        console.error('Error fetching AI questions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getPendingAiQuestions = async (req: Request, res: Response) => {
    try {
        const { generatedBy } = req.query;
        const query: any = { reviewStatus: 'pending' };
        if (generatedBy) query.generatedBy = generatedBy;

        const pendingQuestions = await AIQuestions.find(query).populate('generatedBy', 'name').populate('assignedTo', 'name').sort({ createdAt: -1 });
        res.json(pendingQuestions);
    } catch (error) {
        console.error('Error fetching pending AI questions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const approveAiQuestion = async (req: Request, res: Response) => {
    try {
        const { questionId, assignedTo } = req.body;
        if (!questionId) return res.status(400).json({ message: 'Missing questionId' });

        const question = await AIQuestions.findById(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        question.reviewStatus = 'approved';
        if (assignedTo) {
            question.assignedTo = new mongoose.Types.ObjectId(assignedTo._id || assignedTo);
        }

        await question.save();
        res.json({ message: 'Question approved successfully', question });
    } catch (error) {
        console.error('Error approving AI question:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteAiQuestion = async (req: Request, res: Response) => {
    try {
        const { questionId } = req.params;
        if (!questionId) return res.status(400).json({ message: 'Missing questionId' });

        const question = await AIQuestions.findByIdAndDelete(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting AI question:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getApprovedAiQuestions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ message: 'Missing userId' });

        const objectId = new mongoose.Types.ObjectId(userId);
        let questions = await AIQuestions.find({ reviewStatus: 'approved', assignedTo: objectId }).sort({ createdAt: -1 });

        if (questions.length === 0) {
            await AIQuestions.updateMany(
                { reviewStatus: 'approved', $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] },
                { assignedTo: objectId }
            );
            questions = await AIQuestions.find({ reviewStatus: 'approved', assignedTo: objectId }).sort({ createdAt: -1 });
        }

        res.json(questions);
    } catch (error) {
        console.error('Error fetching approved AI questions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getAllSets = async (req: Request, res: Response) => {
    try {
        const sets = await AIQuestions.distinct("setid");
        res.json({ sets });
    } catch (error) {
        console.error('Error fetching all sets:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getApprovedAiQuestionsBySet = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ message: 'Missing userId' });

        const User = mongoose.model('User');
        const user = await User.findById(userId);

        if (!user || !user.assignedSetId) return res.json([]);

        const questions = await AIQuestions.find({ reviewStatus: 'approved', setid: user.assignedSetId }).sort({ createdAt: -1 });
        res.json(questions);
    } catch (error) {
        console.error('Error fetching questions by set:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
