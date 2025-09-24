import { Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Result from '../models/Result';
import User from '../models/User';
// import { publishQuizSubmitted } from '../natsClient';

// Submit quiz result
export const submitQuiz = async (req: Request, res: Response) => {
  const { userId, questionResponses } = req.body;

  if (!userId || !questionResponses || !Array.isArray(questionResponses)) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userIdObj);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let totalCorrect = 0;
    const skillLevelMap = new Map<string, { correct: number; total: number }>();

    for (const response of questionResponses) {
      if (response.isCorrect) {
        totalCorrect++;
      }
      const skillLevelKey = `${response.skill}-${response.level}`;
      const stats = skillLevelMap.get(skillLevelKey) || { correct: 0, total: 0 };
      stats.total++;
      if (response.isCorrect) stats.correct++;
      skillLevelMap.set(skillLevelKey, stats);
    }

    const skillLevelSummaries = Array.from(skillLevelMap.entries()).map(([key, stats]) => {
      const [skill, level] = key.split('-');
      return { skill, level, totalQuestions: stats.total, correctAnswers: stats.correct };
    });

    const totalQuestions = questionResponses.length;
    const overallPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const currentAttemptNumber = user.nextAttemptNumber || 1;

    const result = new Result({
      userId: userIdObj,
      userName: user.name,
      userEmail: user.email,
      totalQuestions,
      totalCorrect,
      totalIncorrect: totalQuestions - totalCorrect,
      overallPercentage,
      questionResponses,
      skillLevelSummaries,
      attemptNumber: currentAttemptNumber,
      isRetest: currentAttemptNumber > 1
    });

    await result.save();

    await User.findByIdAndUpdate(userIdObj, {
      quizCompleted: true,
      nextAttemptNumber: currentAttemptNumber + 1
    });

    // Publish to NATS after successful save
    // try {
    //   await publishQuizSubmitted({
    //     userId: userId,
    //     userName: user.name,
    //     userEmail: user.email,
    //     totalQuestions: totalQuestions,
    //     totalCorrect: totalCorrect,
    //     overallPercentage: overallPercentage,
    //     attemptNumber: currentAttemptNumber,
    //     resultId: result._id
    //   });
    //   console.log(' Published quiz submission to NATS');
    // } catch (natsError) {
    //   console.error(' Failed to publish to NATS:', natsError);
    //   // Don't fail the API response if NATS fails
    // }

    res.json({ 
      message: 'Result saved successfully', 
      resultId: result._id, 
      overallPercentage 
    });
  } catch (err) {
    console.error('Error submitting quiz:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all quiz results
export const getResults = async (req: Request, res: Response) => {
  try {
    const { page = '0', limit = '10', search = '' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const filter: any = {};
    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Result.countDocuments(filter);
    const results = await Result.find(filter)
      .sort({ createdAt: -1 })
      .skip(pageNum * limitNum)
      .limit(limitNum);

    const formattedResults = results.map((result: any) => ({
      _id: result._id,
      name: result.userName,
      email: result.userEmail,
      totalMarks: result.totalCorrect,
      totalQuestions: result.totalQuestions,
      overallPercentage: result.overallPercentage,
      quizDate: result.createdAt,
      skillResults: result.skillLevelSummaries
    }));

    res.json({
      results: formattedResults,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalResults: total
    });
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get detailed result
export const getDetailedResult = async (req: Request, res: Response) => {
  try {
    const result = await Result.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }
    res.json(result);
  } catch (err) {
    console.error('Error fetching result details:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check quiz status
export const checkQuizStatus = async (req: Request, res: Response) => {
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

    res.status(200).json({ quizCompleted: user.quizCompleted || false });
  } catch (error) {
    console.error('Error checking quiz status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
