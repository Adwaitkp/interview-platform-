import express from 'express';
import isAdmin from '../../middleware/isadmin';
import {
    submitAiQuiz,
    getAiResults,
    getAiResultDetails
} from '../../controllers/aiQuizResultsController';

const router = express.Router();

router.post('/submit-ai-quiz', submitAiQuiz);
router.get('/ai-results', isAdmin, getAiResults);
router.get('/ai-result/:resultId', getAiResultDetails);

export default router;