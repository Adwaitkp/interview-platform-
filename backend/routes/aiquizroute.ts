import express from 'express';
import aiQuestionGenerationRoutes from './ai-routes/ai-question-generation';
import aiQuizResultsRoutes from './ai-routes/ai-quiz-results';


const router = express.Router();

// Use the divided route files
router.use('/', aiQuestionGenerationRoutes);
router.use('/', aiQuizResultsRoutes);


export default router; 