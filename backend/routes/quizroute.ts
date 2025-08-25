import express from 'express';
import isAdmin from '../middleware/isadmin';
import { submitQuiz, getResults, getDetailedResult, checkQuizStatus } from '../controllers/quizController';

const router = express.Router();

// Submit quiz result
router.post('/submit', submitQuiz);

// Get all quiz results (admin)
router.get('/results', isAdmin, getResults);

// Get detailed result by ID
router.get('/result/:resultId', getDetailedResult);

// Check quiz completion status
router.get('/check-status', checkQuizStatus);

export default router;
