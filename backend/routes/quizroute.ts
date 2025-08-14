import express, { Request, Response } from 'express';
import Result from '../models/Result';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import isAdmin from '../middleware/isadmin';

const router = express.Router();

// Submit quiz result for interviewee
router.post('/submit', async (req: Request, res: Response) => {
  const { userId, questionResponses } = req.body;
  
  // Validate required fields
  if (!userId || !questionResponses || !Array.isArray(questionResponses)) {
    return res.status(400).json({ message: 'Missing required fields: userId and questionResponses array' });
  }
  
  try {
    // Convert userId string to ObjectId
    let userIdObj;
    try {
      userIdObj = new mongoose.Types.ObjectId(userId);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid userId format' });
    }
    
    // Get user details
    const user = await User.findById(userIdObj);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Process question responses and calculate statistics
    let totalCorrect = 0;
    let totalIncorrect = 0;
    const skillLevelMap = new Map<string, { correct: number; total: number }>();

    // Process each question response
    for (const response of questionResponses) {
      // Validate response structure
      if (!response.questionId || !response.question || !response.skill || 
          !response.level || response.userAnswer === undefined || response.userAnswer === null || !response.correctanswer || 
          typeof response.isCorrect !== 'boolean' || !response.options) {
        return res.status(400).json({ message: 'Invalid question response structure' });
      }
      
      // Convert questionId string to ObjectId
      try {
        response.questionId = new mongoose.Types.ObjectId(response.questionId);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid questionId format' });
      }
      
      // Use the isCorrect value from frontend instead of recalculating
      const isCorrect = response.isCorrect;
      
      if (isCorrect) {
        totalCorrect++;
      } else {
        totalIncorrect++;
      }

      // Track skill-level statistics
      const skillLevelKey = `${response.skill}-${response.level}`;
      if (!skillLevelMap.has(skillLevelKey)) {
        skillLevelMap.set(skillLevelKey, { correct: 0, total: 0 });
      }
      const stats = skillLevelMap.get(skillLevelKey)!;
      stats.total++;
      if (isCorrect) stats.correct++;
    }

    // Create skill-level summaries
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

    // Create new result document
    const result = new Result({
      userId: userIdObj,
      userName: user.name,
      userEmail: user.email,
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      overallPercentage,
      questionResponses,
      skillLevelSummaries
    });

    await result.save();

    // Mark user as having completed the quiz
    await User.findByIdAndUpdate(userIdObj, { quizCompleted: true });

    res.json({ 
      message: 'Result saved successfully',
      resultId: result._id,
      overallPercentage
    });
  } catch (err: any) {
    console.error('Error submitting quiz:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all quiz results for admin dashboard
router.get('/results', isAdmin, async (req: Request, res: Response) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    
    const formattedResults = results.map((result: any) => {
      const formatted = {
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
      
      return formatted;
    });
    
    res.json(formattedResults);
  } catch (err) {
    console.error('❌ Error fetching results:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed result for a specific user
router.get('/result/:resultId', async (req: Request, res: Response) => {
  try {
    const result = await Result.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
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
    console.error('Error fetching result details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// Check quiz completion status for current user (interviewee)
router.get('/check-status', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ 
      quizCompleted: user.quizCompleted || false
    });
  } catch (error) {
    console.error('Error checking quiz status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
