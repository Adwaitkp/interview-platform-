import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface QuizQuestion {
  _id: string;
  skill: string;
  level: string;
  question: string;
  type?: 'single' | 'multiple' | 'truefalse'; // NEW: Added type field
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctanswer: string;
}

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.html'
})
export class QuizComponent implements OnInit, OnDestroy {
  questions: QuizQuestion[] = [];
  currentQuestionIndex: number = 0;
  selectedAnswer: string = '';
  selectedAnswers: string[] = []; // NEW: For multiple correct answers
  quizCompleted: boolean = false;
  isSubmitting: boolean = false;
  userAnswers: { [questionId: string]: string } = {};

  // Timer related properties
  testStarted: boolean = false;
  timer: number = 0;
  timerInterval: any = null;
  questionTimeMap: { [level: string]: number } = { 'beginner': 90, 'intermediate': 120, 'advanced': 150 };
  questionTimers: { [key: string]: number } = {};
  lockedQuestions: { [key: string]: boolean } = {};
  shuffledOptions: { [questionId: string]: Array<{ key: string; value: string; originalKey: string }> } = {};
  alreadyAttempted: boolean = false;
  skills: string[] = [];
  levels: string[] = [];
  loading = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    this.http.get(`${environment.apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (userData: any) => {
        if (userData.quizType !== 'normal') {
          alert('No quiz assigned. Please contact your administrator.');
          window.location.href = '/';
          return;
        }

        this.restoreQuizState();
        this.loadUserQuestionCounts();
      },
      error: () => {
        window.location.href = '/login';
      }
    });
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  private restoreQuizState() {
    const savedTimers = localStorage.getItem('questionTimers');
    const savedIndex = localStorage.getItem('currentQuestionIndex');
    const savedLocked = localStorage.getItem('lockedQuestions');
    const savedUserAnswers = localStorage.getItem('userAnswers');
    const savedTestStarted = localStorage.getItem('testStarted');
    const savedQuizCompleted = localStorage.getItem('quizCompleted');

    if (savedTimers) {
      try { this.questionTimers = JSON.parse(savedTimers); } catch { this.questionTimers = {}; }
    }

    if (savedLocked) {
      try { this.lockedQuestions = JSON.parse(savedLocked); } catch { this.lockedQuestions = {}; }
    }

    if (savedUserAnswers) {
      try { this.userAnswers = JSON.parse(savedUserAnswers); } catch { this.userAnswers = {}; }
    }

    if (savedTestStarted) {
      this.testStarted = savedTestStarted === 'true';
    }

    if (savedIndex && !isNaN(Number(savedIndex))) {
      this.currentQuestionIndex = Number(savedIndex);
    }

    if (savedQuizCompleted === 'true') {
      this.quizCompleted = true;
    }

    // Restore shuffled options
    const savedShuffledOptions = localStorage.getItem(`shuffledOptions_${localStorage.getItem('intervieweeId')}`);
    if (savedShuffledOptions) {
      try { this.shuffledOptions = JSON.parse(savedShuffledOptions); } catch { this.shuffledOptions = {}; }
    }
  }

  loadUserQuestionCounts() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.fetchAllQuestions();
      return;
    }

    this.http.get(`${environment.apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (userData: any) => {
        this.quizCompleted = userData.quizCompleted === true;
        this.fetchAllQuestions();
      },
      error: () => {
        this.quizCompleted = false;
        this.fetchAllQuestions();
      }
    });
  }

  fetchAllQuestions() {
    this.loading = true;
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('intervieweeId');
    if (!userId) {
      this.loading = false;
      this.questions = [];
      return;
    }

    const apiUrl = `${environment.apiUrl}/questions?userId=${userId}`;
    this.http.get(apiUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }).subscribe({
      next: (questions: any) => {
        this.questions = Array.isArray(questions) ? questions : [];
        if (this.questions.length > 0) {
          this.skills = Array.from(new Set(this.questions.map(q => q.skill))).filter(Boolean);
          this.levels = Array.from(new Set(this.questions.map(q => q.level))).filter(Boolean);
        } else {
          this.skills = [];
          this.levels = [];
        }

        this.loading = false;
        this.initializeQuizAfterLoad();
      },
      error: (error) => {
        console.error('Error fetching questions:', error);
        this.questions = [];
        this.loading = false;
      }
    });
  }

  private initializeQuizAfterLoad() {
    if (this.questions.length === 0) return;
    if (this.quizCompleted) return;

    this.initTimers();
    const savedIndex = localStorage.getItem('currentQuestionIndex');
    let index = 0;
    if (savedIndex && !isNaN(Number(savedIndex))) {
      const num = Number(savedIndex);
      if (num >= 0 && num < this.questions.length) {
        index = num;
      }
    }

    this.currentQuestionIndex = index;
    this.updateSelectedAnswerForCurrentQuestion();
    this.autoAdvanceIfLockedOrExpired();

    if (!this.testStarted) {
      this.startQuiz();
    } else {
      this.startTimer();
    }

    this.saveQuizState();
    this.cdr.detectChanges();
  }

  // UPDATED: Support for multiple answer types
  private updateSelectedAnswerForCurrentQuestion() {
    if (this.currentQuestion && this.userAnswers[this.currentQuestion._id]) {
      const userAnswer = this.userAnswers[this.currentQuestion._id];
      
      // Check if it's a multiple choice question
      if (this.currentQuestion.type === 'multiple') {
        this.selectedAnswers = userAnswer.split(',').filter(ans => ans.trim());
        this.selectedAnswer = '';
      } else {
        this.selectedAnswer = userAnswer;
        this.selectedAnswers = [];
      }
    } else {
      this.selectedAnswer = '';
      this.selectedAnswers = [];
    }

    this.cdr.detectChanges();
  }

  get currentQuestion(): QuizQuestion | null {
    return this.questions[this.currentQuestionIndex] || null;
  }

  nextQuestion(): void {
    this.clearTimer();
    if (this.currentQuestion) {
      // Save answer based on question type
      if (this.currentQuestion.type === 'multiple') {
        this.userAnswers[this.currentQuestion._id] = this.selectedAnswers.join(',');
      } else {
        this.userAnswers[this.currentQuestion._id] = this.selectedAnswer;
      }
    }

    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateSelectedAnswerForCurrentQuestion();
      this.startTimer();
      this.saveQuizState();
    } else {
      this.submitQuiz();
    }

    this.cdr.detectChanges();
  }

  prevQuestion(): void {
    this.clearTimer();
    if (this.currentQuestion) {
      // Save answer based on question type
      if (this.currentQuestion.type === 'multiple') {
        this.userAnswers[this.currentQuestion._id] = this.selectedAnswers.join(',');
      } else {
        this.userAnswers[this.currentQuestion._id] = this.selectedAnswer;
      }
    }

    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.updateSelectedAnswerForCurrentQuestion();
      this.startTimer();
      this.saveQuizState();
    }

    this.cdr.detectChanges();
  }

  // UPDATED: Handle single answer selection
 onAnswerSelect(option: string): void {
  this.selectedAnswer = option;
  if (this.currentQuestion && this.currentQuestion._id) {
    this.userAnswers[this.currentQuestion._id] = option;
    this.saveQuizState();
  }
  this.cdr.detectChanges();
}


  // NEW: Handle multiple answer selection
  onMultipleAnswerChange(event: any, optionKey: string): void {
  if (event.target.checked) {
    if (!this.selectedAnswers.includes(optionKey)) {
      this.selectedAnswers.push(optionKey);
    }
  } else {
    this.selectedAnswers = this.selectedAnswers.filter(opt => opt !== optionKey);
  }
  
  if (this.currentQuestion && this.currentQuestion._id) {
    this.userAnswers[this.currentQuestion._id] = this.selectedAnswers.join(',');
    this.saveQuizState();
  }
  this.cdr.detectChanges();
}


  // NEW: Check if option is selected (for styling)
  isOptionSelected(optionKey: string): boolean {
    if (!this.currentQuestion) return false;
    if (this.currentQuestion.type === 'multiple') {
      return this.selectedAnswers.includes(optionKey);
    }
    return this.selectedAnswer === optionKey;
  }

  // NEW: Handle option click for both single and multiple
  onOptionClick(optionKey: string): void {
  if (!this.currentQuestion || !this.currentQuestion._id) return;
  
  if (this.currentQuestion.type === 'multiple') {
    const index = this.selectedAnswers.indexOf(optionKey);
    if (index >= 0) {
      this.selectedAnswers.splice(index, 1);
    } else {
      this.selectedAnswers.push(optionKey);
    }
    this.userAnswers[this.currentQuestion._id] = this.selectedAnswers.join(',');
  } else {
    this.selectedAnswer = optionKey;
    this.userAnswers[this.currentQuestion._id] = optionKey;
  }
  this.saveQuizState();
}


  startQuiz() {
    if (!this.testStarted && !this.quizCompleted) {
      if (Object.keys(this.questionTimers).length === 0) {
        this.resetQuizState();
        this.initTimers();
      }

      this.testStarted = true;
      this.alreadyAttempted = false;
      this.startTimer();
      this.saveQuizState();
    }
  }

  private resetQuizState() {
    this.testStarted = false;
    this.userAnswers = {};
    this.lockedQuestions = {};
    this.questionTimers = {};
    this.currentQuestionIndex = 0;
  }

  private clearQuizStorage() {
    const keys = ['questionTimers', 'currentQuestionIndex', 'lockedQuestions', 'userAnswers', 'testStarted'];
    keys.forEach(key => localStorage.removeItem(key));
  }

  initTimers() {
    for (const q of this.questions) {
      if (!this.questionTimers.hasOwnProperty(q._id)) {
        const levelKey = q.level ? q.level.toLowerCase().trim() : 'beginner';
        const timeForLevel = this.questionTimeMap[levelKey] || 90;
        this.questionTimers[q._id] = timeForLevel;
      }
    }
  }

  startTimer() {
    this.clearTimer();
    const q = this.currentQuestion;
    if (!q) return;

    if (!this.questionTimers.hasOwnProperty(q._id)) {
      const levelKey = q.level ? q.level.toLowerCase().trim() : 'beginner';
      this.questionTimers[q._id] = this.questionTimeMap[levelKey] || 90;
    }

    this.timer = this.questionTimers[q._id];
    this.timerInterval = setInterval(() => {
      if (this.timer > 0) {
        this.timer--;
        this.questionTimers[q._id] = this.timer;
        this.saveQuizState();
      }

      if (this.timer <= 0) {
        this.handleTimerExpire();
      }
    }, 1000);
  }

  clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  handleTimerExpire() {
    this.clearTimer();
    const q = this.currentQuestion;
    if (q) {
      this.lockedQuestions[q._id] = true;
      this.saveQuizState();

      let nextQuestionIndex = this.findNextQuestionWithTime();
      if (nextQuestionIndex !== -1) {
        this.currentQuestionIndex = nextQuestionIndex;
        this.updateSelectedAnswerForCurrentQuestion();
        this.startTimer();
        this.saveQuizState();
      } else {
        this.submitQuiz();
      }
    }
  }

  findNextQuestionWithTime(): number {
    for (let i = this.currentQuestionIndex + 1; i < this.questions.length; i++) {
      const question = this.questions[i];
      if (question && !this.lockedQuestions[question._id] && this.questionTimers[question._id] > 0) {
        return i;
      }
    }

    for (let i = 0; i < this.currentQuestionIndex; i++) {
      const question = this.questions[i];
      if (question && !this.lockedQuestions[question._id] && this.questionTimers[question._id] > 0) {
        return i;
      }
    }

    return -1;
  }

  saveQuizState() {
    const state = {
      questionTimers: JSON.stringify(this.questionTimers),
      currentQuestionIndex: this.currentQuestionIndex.toString(),
      lockedQuestions: JSON.stringify(this.lockedQuestions),
      userAnswers: JSON.stringify(this.userAnswers),
      testStarted: this.testStarted.toString(),
      quizCompleted: this.quizCompleted.toString()
    };

    Object.entries(state).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }

  submitQuiz() {
    this.clearTimer();
    this.clearQuizStorage();

    if (this.alreadyAttempted) {
      alert('You have already attempted this quiz.');
      return;
    }

    const intervieweeId = localStorage.getItem('intervieweeId');
    if (!intervieweeId) {
      alert('Interviewee ID not found. Please log in again.');
      return;
    }

    this.isSubmitting = true;
    const questionResponses = this.questions.map(q => {
      const shuffledOptions = this.shuffledOptions[q._id] || [];
      const userAnswerRaw = this.userAnswers[q._id] || '';
      
      // Handle multiple answers
      let originalAnswer = '';
      if (q.type === 'multiple') {
        const userAnswers = userAnswerRaw.split(',');
        const originalAnswers = userAnswers.map(ans => {
          const selectedOption = shuffledOptions.find(opt => opt.key === ans);
          return selectedOption ? selectedOption.originalKey : ans;
        });
        originalAnswer = originalAnswers.join(',');
      } else {
        const selectedOption = shuffledOptions.find(opt => opt.key === userAnswerRaw);
        originalAnswer = selectedOption ? selectedOption.originalKey : userAnswerRaw;
      }

      return {
        questionId: q._id,
        question: q.question,
        skill: q.skill,
        level: q.level,
        userAnswer: originalAnswer,
        correctanswer: q.correctanswer,
        isCorrect: this.isAnswerCorrect(q, originalAnswer),
        options: q.options
      };
    });

    this.http.post(`${environment.apiUrl}/quiz/submit`, {
      userId: intervieweeId,
      questionResponses
    }).subscribe({
      next: () => {
        this.quizCompleted = true;
        this.testStarted = false;
        localStorage.setItem('quizCompleted', 'true');
        this.isSubmitting = false;
      },
      error: (err) => {
        alert('Error submitting quiz. Please try again.');
        this.isSubmitting = false;
      }
    });

    return false;
  }

  // NEW: Updated answer correctness check
  private isAnswerCorrect(question: QuizQuestion, userAnswer: string): boolean {
    if (question.type === 'multiple') {
      const correctAnswers = question.correctanswer.split(',').map(ans => ans.trim().toLowerCase()).sort();
      const userAnswers = userAnswer.split(',').map(ans => ans.trim().toLowerCase()).sort();
      
      return correctAnswers.length === userAnswers.length && 
             correctAnswers.every((ans, index) => ans === userAnswers[index]);
    } else {
      return userAnswer.toLowerCase() === question.correctanswer.toLowerCase();
    }
  }

  autoAdvanceIfLockedOrExpired() {
    while (this.currentQuestionIndex < this.questions.length - 1) {
      const currentQ = this.questions[this.currentQuestionIndex];
      if (currentQ && (this.lockedQuestions[currentQ._id] || this.questionTimers[currentQ._id] <= 0)) {
        this.currentQuestionIndex++;
      } else {
        break;
      }
    }

    this.updateSelectedAnswerForCurrentQuestion();
  }

  // UPDATED: Support for true/false questions
  getOptions(q?: any): Array<{ key: string; value: string; originalKey: string }> {
  const qq = q || this.currentQuestion;
  if (!qq) return [];

  // Handle true/false questions (type 'truefalse')
  if (qq.type === 'truefalse') {
    return [
      { key: 'A', value: 'True', originalKey: 'true' },
      { key: 'B', value: 'False', originalKey: 'false' }
    ];
  }

  if (this.shuffledOptions[qq._id]) {
    return this.shuffledOptions[qq._id];
  }

  const originalOptions: Array<{ key: string; value: string; originalKey: string }> = [];
  if (qq.options) {
    Object.entries(qq.options).forEach(([key, value]) => {
      originalOptions.push({
        key: key.toUpperCase(),
        value: String(value),
        originalKey: key.toLowerCase()
      });
    });
  }

  const shuffled = [...originalOptions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const shuffledWithNewKeys = shuffled.map((option, index) => ({
    key: String.fromCharCode(65 + index), // A, B, C, D
    value: option.value,
    originalKey: option.originalKey
  }));

  this.shuffledOptions[qq._id] = shuffledWithNewKeys;
  this.saveShuffledOptions();
  return shuffledWithNewKeys;
}

  trackByOptionKey(index: number, option: any): string {
    return option.key || index;
  }

  get formattedTimer(): string {
    const mins = Math.floor(this.timer / 60);
    const secs = this.timer % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  private saveShuffledOptions(): void {
    const userId = localStorage.getItem('intervieweeId');
    if (!userId) return;
    localStorage.setItem(`shuffledOptions_${userId}`, JSON.stringify(this.shuffledOptions));
  }

  get canShowSubmitButton(): boolean {
    if (!this.testStarted || this.quizCompleted) return false;
    const len = this.questions.length;
    if (len === 0) return false;

    const lastIdx = len - 1;
    const lastId = this.questions[lastIdx]?._id;
    const lastExpired = this.isQuestionExpiredById(lastId);

    if (!lastExpired) {
      return this.currentQuestionIndex === lastIdx;
    }

    if (len >= 2) {
      const secondIdx = len - 2;
      const secondId = this.questions[secondIdx]?._id;
      const secondExpired = this.isQuestionExpiredById(secondId);

      if (!secondExpired) {
        return this.currentQuestionIndex === secondIdx;
      }

      if (len >= 3) {
        const thirdIdx = len - 3;
        return this.currentQuestionIndex === thirdIdx;
      }
    }

    return false;
  }

  private isQuestionExpiredById(questionId?: string): boolean {
    if (!questionId) return true;
    const locked = !!this.lockedQuestions[questionId];
    const timer = this.questionTimers[questionId];
    const timedOut = typeof timer === 'number' ? timer <= 0 : false;
    return locked || timedOut;
  }
}
