import express, { Request, Response } from 'express';
import { AIQuestions } from '../../models/AIQuestions';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import axios from 'axios';
import isAdmin from '../../middleware/isadmin';

// Define CustomRequest interface
interface CustomRequest extends Request {
  userId?: string;
  userRole?: string;
}

const router = express.Router();

// Helper function to call Gemini API
async function generateQuestionsWithGemini(skill: string, level: string, count: number): Promise<any[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `
       You are a skilled exam designer.

Generate exactly ${count} **unique** multiple‑choice questions to assess **${skill}** at the **${level}** level.  
Each question must have:
- A unique question text (no repeats).

- And if i generate one question and then generate another one with the same skill and level,
  it should not be similar to the previous one.
- The questions should be completely different from each other.
- dont just change the prasing of the question. 

- i want completely different questions.
- 4 distinct options labeled a, b, c, d.
- Exactly one correct answer.

Return only this exact JSON format:

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
  },
  ...
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
    
    // Extract JSON from the response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini API');
    }

    const questions = JSON.parse(jsonMatch[0]);
    
    // Validate the structure
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

// Generate AI questions based on admin selection
router.post('/generate-ai-questions', isAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const { skillLevels, generatedBy } = req.body;
    
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
            questionCount: count
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
      questions: generatedQuestions
    });
  } catch (error) {
    console.error('Error generating AI questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all AI questions for admin review
router.get('/all-ai-questions', isAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const { generatedBy, reviewStatus, skill, level, excludeApproved } = req.query;
    
    const query: any = {};
    if (generatedBy) {
      query.generatedBy = generatedBy;
    }
    if (reviewStatus) {
      query.reviewStatus = reviewStatus;
    } else if (excludeApproved === 'true') {
      // If excludeApproved is true and no specific reviewStatus is provided, exclude approved questions
      query.reviewStatus = { $ne: 'approved' };
    }
    if (skill) {
      query.skill = skill;
    }
    if (level) {
      query.level = level;
    }

    const questions = await AIQuestions.find(query).sort({ createdAt: -1 });
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching AI questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending AI questions for admin review
router.get('/pending-ai-questions', isAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const { generatedBy } = req.query;
    
    const query: any = { reviewStatus: 'pending' };
    if (generatedBy) {
      query.generatedBy = generatedBy;
    }

    const pendingQuestions = await AIQuestions.find(query).sort({ createdAt: -1 });
    
    res.json(pendingQuestions);
  } catch (error) {
    console.error('Error fetching pending AI questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve an AI question
router.post('/approve-ai-question', isAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const { questionId, assignedTo } = req.body;
    
    if (!questionId) {
      return res.status(400).json({ message: 'Missing questionId' });
    }

    const question = await AIQuestions.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    question.reviewStatus = 'approved';
    if (assignedTo) {
      question.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    }

    await question.save();
    
    res.json({ message: 'Question approved successfully', question });
  } catch (error) {
    console.error('Error approving AI question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an AI question completely from database
router.delete('/delete-ai-question/:questionId', isAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const { questionId } = req.params;
    
    if (!questionId) {
      return res.status(400).json({ message: 'Missing questionId' });
    }

    const question = await AIQuestions.findByIdAndDelete(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get approved AI questions for a specific user
router.get('/approved-ai-questions/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    const objectId = new mongoose.Types.ObjectId(userId);

    // First, check if user already has assigned questions
    let questions = await AIQuestions.find({
      reviewStatus: 'approved',
      assignedTo: objectId
    }).sort({ createdAt: -1 });

    if (questions.length === 0) {      
      await AIQuestions.updateMany(
        { 
          reviewStatus: 'approved',
          $or: [
            { assignedTo: { $exists: false } },
            { assignedTo: null }
          ]
        },
        { assignedTo: objectId }
      );

      // Fetch the newly assigned questions
      questions = await AIQuestions.find({
        reviewStatus: 'approved',
        assignedTo: objectId
      }).sort({ createdAt: -1 });
    }

    res.json(questions);
  } catch (error) {
    console.error('Error fetching approved AI questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 