import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import Result from '../models/Result';
import AIResult from '../models/AIResult';
import { AIQuestions } from '../models/AIQuestions';

interface CustomRequest extends Request {
  userId?: string;
  role?: string;
}

// Add Interviewee
export const addInterviewee = async (req: CustomRequest, res: Response) => {
  try {
    const { name, email, password, role, skill, level, questionCounts } = req.body as IUser;

    if (!name || !email || !password || !role || !skill || !level) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

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
};

// Get all users
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';

    const searchQuery = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ],
      role: { $ne: 'admin' }
    } : { role: { $ne: 'admin' } };

    const total = await User.countDocuments(searchQuery);
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
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [deletedUser, deletedResults, deletedAIResults, deletedAIQuestions] = await Promise.all([
      User.findByIdAndDelete(req.params.id),
      Result.deleteMany({ userEmail: user.email }),
      AIResult.deleteMany({ userEmail: user.email }),
      AIQuestions.deleteMany({
        $or: [
          { assignedTo: req.params.id },
          { generatedBy: req.params.id }
        ]
      })
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
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    if (updates.password) {
      delete updates.password;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
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
};

// Reset user password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
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
};

// Retest user
export const retestUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [lastResult, lastAIResult] = await Promise.all([
      Result.findOne({ userEmail: user.email }).sort({ attemptNumber: -1 }),
      AIResult.findOne({ userEmail: user.email }).sort({ attemptNumber: -1 })
    ]);

    const nextAttemptNumber = Math.max(
      (lastResult?.attemptNumber || 0),
      (lastAIResult?.attemptNumber || 0)
    ) + 1;

    await User.findByIdAndUpdate(
      req.params.id,
      {
        quizCompleted: false,
        aiQuizCompleted: false,
        assignedQuestions: {}, // This clears assigned questions
        nextAttemptNumber: nextAttemptNumber,
        $unset: { isRetest: 1 } // Remove any retest flag
      },
      { new: true }
    );

    res.status(200).json({
      message: 'Quiz reset successfully - previous attempts preserved',
      nextAttemptNumber: nextAttemptNumber,
      preservedResults: true
    });
  } catch (error) {
    console.error('Error resetting quiz:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Cascade delete for skill/level changes
export const cascadeUpdateUser = async (req: Request, res: Response) => {
  try {
    const { removedSkills, removedLevels, questionCounts, skill } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData: any = {};

    if (removedLevels && removedLevels.length > 0) {
      for (const { skill, level } of removedLevels) {
        if (questionCounts && questionCounts[skill]) {
          questionCounts[skill][level] = 0;
        }
      }
    }

    if (questionCounts) updateData.questionCounts = questionCounts;
    if (skill) updateData.skill = skill;

    for (const [key, value] of Object.entries(req.body)) {
      if (!['removedSkills', 'removedLevels', 'questionCounts', 'skill'].includes(key)) {
        updateData[key] = value;
      }
    }

    let updatedUser = null;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');
    }

    res.status(200).json({
      message: 'Update completed successfully',
      updatedUser: updatedUser || user,
      removedSkills: removedSkills || [],
      removedLevels: removedLevels || []
    });
  } catch (error) {
    console.error('Error performing cascading update:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
