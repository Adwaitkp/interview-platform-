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
  private getUserKey(key: string): string {
    const userId = this.getUserIdFromToken() || 'guest';
    return `aiQuiz_${userId}_${key}`;
  }

  saveQuizState(state: Partial<QuizState>): void {
    const stateToSave = {
      questionTimers: JSON.stringify(state.questionTimers || {}),
      currentQuestionIndex: (state.currentQuestionIndex || 0).toString(),
      lockedQuestions: JSON.stringify(state.lockedQuestions || {}),
      userAnswers: JSON.stringify(state.userAnswers || {}),
      testStarted: (state.testStarted || false).toString(),
      quizCompleted: (state.quizCompleted || false).toString()
    };
    Object.entries(stateToSave).forEach(([key, value]) => {
      localStorage.setItem(this.getUserKey(key), value);
    });
  }

  restoreQuizState(): QuizState {
    const savedTimers = localStorage.getItem(this.getUserKey('questionTimers'));
    const savedIndex = localStorage.getItem(this.getUserKey('currentQuestionIndex'));
    const savedLocked = localStorage.getItem(this.getUserKey('lockedQuestions'));
    const savedUserAnswers = localStorage.getItem(this.getUserKey('userAnswers'));
    const savedTestStarted = localStorage.getItem(this.getUserKey('testStarted'));
    const savedQuizCompleted = localStorage.getItem(this.getUserKey('quizCompleted'));

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
    const keys = ['questionTimers', 'currentQuestionIndex', 'lockedQuestions', 'userAnswers', 'testStarted', 'quizCompleted'];
    keys.forEach(key => localStorage.removeItem(this.getUserKey(key)));
  }
}
