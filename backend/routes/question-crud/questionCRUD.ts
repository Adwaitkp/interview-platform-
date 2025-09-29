import express, { Request, Response } from 'express';
import { Questions, IQuestion } from "../../models/Questions";
import isAdmin from '../../middleware/isadmin';

const router = express.Router();

// Create a new question (Admin only)
router.post('/add-question', isAdmin, async (req: Request<{}, {}, IQuestion>, res: Response) => {
  try {
    const { skill, question, level, type, options, correctanswer } = req.body;

    // Basic Validation
    if (!skill || !question || !level || !type || !options || !correctanswer) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (typeof options !== 'object') {
      return res.status(400).json({ message: 'Options must be an object' });
    }

    // Check if options contain exactly keys: a, b, c, d
    const requiredKeys = ['a', 'b', 'c', 'd'];
    const optionKeys = Object.keys(options);
    const hasAllKeys = requiredKeys.every(key => optionKeys.includes(key));

    if (!hasAllKeys || optionKeys.length !== 4) {
      return res.status(400).json({ message: 'Options must contain exactly keys: a, b, c, d' });
    }

    // Check if all option values are non-empty
    const optionValues = Object.values(options) as string[];
    if (optionValues.some(value => !value || !value.trim())) {
      return res.status(400).json({ message: 'All option values must be non-empty' });
    }

    // Trim all option values
    const trimmedOptions: Record<string, string> = {
      a: options.a.trim(),
      b: options.b.trim(),
      c: options.c.trim(),
      d: options.d.trim()
    };

    const normalizedOptions = {
      a: trimmedOptions.a.toLowerCase(),
      b: trimmedOptions.b.toLowerCase(),
      c: trimmedOptions.c.toLowerCase(),
      d: trimmedOptions.d.toLowerCase()
    };

    const trimmedCorrectAnswer = correctanswer.trim().toLowerCase();
    const validKeys = Object.keys(normalizedOptions);

    let finalCorrectAnswer = '';

    if (type === 'multiple') {
      // For multiple choice, handle comma-separated answers
      const answerParts = trimmedCorrectAnswer.split(',').map(part => part.trim());
      const allPartsValid = answerParts.every(part => validKeys.includes(part));

      if (allPartsValid) {
        finalCorrectAnswer = answerParts.join(',');
      } else {
        return res.status(400).json({
          message: 'For multiple choice, correct answer must be comma-separated keys (e.g., "a,c,d")',
          providedAnswer: trimmedCorrectAnswer,
          availableKeys: validKeys
        });
      }
    } else {
      // Single choice and true/false logic (existing code)
      if (validKeys.includes(trimmedCorrectAnswer)) {
        finalCorrectAnswer = trimmedCorrectAnswer;
      } else {
        const matchedEntry = Object.entries(normalizedOptions).find(
          ([_, val]) => val === trimmedCorrectAnswer
        );
        if (matchedEntry) {
          finalCorrectAnswer = matchedEntry[0];
        } else {
          return res.status(400).json({
            message: 'Correct answer must match one of the option values or keys (a, b, c, d)',
            providedAnswer: trimmedCorrectAnswer,
            availableOptions: trimmedOptions
          });
        }
      }
    }

    const newQuestion = new Questions({
      skill,
      question,
      level: level.toLowerCase(),
      type,
      options: trimmedOptions,
      correctanswer: finalCorrectAnswer
    });

    await newQuestion.save();
    res.status(201).json({ message: 'Question added successfully', question: newQuestion });

  } catch (error: any) {
    console.error('Error adding question:', error.message || error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Delete question by ID (Admin only)
router.delete('/delete-question/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const questionId = req.params.id;

    // Validate ObjectId format
    if (!questionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid question ID format' });
    }

    const deletedQuestion = await Questions.findByIdAndDelete(questionId);

    if (!deletedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.status(200).json({ message: 'Question deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting question:', error.message || error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Update question by ID (Admin only)
router.patch('/update-question/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const questionId = req.params.id;
    const { skill, question, level, type, options, correctanswer } = req.body;

    // Validate ObjectId format
    if (!questionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid question ID format' });
    }

    // Validation for required fields
    if (!skill || !question || !level || !type || !options || !correctanswer) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate options structure
    if (typeof options !== 'object') {
      return res.status(400).json({ message: 'Options must be an object' });
    }

    const requiredKeys = ['a', 'b', 'c', 'd'];
    const optionKeys = Object.keys(options);
    const hasAllKeys = requiredKeys.every(key => optionKeys.includes(key));

    if (!hasAllKeys || optionKeys.length !== 4) {
      return res.status(400).json({ message: 'Options must contain exactly keys: a, b, c, d' });
    }

    // Check if all option values are non-empty
    const optionValues = Object.values(options) as string[];
    if (optionValues.some(value => !value || !value.trim())) {
      return res.status(400).json({ message: 'All option values must be non-empty' });
    }

    // Normalize and trim all input values
    // Normalize and trim all input values
    const trimmedCorrectAnswer = correctanswer.trim().toLowerCase();
    const trimmedOptions: Record<string, string> = {
      a: options.a.trim(),
      b: options.b.trim(),
      c: options.c.trim(),
      d: options.d.trim()
    };

    const normalizedOptions = {
      a: trimmedOptions.a.toLowerCase(),
      b: trimmedOptions.b.toLowerCase(),
      c: trimmedOptions.c.toLowerCase(),
      d: trimmedOptions.d.toLowerCase()
    };

    const validKeys = Object.keys(normalizedOptions);

    let finalCorrectAnswer = '';

    if (type === 'multiple') {
      // For multiple choice, handle comma-separated answers
      const answerParts = trimmedCorrectAnswer.split(',').map((part: string) => part.trim());
      const allPartsValid = answerParts.every((part: string) => validKeys.includes(part));
      if (allPartsValid) {
        finalCorrectAnswer = answerParts.join(',');
      } else {
        return res.status(400).json({
          message: 'For multiple choice, correct answer must be comma-separated keys (e.g., "a,c,d")',
          providedAnswer: trimmedCorrectAnswer,
          availableKeys: validKeys
        });
      }
    } else {
      // Single choice and true/false logic (existing code)
      if (validKeys.includes(trimmedCorrectAnswer)) {
        finalCorrectAnswer = trimmedCorrectAnswer;
      } else {
        const matchedEntry = Object.entries(normalizedOptions).find(
          ([_, val]) => val === trimmedCorrectAnswer
        );
        if (matchedEntry) {
          finalCorrectAnswer = matchedEntry[0];
        } else {
          return res.status(400).json({
            message: 'Correct answer must match one of the option values or keys (a, b, c, d)',
            providedAnswer: trimmedCorrectAnswer,
            availableOptions: trimmedOptions
          });
        }
      }
    }

    // Update the question
    const updates = {
      skill,
      question,
      level: level.toLowerCase(),
      type,
      options: trimmedOptions,
      correctanswer: finalCorrectAnswer
    };

    const updatedQuestion = await Questions.findByIdAndUpdate(
      questionId,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.status(200).json({ message: 'Question updated successfully', question: updatedQuestion });

  } catch (error: any) {
    console.error('Error updating question:', error.message || error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router; 