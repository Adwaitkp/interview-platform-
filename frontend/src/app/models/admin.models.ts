export interface QuestionResponse {
  questionId: string;
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

export interface SkillLevelSummary {
  skill: string;
  level: string;
  totalQuestions: number;
  correctAnswers: number;
}

export interface QuizResult {
  _id: string;
  name: string;
  email: string;
  totalMarks: number;
  totalQuestions: number;
  overallPercentage: number;
  skillResults: SkillLevelSummary[];
  questionResponses?: QuestionResponse[];
  quizDate?: string | Date;
  userId?: string;
  aiScore?: {
    totalMarks: number;
    totalQuestions: number;
    overallPercentage: number;
    skillLevelSummaries?: Array<{
      skill: string;
      level: string;
      totalQuestions: number;
      correctAnswers: number;
    }>;
  };
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  skill?: string[];
  level?: string;
  questionCounts?: { [skill: string]: { [level: string]: number } };
}
