// models/User.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'interviewee';
  skill?: string[];
  level?: string[];   
  quizCompleted?: boolean;
  aiQuizCompleted?: boolean;
  questionCounts?: { [skill: string]: { [level: string]: number } };
  assignedQuestions?: Map<string, string[]>;
  quizType?: string; 
  assignedSetId?: string;
  nextAttemptNumber?: number;
  userSpecificSets?: { setId: string; label: string }[];
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'interviewee'], required: true },
  skill: { type: [String] },
  level: { type: [String] },
  quizCompleted: { type: Boolean, default: false },
  aiQuizCompleted: { type: Boolean, default: false },
  questionCounts: { type: Schema.Types.Mixed, default: {} },
  assignedQuestions: {
    type: Map,
    of: [String],
    default: function () {
      return new Map();
    }
  },
  quizType: { type: String },
  assignedSetId: { type: String, default: null },
  nextAttemptNumber: { type: Number, default: 1 },
  userSpecificSets: [{ 
    setId: { type: String, required: true }, 
    label: { type: String, required: true } 
  }],
}, 
  { timestamps: true } 
);
export default mongoose.model<IUser>('User', userSchema);
