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
  // Persisted deterministic order list of question IDs
  private persistedQuestionOrder: string[] = [];
  skillOrder: string[] = [];
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
  shuffledOptions: { [questionId: string]: Array<{ key: string; value: string; originalKey: string }> } = {};
  // All stored userAnswers use ORIGINAL option keys (a,b,c,d,...)
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

      // Capture skill order from user data
      if (Array.isArray(userData.skill)) {
        this.skillOrder = userData.skill;
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
    this.restoreShuffledOptions();
    this.restoreQuestionOrder();
  }

  loadQuestions() {
    this.loading = true;
    const userId = this.aiQuizService.getUserIdFromToken();
    if (!userId) {
      this.loading = false;
      return;
    }

    this.aiQuizService.fetchApprovedQuestions(userId).subscribe(questions => {
      // Persist or reuse existing order
      if (this.persistedQuestionOrder.length === 0) {
        const ordered = this.orderQuestionsBySkill(questions);
        this.questions = ordered;
        this.persistedQuestionOrder = ordered.map(q => q._id);
        this.saveQuestionOrder();
      } else {
        // Rebuild questions in saved order (ignore any new extra questions for stability)
        const map: { [id: string]: AIQuestion } = {};
        questions.forEach(q => map[q._id] = q);
        this.questions = this.persistedQuestionOrder.map(id => map[id]).filter(Boolean);
      }
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
    if (!currentQuestionId) { this.selectedAnswer = ''; return; }
    let stored = this.userAnswers[currentQuestionId] || '';
    // Migration: if old letter key (A-D) stored, map back via shuffledOptions
    if (/^[A-Z]$/.test(stored)) {
      const mapping = this.shuffledOptions[currentQuestionId] || [];
      const found = mapping.find(o => o.key === stored);
      if (found) {
        stored = found.originalKey;
        this.userAnswers[currentQuestionId] = stored;
        this.aiQuizService.saveQuizState({ userAnswers: this.userAnswers });
      }
    }
    this.selectedAnswer = stored;
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
    // 'option' is original key
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
    this.shuffledOptions = {};
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
    this.saveShuffledOptions();
  }

  submitQuiz() {
    this.clearTimer();
    const userId = this.aiQuizService.getUserIdFromToken();
    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }

    this.isSubmitting = true;
    
    const questionResponses = this.questions.map(q => {
      const originalAnswer = this.userAnswers[q._id] || '';
      return {
        questionId: q._id,
        question: q.question,
        skill: q.skill,
        level: q.level,
        userAnswer: originalAnswer,
        correctanswer: q.correctanswer,
        isCorrect: originalAnswer.toLowerCase() === q.correctanswer.toLowerCase(),
        options: q.options
      };
    });
    
    this.aiQuizService.submitQuiz(userId, questionResponses).subscribe({
      next: () => {
        this.quizCompleted = true;
        this.testStarted = false;
        this.isSubmitting = false;
        this.aiQuizService.clearQuizStorage();
        // Set completion flag using user-specific key
        const userKey = `aiQuiz_${userId}_quizCompleted`;
        localStorage.setItem(userKey, 'true');
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

  getOptions(q?: any): Array<{ key: string; value: string; originalKey: string; displayKey: string }> {
    const qq = q || this.currentQuestion;
    if (!qq) return [];
    const base: Array<{ originalKey: string; value: string }> = [];
    if (qq.options) {
      Object.entries(qq.options).forEach(([k, v]) => base.push({ originalKey: k.toLowerCase(), value: String(v) }));
    }
    const userId = this.aiQuizService.getUserIdFromToken() || 'guest';
    const seed = `${userId}_${qq._id}`;
    const shuffled = this.deterministicShuffle([...base], seed);
    const mapped = shuffled.map((o, idx) => ({
      key: o.originalKey,
      value: o.value,
      originalKey: o.originalKey,
      displayKey: String.fromCharCode(65 + idx)
    }));
    this.shuffledOptions[qq._id] = mapped.map(m => ({ key: m.displayKey, value: m.value, originalKey: m.originalKey }));
    this.saveShuffledOptions();
    return mapped;
  }

  trackByOptionKey(index: number, option: any): string {
    return option.originalKey || option.key || index;
  }

  get formattedTimer(): string {
    const mins = Math.floor(this.timer / 60);
    const secs = this.timer % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  private shuffleArray(array: AIQuestion[]): AIQuestion[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private orderQuestionsBySkill(questions: AIQuestion[]): AIQuestion[] {
    if (!questions || questions.length === 0) return [];
    
    // If no skill order defined, fallback to shuffle
    if (!this.skillOrder || this.skillOrder.length === 0) {
      return this.shuffleArray(questions);
    }

    // Group questions by skill
    const questionsBySkill: { [skill: string]: AIQuestion[] } = {};
    questions.forEach(q => {
      const skill = q.skill || '';
      if (!questionsBySkill[skill]) questionsBySkill[skill] = [];
      questionsBySkill[skill].push(q);
    });

    // Order by skill sequence, shuffle within each skill group
    const orderedQuestions: AIQuestion[] = [];
    this.skillOrder.forEach(skill => {
      if (questionsBySkill[skill] && questionsBySkill[skill].length > 0) {
        orderedQuestions.push(...this.shuffleArray(questionsBySkill[skill]));
        delete questionsBySkill[skill];
      }
    });

    // Append any remaining skills not in the ordered list
    Object.values(questionsBySkill).forEach(skillQuestions => {
      orderedQuestions.push(...this.shuffleArray(skillQuestions));
    });

    return orderedQuestions;
  }

  private saveShuffledOptions(): void {
    const userId = this.aiQuizService.getUserIdFromToken();
    if (!userId) return;
    localStorage.setItem(
      `aiShuffledOptions_${userId}`,
      JSON.stringify(this.shuffledOptions)
    );
  }

  private saveQuestionOrder(): void {
    const userId = this.aiQuizService.getUserIdFromToken();
    if (!userId) return;
    localStorage.setItem(`aiQuestionOrder_${userId}`, JSON.stringify(this.persistedQuestionOrder));
  }
  private restoreQuestionOrder(): void {
    try {
      const userId = this.aiQuizService.getUserIdFromToken();
      if (!userId) return;
      const s = localStorage.getItem(`aiQuestionOrder_${userId}`);
      if (s) this.persistedQuestionOrder = JSON.parse(s) || [];
    } catch { this.persistedQuestionOrder = []; }
  }

  // Deterministic shuffle helpers
  private hashString(str: string): number { let h = 0x811c9dc5; for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h + (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;} return h>>>0; }
  private rng(seed: number){ return function(){ seed|=0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed>>>15, 1|seed); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }
  private deterministicShuffle<T>(arr:T[], seedStr:string):T[]{ const rand=this.rng(this.hashString(seedStr)); for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

  private restoreShuffledOptions(): void {
    try {
      const userId = this.aiQuizService.getUserIdFromToken();
      if (!userId) return;
      const shuffled = localStorage.getItem(`aiShuffledOptions_${userId}`);
      if (shuffled) {
        this.shuffledOptions = JSON.parse(shuffled);
      }
    } catch {
      this.shuffledOptions = {};
    }
  }

  // Controls Submit button visibility per requirement:
  // - visible on last question
  // - if last question time is over, visible on second last
  // - if last and second last are over, visible on third last
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
        // When both last and second last are over, show on third last
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
