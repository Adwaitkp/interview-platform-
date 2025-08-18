import mongoose, { Schema, Document } from 'mongoose';

export interface IAIQuestion extends Document {
  skill: string;
  level: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correctanswer: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  source: string;
  assignedTo?: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  questionCount: number;
}

const AIQuestionSchema = new Schema<IAIQuestion>({
  skill: { type: String, required: true },
  level: { type: String, required: true },
  question: { type: String, required: true },
  options: {
    a: { type: String, required: true },
    b: { type: String, required: true },
    c: { type: String, required: true },
    d: { type: String, required: true }
  },
  correctanswer: { type: String, required: true },
  reviewStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  source: { type: String, default: 'AI' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  questionCount: { type: Number, required: true } // Number of questions requested for this skill/level
}, { timestamps: true });

// Indexes for better query performance
AIQuestionSchema.index({ reviewStatus: 1 });
AIQuestionSchema.index({ assignedTo: 1 });
AIQuestionSchema.index({ skill: 1, level: 1 });
AIQuestionSchema.index({ generatedBy: 1 });

export const AIQuestions = mongoose.model<IAIQuestion>('AIQuestions', AIQuestionSchema);