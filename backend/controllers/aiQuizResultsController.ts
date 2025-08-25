import { Request, Response } from 'express';
import AIResult from '../models/AIResult';
import User from '../models/User';
import mongoose from 'mongoose';

export const submitAiQuiz = async (req: Request, res: Response) => {
    const { userId, questionResponses } = req.body;

    if (!userId || !questionResponses || !Array.isArray(questionResponses)) {
        return res.status(400).json({ message: 'Missing required fields: userId and questionResponses array' });
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
            if (!response.questionId || !response.skill || !response.level || typeof response.isCorrect !== 'boolean') {
                return res.status(400).json({ message: 'Invalid question response structure' });
            }
            if (response.isCorrect) totalCorrect++;

            const key = `${response.skill}-${response.level}`;
            if (!skillLevelMap.has(key)) skillLevelMap.set(key, { correct: 0, total: 0 });
            const stats = skillLevelMap.get(key)!;
            stats.total++;
            if (response.isCorrect) stats.correct++;
        }

        const skillLevelSummaries = Array.from(skillLevelMap.entries()).map(([key, stats]) => ({
            skill: key.split('-')[0],
            level: key.split('-')[1],
            totalQuestions: stats.total,
            correctAnswers: stats.correct
        }));

        const totalQuestions = questionResponses.length;
        const overallPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        const currentAttemptNumber = user.nextAttemptNumber || 1;

        const aiResult = new AIResult({
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
            isRetest: currentAttemptNumber > 1,
            aiQuizCompleted: true
        });

        await aiResult.save();
        await User.findByIdAndUpdate(userIdObj, { 
            aiQuizCompleted: true,
            nextAttemptNumber: currentAttemptNumber + 1
        });

        res.json({
            message: 'AI Quiz result saved successfully',
            resultId: aiResult._id,
            overallPercentage
        });
    } catch (err: any) {
        console.error('Error submitting AI quiz:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getAiResults = async (req: Request, res: Response) => {
    try {
        const { page = '0', limit = '10', search = '' } = req.query;
        const pageNum = parseInt(page as string, 10) || 0;
        const limitNum = parseInt(limit as string, 10) || 10;
        const searchTerm = search as string;

        const filter: any = {};
        if (searchTerm) {
            filter.$or = [
                { userName: { $regex: searchTerm, $options: 'i' } },
                { userEmail: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        const total = await AIResult.countDocuments(filter);
        const results = await AIResult.find(filter)
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
        console.error('❌ Error fetching AI results:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getAiResultDetails = async (req: Request, res: Response) => {
    try {
        const result = await AIResult.findById(req.params.resultId);
        if (!result) {
            return res.status(404).json({ message: 'AI Result not found' });
        }
        res.json(result);
    } catch (err) {
        console.error('Error fetching AI result details:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
