import express from 'express';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import isAdmin from '../middleware/isadmin';
import User from '../models/User';
import {IUser} from '../models/User';
import Result from '../models/Result';
import AIResult from '../models/AIResult';
import { Questions } from '../models/Questions';
import { AIQuestions } from '../models/AIQuestions';


interface CustomRequest extends express.Request {
  userId?: string;
  role?: string;
}

const router = express.Router();

// add interviewee
router.post('/addinterviewee', isAdmin, async (req: CustomRequest, res: Response) => {
  try {
    // Destructure fields
    const { name, email, password, role, skill, level, questionCounts } = req.body as IUser;

    // Validate required fields
    if (!name || !email || !password || !role || !skill || !level) {
      return res.status(400).json({ message: 'All fields (name, email, password, role, skill, level) are required' });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      skill,
      level,
      questionCounts: questionCounts || {}
    });

    await newUser.save();

    res.status(201).json({
      message: 'User added successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        skill: newUser.skill,
        level: newUser.level,
        questionCounts: newUser.questionCounts
      }
    });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (for admin dashboard) with pagination and search
router.get('/users', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    
    // Create search query
    const searchQuery = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ],
      role: { $ne: 'admin' } // Exclude admin users
    } : { role: { $ne: 'admin' } };
    
    // Get total count for pagination
    const total = await User.countDocuments(searchQuery);
    
    // Get paginated users
    const users = await User.find(searchQuery)
      .select('-password')
      .skip(page * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalUsers: total
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get specific user by ID
router.get('/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Run all deletes
    const [deletedUser, deletedResults, deletedAIResults, deletedAIQuestions] = await Promise.all([
      User.findByIdAndDelete(userId),
      Result.deleteMany({ userEmail: user.email }),
      AIResult.deleteMany({ userEmail: user.email }),
      AIQuestions.deleteMany({ assignedTo: userId })
    ]);

    res.status(200).json({ 
      message: 'User and all related data deleted successfully',
      deletedResults: deletedResults.deletedCount || 0,
      deletedAIResults: deletedAIResults.deletedCount || 0,
      deletedAIQuestions: deletedAIQuestions.deletedCount || 0
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Update user
router.patch('/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;
    
    // Prevent password updates through this endpoint
    if (updates.password) {
      delete updates.password;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset user password
router.patch('/users/update/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset user quiz (allow retest)
router.patch('/users/retest/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get the highest attempt number for this user to set the next attempt
    const [lastResult, lastAIResult] = await Promise.all([
      Result.findOne({ userEmail: user.email }).sort({ attemptNumber: -1 }),
      AIResult.findOne({ userEmail: user.email }).sort({ attemptNumber: -1 })
    ]);
    
    const nextAttemptNumber = Math.max(
      (lastResult?.attemptNumber || 0),
      (lastAIResult?.attemptNumber || 0)
    ) + 1;
    
    // Reset quiz-related fields but preserve question counts
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        quizCompleted: false,
        aiQuizCompleted: false,
        assignedQuestions: {},
        nextAttemptNumber: nextAttemptNumber
        // Keep questionCounts as they were - don't reset to null
        // Keep all previous quiz results - DO NOT DELETE
      },
      { new: true }
    ).select('-password');
    
    // DO NOT DELETE existing quiz results - preserve them for history
    // Previous results will remain with their original attemptNumber and isRetest flags
    
    res.status(200).json({ 
      message: 'Quiz reset successfully - previous attempts preserved',
      nextAttemptNumber: nextAttemptNumber,
      preservedResults: true
    });
  } catch (error) {
    console.error('Error resetting quiz:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Handle cascading deletes for skill/level changes
router.patch('/users/cascade-delete/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { removedSkills, removedLevels, questionCounts, skill } = req.body;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatePromises = [];

    // Handle skill deletions - only if explicitly requested
    // We're modifying this to prevent automatic deletion of questions when skills are unticked
    if (removedSkills && removedSkills.length > 0) {

      // The frontend will now send an empty array for removedSkills when skills are just unticked
      // This prevents the deletion of questions from the database
    }

    // Handle level deletions - set question counts to 0 for removed skill+level combinations
    if (removedLevels && removedLevels.length > 0) {
      for (const { skill, level } of removedLevels) {
        // Update questionCounts to set the count to 0 for this skill+level
        if (questionCounts && questionCounts[skill]) {
          questionCounts[skill][level] = 0;
        }
      }
    }

    // Update user with new data
    const updateData: any = {};
    
    // Only update questionCounts if provided
    if (questionCounts) {
      updateData.questionCounts = questionCounts;
    }
    
    // Only update skill if provided
    if (skill) {
      updateData.skill = skill;
    }
    
    // Update other fields from req.body except removedSkills and removedLevels
    for (const [key, value] of Object.entries(req.body)) {
      if (key !== 'removedSkills' && key !== 'removedLevels' && key !== 'questionCounts' && key !== 'skill') {
        updateData[key] = value;
      }
    }
    
    // Only perform update if there are fields to update
    if (Object.keys(updateData).length > 0) {
      updatePromises.push(
        User.findByIdAndUpdate(
          userId,
          updateData,
          { new: true, runValidators: true }
        ).select('-password')
      );
    }

    // Execute update operations
    const results = await Promise.all(updatePromises);
    const updatedUser = results[0];

    res.status(200).json({
      message: 'Update completed successfully',
      updatedUser,
      removedSkills: removedSkills || [],
      removedLevels: removedLevels || []
    });

  } catch (error) {
    console.error('Error performing cascading delete:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
