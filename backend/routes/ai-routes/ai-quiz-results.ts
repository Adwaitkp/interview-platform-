import express, { Request, Response } from 'express';
import AIResult from '../../models/AIResult';
import User from '../../models/User';
import mongoose from 'mongoose';
import isAdmin from '../../middleware/isadmin';

const router = express.Router();

// Submit AI quiz result
router.post('/submit-ai-quiz', async (req: Request, res: Response) => {
  const { userId, questionResponses } = req.body;
  
  if (!userId || !questionResponses || !Array.isArray(questionResponses)) {
    return res.status(400).json({ message: 'Missing required fields: userId and questionResponses array' });
  }
  
  try {
    let userIdObj;
    try {
      userIdObj = new mongoose.Types.ObjectId(userId);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid userId format' });
    }
    
    const user = await User.findById(userIdObj);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let totalCorrect = 0;
    let totalIncorrect = 0;
    const skillLevelMap = new Map<string, { correct: number; total: number }>();

    for (const response of questionResponses) {
      if (!response.questionId || !response.question || !response.skill || 
          !response.level || response.userAnswer === undefined || response.userAnswer === null || 
          !response.correctanswer || typeof response.isCorrect !== 'boolean' || !response.options) {
        return res.status(400).json({ message: 'Invalid question response structure' });
      }
      
      try {
        response.questionId = new mongoose.Types.ObjectId(response.questionId);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid questionId format' });
      }
      
      const isCorrect = response.isCorrect;
      
      if (isCorrect) {
        totalCorrect++;
      } else {
        totalIncorrect++;
      }

      const skillLevelKey = `${response.skill}-${response.level}`;
      if (!skillLevelMap.has(skillLevelKey)) {
        skillLevelMap.set(skillLevelKey, { correct: 0, total: 0 });
      }
      const stats = skillLevelMap.get(skillLevelKey)!;
      stats.total++;
      if (isCorrect) stats.correct++;
    }

    const skillLevelSummaries = Array.from(skillLevelMap.entries()).map(([key, stats]) => {
      const [skill, level] = key.split('-');
      return {
        skill,
        level,
        totalQuestions: stats.total,
        correctAnswers: stats.correct
      };
    });

    const totalQuestions = totalCorrect + totalIncorrect;
    const overallPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const aiResult = new AIResult({
      userId: userIdObj,
      userName: user.name,
      userEmail: user.email,
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      overallPercentage,
      questionResponses,
      skillLevelSummaries,
      aiQuizCompleted: true
    });

    await aiResult.save();

    // Mark user as having completed the AI quiz
    await User.findByIdAndUpdate(userIdObj, { aiQuizCompleted: true });

    res.json({ 
      message: 'AI Quiz result saved successfully',
      resultId: aiResult._id,
      overallPercentage
    });
  } catch (err: any) {
    console.error('Error submitting AI quiz:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all AI quiz results for admin dashboard
router.get('/ai-results', isAdmin, async (req: Request, res: Response) => {
  try {
    const results = await AIResult.find().sort({ createdAt: -1 });
    
    const formattedResults = results.map((result: any) => {
      return {
        _id: result._id,
        name: result.userName,
        email: result.userEmail,
        totalMarks: result.totalCorrect,
        totalQuestions: result.totalQuestions,
        overallPercentage: result.overallPercentage,
        quizDate: result.createdAt,
        skillResults: result.skillLevelSummaries.map((summary: any) => ({
          skill: summary.skill,
          level: summary.level,
          correctAnswers: summary.correctAnswers,
          totalQuestions: summary.totalQuestions
        }))
      };
    });
    
    res.json(formattedResults);
  } catch (err) {
    console.error('❌ Error fetching AI results:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed AI result for a specific user
router.get('/ai-result/:resultId', async (req: Request, res: Response) => {
  try {
    const result = await AIResult.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ message: 'AI Result not found' });
    }

    res.json({
      _id: result._id,
      userName: result.userName,
      userEmail: result.userEmail,
      totalQuestions: result.totalQuestions,
      totalCorrect: result.totalCorrect,
      totalIncorrect: result.totalIncorrect,
      overallPercentage: result.overallPercentage,
      questionResponses: result.questionResponses,
      skillLevelSummaries: result.skillLevelSummaries
    });
  } catch (err) {
    console.error('Error fetching AI result details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 