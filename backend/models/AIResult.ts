import mongoose, { Document, Schema } from 'mongoose';

// Interface for individual AI question response
interface IAIQuestionResponse {
  questionId: mongoose.Types.ObjectId;
  question: string;
  skill: string;
  level: string;
  userAnswer: string;
  correctanswer: string;
  isCorrect: boolean;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
}

// Interface for AI skill-level summary
interface IAISkillLevelSummary {
  skill: string;
  level: string;
  totalQuestions: number;
  correctAnswers: number;
}

// Main AI Result interface
export interface IAIResult extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  overallPercentage: number;
  questionResponses: IAIQuestionResponse[];
  skillLevelSummaries: IAISkillLevelSummary[];
  aiQuizCompleted: boolean;
}

const aiQuestionResponseSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, ref: 'AIQuestions', required: true },
  question: { type: String, required: true },
  skill: { type: String, required: true },
  level: { type: String, required: true },
  userAnswer: { type: String, required: false, default: '' },
  correctanswer: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
  options: {
    a: { type: String, required: true },
    b: { type: String, required: true },
    c: { type: String, required: true },
    d: { type: String, required: true }
  }
}, { _id: false });

const aiSkillLevelSummarySchema = new Schema({
  skill: { type: String, required: true },
  level: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true }
}, { _id: false });

const aiResultSchema = new Schema<IAIResult>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  totalCorrect: { type: Number, required: true },
  totalIncorrect: { type: Number, required: true },
  overallPercentage: { type: Number, required: true },
  questionResponses: [aiQuestionResponseSchema],
  skillLevelSummaries: [aiSkillLevelSummarySchema],
  aiQuizCompleted: { type: Boolean, default: true }
}, { timestamps: true });

// Index for better query performance
aiResultSchema.index({ userId: 1 });
aiResultSchema.index({ userEmail: 1 });
aiResultSchema.index({ 'skillLevelSummaries.skill': 1, 'skillLevelSummaries.level': 1 });

export default mongoose.model<IAIResult>('AIResult', aiResultSchema); 