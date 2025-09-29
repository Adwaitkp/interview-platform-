// Defines the structure for a User object for strong typing
export interface User {
  _id: string;
  name: string;
  email: string;
  skill: string[];
  level: string[];
  questionCounts?: { [skill: string]: { [level: string]: number } };
  quizType?: 'normal' | 'ai';
  assignedSetId?: string | null;
  createdAt?: string;
  questionTypeConfig?: Array<{
    skill: string;
    level: string;
    multipleChoice: number;
    trueFalse: number;
    singleChoice: number;
    total: number;
  }>;
}
