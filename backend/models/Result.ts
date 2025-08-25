import mongoose, { Document, Schema } from 'mongoose';

// Interface for individual question response
interface IQuestionResponse {
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

// Interface for skill-level summary
interface ISkillLevelSummary {
  skill: string;
  level: string;
  totalQuestions: number;
  correctAnswers: number;
}

// Main Result interface
export interface IResult extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  overallPercentage: number;
  questionResponses: IQuestionResponse[];
  skillLevelSummaries: ISkillLevelSummary[];
  attemptNumber: number;
  isRetest: boolean;
}

const questionResponseSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, ref: 'Questions', required: true },
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

const skillLevelSummarySchema = new Schema({
  skill: { type: String, required: true },
  level: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true }
}, { _id: false });

const resultSchema = new Schema<IResult>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  totalCorrect: { type: Number, required: true },
  totalIncorrect: { type: Number, required: true },
  overallPercentage: { type: Number, required: true },
  questionResponses: [questionResponseSchema],
  skillLevelSummaries: [skillLevelSummarySchema],
  attemptNumber: { type: Number, required: true, default: 1 },
  isRetest: { type: Boolean, required: true, default: false }
}, { timestamps: true });

// Index for better query performance
resultSchema.index({ userId: 1 });
resultSchema.index({ userEmail: 1 });
resultSchema.index({ 'skillLevelSummaries.skill': 1, 'skillLevelSummaries.level': 1 });

export default mongoose.model<IResult>('Result', resultSchema); 