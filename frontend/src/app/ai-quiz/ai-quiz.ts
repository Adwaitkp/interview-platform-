import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIQuizService, AIQuestion, QuizState } from '../services/ai-quiz.service';

@Component({
  selector: 'app-ai-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-quiz.html'
})
export class AIQuizComponent implements OnInit, OnDestroy {
  questions: AIQuestion[] = [];
  currentQuestionIndex: number = 0;
  selectedAnswer: string = '';
  quizCompleted: boolean = false;
  isSubmitting: boolean = false;
  userAnswers: { [questionId: string]: string } = {};

  testStarted: boolean = false;
  timer: number = 0;
  timerInterval: any = null;
  questionTimeMap: { [level: string]: number } = { 'beginner': 90, 'intermediate': 120, 'advanced': 150 };
  questionTimers: { [key: string]: number } = {};
  lockedQuestions: { [key: string]: boolean } = {};
  loading = false;

  constructor(private aiQuizService: AIQuizService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.aiQuizService.getUserData().subscribe(userData => {
      if (!userData) {
        window.location.href = '/login';
        return;
      }
      if (userData.quizType !== 'ai') {
        alert('No AI quiz assigned. Please contact your administrator.');
        window.location.href = '/';
        return;
      }

      const restoredState = this.aiQuizService.restoreQuizState();
      this.applyState(restoredState);
      // Database state takes priority over localStorage for quiz completion
      this.quizCompleted = userData.aiQuizCompleted === true;

      this.loadQuestions();
    });
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  private applyState(state: QuizState) {
    this.questionTimers = state.questionTimers;
    this.currentQuestionIndex = state.currentQuestionIndex;
    this.lockedQuestions = state.lockedQuestions;
    this.userAnswers = state.userAnswers;
    this.testStarted = state.testStarted;

  }

  loadQuestions() {
    this.loading = true;
    const userId = this.aiQuizService.getUserIdFromToken();
    if (!userId) {
      this.loading = false;
      return;
    }

    this.aiQuizService.fetchApprovedQuestions(userId).subscribe(questions => {
      this.questions = questions;
      this.loading = false;
      this.initializeQuizAfterLoad();
    });
  }

  private initializeQuizAfterLoad() {
    if (this.questions.length === 0 || this.quizCompleted) return;

    this.initTimers();

    if (this.currentQuestionIndex >= this.questions.length) {
      this.currentQuestionIndex = 0;
    }

    this.updateSelectedAnswerForCurrentQuestion();
    this.autoAdvanceIfLockedOrExpired();

    if (this.testStarted) {
      this.startTimer();
    } else {
      this.startQuiz();
    }

    this.saveQuizState();
    this.cdr.detectChanges();
  }

  private updateSelectedAnswerForCurrentQuestion() {
    const currentQuestionId = this.currentQuestion?._id;
    this.selectedAnswer = currentQuestionId ? this.userAnswers[currentQuestionId] || '' : '';
    this.cdr.detectChanges();
  }

  get currentQuestion(): AIQuestion | null {
    return this.questions[this.currentQuestionIndex] || null;
  }

  nextQuestion(): void {
    this.updateAnswerAndNavigate(this.currentQuestionIndex + 1);
  }

  prevQuestion(): void {
    this.updateAnswerAndNavigate(this.currentQuestionIndex - 1);
  }

  private updateAnswerAndNavigate(newIndex: number) {
    this.clearTimer();
    const currentQuestionId = this.currentQuestion?._id;
    if (currentQuestionId) {
      this.userAnswers[currentQuestionId] = this.selectedAnswer;
    }

    if (newIndex >= 0 && newIndex < this.questions.length) {
      this.currentQuestionIndex = newIndex;
      this.updateSelectedAnswerForCurrentQuestion();
      this.startTimer();
      this.saveQuizState();
    } else if (newIndex >= this.questions.length) {
      this.submitQuiz();
    }
    this.cdr.detectChanges();
  }

  onAnswerSelect(option: string): void {
    this.selectedAnswer = option;
    const currentQuestionId = this.currentQuestion?._id;
    if (currentQuestionId) {
      this.userAnswers[currentQuestionId] = option;
      this.saveQuizState();
    }
    this.cdr.detectChanges();
  }

  startQuiz() {
    if (!this.testStarted && !this.quizCompleted) {
      if (Object.keys(this.questionTimers).length === 0) {
        this.resetQuizState();
        this.initTimers();
      }
      this.testStarted = true;
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

  initTimers() {
    this.questions.forEach(q => {
      if (!this.questionTimers.hasOwnProperty(q._id)) {
        const levelKey = q.level?.toLowerCase().trim() || 'beginner';
        this.questionTimers[q._id] = this.questionTimeMap[levelKey] || 90;
      }
    });
  }

  startTimer() {
    this.clearTimer();
    const q = this.currentQuestion;
    if (!q || !this.questionTimers.hasOwnProperty(q._id)) return;

    this.timer = this.questionTimers[q._id];
    this.timerInterval = setInterval(() => {
      if (this.timer > 0) {           // Add this check
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

      const nextQuestionIndex = this.findNextQuestionWithTime();
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
      const q = this.questions[i];
      if (q && !this.lockedQuestions[q._id] && this.questionTimers[q._id] > 0) return i;
    }
    for (let i = 0; i < this.currentQuestionIndex; i++) {
      const q = this.questions[i];
      if (q && !this.lockedQuestions[q._id] && this.questionTimers[q._id] > 0) return i;
    }
    return -1;
  }

  saveQuizState() {
    const state: QuizState = {
      questionTimers: this.questionTimers,
      currentQuestionIndex: this.currentQuestionIndex,
      lockedQuestions: this.lockedQuestions,
      userAnswers: this.userAnswers,
      testStarted: this.testStarted,
      quizCompleted: this.quizCompleted
    };
    this.aiQuizService.saveQuizState(state);
  }

  submitQuiz() {
    this.clearTimer();
    const userId = this.aiQuizService.getUserIdFromToken();
    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }

    this.isSubmitting = true;
    const questionResponses = this.questions.map(q => ({
      questionId: q._id,
      question: q.question,
      skill: q.skill,
      level: q.level,
      userAnswer: this.userAnswers[q._id] || '',
      correctanswer: q.correctanswer,
      isCorrect: (this.userAnswers[q._id] || '').toLowerCase() === q.correctanswer.toLowerCase(),
      options: q.options
    }));

    this.aiQuizService.submitQuiz(userId, questionResponses).subscribe({
      next: () => {
        this.quizCompleted = true;
        this.testStarted = false;
        this.isSubmitting = false;
        this.aiQuizService.clearQuizStorage();
        localStorage.setItem('aiQuizCompleted', 'true'); // Keep this to prevent re-taking
      },
      error: () => {
        alert('Error submitting quiz. Please try again.');
        this.isSubmitting = false;
      }
    });
  }

  autoAdvanceIfLockedOrExpired() {
    while (this.currentQuestionIndex < this.questions.length) {
      const q = this.questions[this.currentQuestionIndex];
      if (q && (this.lockedQuestions[q._id] || this.questionTimers[q._id] <= 0)) {
        this.currentQuestionIndex++;
      } else {
        break;
      }
    }
    this.updateSelectedAnswerForCurrentQuestion();
  }

  getOptions(q: any): { key: string; value: string }[] {
    return q?.options ? Object.entries(q.options).map(([key, value]) => ({
      key: key.toUpperCase(),
      value: String(value)
    })) : [];
  }

  trackByOptionKey(index: number, option: any): string {
    return option.key || index;
  }

  get formattedTimer(): string {
    const mins = Math.floor(this.timer / 60);
    const secs = this.timer % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}