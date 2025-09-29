import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion extends Document {
  skill: string;
  question: string;
  level: string;
  type: 'single' | 'multiple' | 'truefalse';   
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctanswer: string;                        
  accepted?: boolean;
}

const QuestionSchema = new Schema<IQuestion>({
  skill: { type: String, required: true },
  question: { type: String, required: true },
  level: { type: String, required: true },
  type: { type: String, required: true, enum: ['single', 'multiple', 'truefalse'] },  // NEW
  options: {
    a: { type: String, required: true },
    b: { type: String, required: true },
    c: { type: String, required: true },
    d: { type: String, required: true }
  },
  correctanswer: { type: String, required: true },
  accepted: { type: Boolean, default: false }
}, { timestamps: true });

export const Questions = mongoose.model<IQuestion>('Questions', QuestionSchema);
