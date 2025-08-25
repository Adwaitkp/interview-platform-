import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AIQuestion {
  _id: string;
  skill: string;
  level: string;
  question: string;
  options: { [key: string]: string };
  correctanswer: string;
  reviewStatus: string;
  source: string;
  assignedTo?: string;
  generatedBy: string;
  questionCount: number;
  createdAt: string;
}

export interface QuizState {
  questionTimers: { [key: string]: number };
  currentQuestionIndex: number;
  lockedQuestions: { [key: string]: boolean };
  userAnswers: { [questionId: string]: string };
  testStarted: boolean;
  quizCompleted: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AIQuizService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getUserIdFromToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  getUserData(): Observable<any> {
    const token = localStorage.getItem('token');
    if (!token) {
      return of(null);
    }
    return this.http.get(`${this.apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      catchError(() => of(null))
    );
  }

  fetchApprovedQuestions(userId: string): Observable<AIQuestion[]> {
    const token = localStorage.getItem('token');
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.http.get<AIQuestion[]>(`${this.apiUrl}/ai-quiz/approved-ai-questions-by-set/${userId}`, { headers }).pipe(
      map(questions => Array.isArray(questions) ? questions.filter(q => q.reviewStatus === 'approved') : []),
      catchError(() => of([]))
    );
  }

  submitQuiz(userId: string, questionResponses: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai-quiz/submit-ai-quiz`, {
      userId,
      questionResponses
    });
  }

  // LocalStorage State Management
  saveQuizState(state: Partial<QuizState>): void {
    const stateToSave = {
      aiQuestionTimers: JSON.stringify(state.questionTimers || {}),
      aiCurrentQuestionIndex: (state.currentQuestionIndex || 0).toString(),
      aiLockedQuestions: JSON.stringify(state.lockedQuestions || {}),
      aiUserAnswers: JSON.stringify(state.userAnswers || {}),
      aiTestStarted: (state.testStarted || false).toString(),
      aiQuizCompleted: (state.quizCompleted || false).toString()
    };
    Object.entries(stateToSave).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }

  restoreQuizState(): QuizState {
    const savedTimers = localStorage.getItem('aiQuestionTimers');
    const savedIndex = localStorage.getItem('aiCurrentQuestionIndex');
    const savedLocked = localStorage.getItem('aiLockedQuestions');
    const savedUserAnswers = localStorage.getItem('aiUserAnswers');
    const savedTestStarted = localStorage.getItem('aiTestStarted');
    const savedQuizCompleted = localStorage.getItem('aiQuizCompleted');

    const state: QuizState = {
      questionTimers: savedTimers ? JSON.parse(savedTimers) : {},
      currentQuestionIndex: savedIndex ? Number(savedIndex) : 0,
      lockedQuestions: savedLocked ? JSON.parse(savedLocked) : {},
      userAnswers: savedUserAnswers ? JSON.parse(savedUserAnswers) : {},
      testStarted: savedTestStarted === 'true',
      quizCompleted: savedQuizCompleted === 'true'
    };
    return state;
  }

  clearQuizStorage(): void {
    const keys = ['aiQuestionTimers', 'aiCurrentQuestionIndex', 'aiLockedQuestions', 'aiUserAnswers', 'aiTestStarted', 'aiQuizCompleted'];
    keys.forEach(key => localStorage.removeItem(key));
  }
}
