import express from 'express';
import isAdmin from '../../middleware/isadmin';
import {
    generateAiQuestions,
    getUserSets,
    getAllAiQuestions,
    getPendingAiQuestions,
    approveAiQuestion,
    deleteAiQuestion,
    getApprovedAiQuestions,
    getAllSets,
    getApprovedAiQuestionsBySet
} from '../../controllers/aiQuestionController';

const router = express.Router();

router.post('/generate-ai-questions', isAdmin, generateAiQuestions);
router.get('/user-sets/:userId', isAdmin, getUserSets);
router.get('/all-ai-questions', isAdmin, getAllAiQuestions);
router.get('/pending-ai-questions', isAdmin, getPendingAiQuestions);
router.post('/approve-ai-question', isAdmin, approveAiQuestion);
router.delete('/delete-ai-question/:questionId', isAdmin, deleteAiQuestion);
router.get('/approved-ai-questions/:userId', getApprovedAiQuestions);
router.get('/all-sets', isAdmin, getAllSets);
router.get('/approved-ai-questions-by-set/:userId', getApprovedAiQuestionsBySet);

export default router; 