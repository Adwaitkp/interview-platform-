import express from 'express';
import isAdmin from '../middleware/isadmin';
import {
  addInterviewee,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  resetPassword,
  retestUser,
  cascadeUpdateUser
} from '../controllers/userController';

const router = express.Router();

// User management routes
router.post('/addinterviewee', isAdmin, addInterviewee);
router.get('/users', isAdmin, getAllUsers);
router.get('/users/:id', isAdmin, getUserById);
router.delete('/users/:id', isAdmin, deleteUser);
router.patch('/users/:id', isAdmin, updateUser);
router.patch('/users/update/:id', isAdmin, resetPassword);
router.patch('/users/retest/:id', isAdmin, retestUser);
router.patch('/users/cascade-delete/:id', isAdmin, cascadeUpdateUser);

export default router;
