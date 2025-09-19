import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface QuizQuestion {
  _id: string;
  skill: string;
  level: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correctanswer: string;
}

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.html'
})
export class QuizComponent implements OnInit, OnDestroy {
  // UI/data
  loading: boolean = true;
  questions: QuizQuestion[] = [];
  currentQuestionIndex: number = 0;
  selectedAnswer: string = '';
  quizCompleted: boolean = false;
  isSubmitting: boolean = false;
  userAnswers: { [questionId: string]: string } = {};

  // Timer related properties
  testStarted: boolean = false;
  timer: number = 0;
  timerInterval: any = null;

  // Per-level time in seconds
  questionTimeMap: { [level: string]: number } = {
    beginner: 90,
    intermediate: 120,
    advanced: 150
  };

  // Per-question timers and locks
  questionTimers: { [key: string]: number } = {};
  lockedQuestions: { [key: string]: boolean } = {};

  shuffledOptions: { [questionId: string]: Array<{ key: string; value: string }> } = {};


  // UI helpers
  alreadyAttempted: boolean = false;
  skills: string[] = [];
  levels: string[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    // First, ask server if quiz is already completed to prevent extra attempts
    this.checkServerQuizStatus()
      .then(() => {
        if (!this.quizCompleted) {
          this.fetchAllQuestions();
        } else {
          // If already completed, stop loading and persist state
          this.loading = false;
          this.saveQuizState();
        }
      })
      .catch(() => {
        // On error, proceed to load questions so user can continue
        this.fetchAllQuestions();
      });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Namespace localStorage per user to prevent cross-candidate bleed
  private storageKey(name: string): string {
    const userId = localStorage.getItem('intervieweeId') || 'anon';
    return `${name}_${userId}`;
  }

  private fetchAllQuestions(): void {
    const userId = localStorage.getItem('intervieweeId') || '';
    const url = `${environment.apiUrl}/questions${userId ? `?userId=${userId}` : ''}`;

    // Try cache first
    const cached = localStorage.getItem(this.storageKey('cachedQuestions'));
    if (cached) {
      try {
        const qs: QuizQuestion[] = JSON.parse(cached) || [];
        this.questions = Array.isArray(qs) ? qs : [];
        this.computeSkillsAndLevels();
        this.applyPersistedOrder(); // persist-once, reuse thereafter
        this.restoreQuizState();
        this.initializeQuizAfterLoad();
        this.loading = false;
      } catch {
        // ignore cache parse errors
      }
    }

    // Always fetch fresh (server preserves admin skill order)
    this.http.get<any>(url).subscribe({
      next: (data) => {
        const questions: QuizQuestion[] = Array.isArray(data) ? data : data?.questions || [];
        this.questions = Array.isArray(questions) ? questions : [];
        localStorage.setItem(this.storageKey('cachedQuestions'), JSON.stringify(this.questions));
        this.computeSkillsAndLevels();
        this.applyPersistedOrder(); // persist-once, reuse thereafter
        this.restoreQuizState();
        this.initializeQuizAfterLoad();
        this.loading = false;
      },
      error: () => {
        // fallback to whatever is already loaded
        this.computeSkillsAndLevels();
        this.applyPersistedOrder(); // persist-once, reuse thereafter
        this.restoreQuizState();
        this.initializeQuizAfterLoad();
        this.loading = false;
      }
    });
  }

  private computeSkillsAndLevels() {
    const s = new Set<string>();
    const l = new Set<string>();
    for (const q of this.questions) {
      if (q.skill) s.add(q.skill);
      if (q.level) l.add(q.level);
    }
    this.skills = Array.from(s);
    this.levels = Array.from(l);
  }

  // Persist the order once, then always reuse it (no re-shuffle)
  private applyPersistedOrder() {
    const userId = localStorage.getItem('intervieweeId');
    if (!userId || this.questions.length === 0) return;

    const orderKey = this.storageKey('userQuestionOrder');
    const savedOrder = localStorage.getItem(orderKey);

    if (savedOrder) {
      const ids: string[] = JSON.parse(savedOrder);
      const pos = new Map(ids.map((id, i) => [id, i]));
      this.questions.sort(
        (a, b) =>
          (pos.get(a._id) ?? Number.MAX_SAFE_INTEGER) -
          (pos.get(b._id) ?? Number.MAX_SAFE_INTEGER)
      );
      return;
    }

    // No saved order yet: trust current server order (already grouped), and persist once
    localStorage.setItem(orderKey, JSON.stringify(this.questions.map((q) => q._id)));
  }

  private initializeQuizAfterLoad() {
    if (this.questions.length === 0 || this.quizCompleted) return;

    this.initTimers();

    // Resume index if present, else start at Q1 (index 0)
    const savedIndex = localStorage.getItem(this.storageKey('currentQuestionIndex'));
    let index = 0;
    if (savedIndex && !isNaN(Number(savedIndex))) {
      const num = Number(savedIndex);
      if (num >= 0 && num < this.questions.length) index = num;
    }
    this.currentQuestionIndex = index;
    this.updateSelectedAnswerForCurrentQuestion();

    // If any progress exists, resume even if testStarted was cleared on logout
    const hasProgress =
      Object.keys(this.userAnswers || {}).length > 0 ||
      Object.keys(this.questionTimers || {}).length > 0 ||
      Object.keys(this.lockedQuestions || {}).length > 0;

    const wasStarted = localStorage.getItem(this.storageKey('testStarted')) === 'true';
    const resume = wasStarted || hasProgress;

    if (resume) {
      this.testStarted = true;
      this.startTimer();
      this.autoAdvanceIfLockedOrExpired();
    } else {
      this.currentQuestionIndex = 0;
      this.updateSelectedAnswerForCurrentQuestion();
      this.startQuiz();
    }

    this.saveQuizState();
    this.cdr.detectChanges();
  }

  // Check with backend whether the user has already completed the quiz
  private async checkServerQuizStatus(): Promise<void> {
    try {
      const token = localStorage.getItem('token') || '';
      if (!token) {
        this.quizCompleted = false;
        localStorage.removeItem(this.storageKey('quizCompleted'));
        localStorage.removeItem('quizCompleted');
        return;
      }

      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/quiz/check-status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      if (res && typeof res.quizCompleted === 'boolean') {
        this.quizCompleted = res.quizCompleted;

        if (res.quizCompleted) {
          localStorage.setItem(this.storageKey('quizCompleted'), 'true');
          localStorage.setItem('quizCompleted', 'true');
          this.testStarted = false;
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
          }
        } else {
          localStorage.removeItem(this.storageKey('quizCompleted'));
          localStorage.removeItem('quizCompleted');
        }
      } else {
        this.quizCompleted = false;
        localStorage.removeItem(this.storageKey('quizCompleted'));
        localStorage.removeItem('quizCompleted');
      }
    } catch (e) {
      console.error('Failed to check server quiz status:', e);
      this.quizCompleted = false;
      localStorage.removeItem(this.storageKey('quizCompleted'));
      localStorage.removeItem('quizCompleted');
    }
  }

  startQuiz(): void {
    this.testStarted = true;
    this.quizCompleted = false;
    this.startTimer();
    this.saveQuizState();
  }

  private startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const q = this.questions[this.currentQuestionIndex];
    if (!q) return;

    const key = this.timerKey(q);
    const lvl = (q.level || '').toLowerCase();
    const defaultTime = this.questionTimeMap[lvl] ?? this.questionTimeMap['intermediate'];

    if (this.questionTimers[key] == null) {
      this.questionTimers[key] = defaultTime;
    }
    this.timer = this.questionTimers[key];

    this.timerInterval = setInterval(() => {
      if (this.timer > 0) {
        this.timer--;
        this.questionTimers[key] = this.timer;
      } else {
        this.lockedQuestions[key] = true;
        this.autoAdvanceIfLockedOrExpired();
      }
      this.saveQuizState();
    }, 1000);
  }

  private timerKey(q: QuizQuestion): string {
    return `${q._id}`;
  }

  private initTimers(): void {
    const timers = localStorage.getItem(this.storageKey('questionTimers'));
    const locks = localStorage.getItem(this.storageKey('lockedQuestions'));
    this.questionTimers = timers ? JSON.parse(timers) : {};
    this.lockedQuestions = locks ? JSON.parse(locks) : {};
  }

  private autoAdvanceIfLockedOrExpired(): void {
    const q = this.questions[this.currentQuestionIndex];
    if (!q) return;
    const key = this.timerKey(q);
    const isLocked = !!this.lockedQuestions[key];
    const hasPersistedTimer = this.questionTimers[key] != null;
    const isExpired = hasPersistedTimer && this.questionTimers[key] <= 0;

    if (isLocked || isExpired) {
      // Move to the next available unlocked question, else finish
      for (let i = 1; i <= this.questions.length; i++) {
        const next = (this.currentQuestionIndex + i) % this.questions.length;
        const nq = this.questions[next];
        const nk = this.timerKey(nq);
        if (!this.lockedQuestions[nk]) {
          this.currentQuestionIndex = next;
          this.updateSelectedAnswerForCurrentQuestion();
          this.startTimer();
          this.saveQuizState();
          return;
        }
      }
      this.completeQuiz();
    }
  }

  // Template helpers
  get currentQuestion(): QuizQuestion | undefined {
    return this.questions[this.currentQuestionIndex];
  }

  get formattedTimer(): string {
    const m = Math.floor((this.timer || 0) / 60);
    const s = (this.timer || 0) % 60;
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  getOptions(q?: QuizQuestion): Array<{ key: string; value: string }> {
    const qq = q || this.currentQuestion;
    if (!qq) return [];

    // Check if we already have shuffled options for this question
    if (this.shuffledOptions[qq._id]) {
      return this.shuffledOptions[qq._id];
    }

    // Create original options
    const { a, b, c, d } = qq.options || ({} as any);
    const originalOptions: Array<{ key: string; value: string }> = [];
    if (a != null) originalOptions.push({ key: 'a', value: a });
    if (b != null) originalOptions.push({ key: 'b', value: b });
    if (c != null) originalOptions.push({ key: 'c', value: c });
    if (d != null) originalOptions.push({ key: 'd', value: d });

    // Shuffle the options using Fisher-Yates algorithm
    const shuffled = [...originalOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Store shuffled options for this question
    this.shuffledOptions[qq._id] = shuffled;
    this.saveShuffledOptions();

    return shuffled;
  }
  private saveShuffledOptions(): void {
    localStorage.setItem(
      this.storageKey('shuffledOptions'),
      JSON.stringify(this.shuffledOptions)
    );
  }

  private restoreShuffledOptions(): void {
    try {
      const shuffled = localStorage.getItem(this.storageKey('shuffledOptions'));
      if (shuffled) {
        this.shuffledOptions = JSON.parse(shuffled);
      }
    } catch {
      // ignore parse errors
      this.shuffledOptions = {};
    }
  }
  trackByOptionKey = (_: number, item: { key: string; value: string }) => item.key;

  onAnswerSelect(optionKey: string): void {
    this.onSelectAnswer(optionKey);
  }

  onSelectAnswer(option: string): void {
    const q = this.questions[this.currentQuestionIndex];
    if (!q) return;
    this.selectedAnswer = option;
    this.userAnswers[q._id] = option;
    this.saveQuizState();
  }

  prevQuestion(): void {
    this.goPrev();
  }

  nextQuestion(): void {
    this.goNext();
  }

  goNext(): void {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateSelectedAnswerForCurrentQuestion();
      this.startTimer();
      this.saveQuizState();
    }
  }

  goPrev(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.updateSelectedAnswerForCurrentQuestion();
      this.startTimer();
      this.saveQuizState();
    }
  }

  submitAnswer(): void {
    const q = this.questions[this.currentQuestionIndex];
    if (!q) return;
    const key = this.timerKey(q);
    this.lockedQuestions[key] = true;
    this.saveQuizState();
    this.autoAdvanceIfLockedOrExpired();
  }

  submitQuiz(): void {
    if (this.isSubmitting || this.quizCompleted) return;
    this.isSubmitting = true;

    const userId = localStorage.getItem('intervieweeId') || '';
    if (!userId) {
      alert('User not identified. Please log in again.');
      this.isSubmitting = false;
      return;
    }

    // Build detailed responses expected by backend Result model
    const questionResponses = this.questions.map((q) => {
      const userAnswer = this.userAnswers[q._id] || '';
      const correct = (q.correctanswer || '').toString();
      return {
        questionId: q._id,
        question: q.question,
        skill: q.skill,
        level: q.level,
        userAnswer: userAnswer,
        correctanswer: correct,
        isCorrect: userAnswer !== '' && userAnswer === correct,
        options: {
          a: q.options?.a ?? '',
          b: q.options?.b ?? '',
          c: q.options?.c ?? '',
          d: q.options?.d ?? '',
        },
      } as any;
    });

    const payload = { userId, questionResponses } as any;

    this.http.post(`${environment.apiUrl}/quiz/submit`, payload).subscribe({
      next: (_res: any) => {
        // Mark completed locally; backend updates user.quizCompleted
        this.completeQuiz();
        this.isSubmitting = false;

      },
      error: (err) => {
        console.error('Error submitting quiz:', err);
        this.isSubmitting = false;
        alert('Failed to submit quiz. Please try again.');
      },
    });
  }

  private completeQuiz(): void {
    this.quizCompleted = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.saveQuizState();
  }

  private updateSelectedAnswerForCurrentQuestion(): void {
    const q = this.questions[this.currentQuestionIndex];
    this.selectedAnswer = q ? this.userAnswers[q._id] || '' : '';
  }

  private resetQuizState(): void {
    this.testStarted = false;
    this.quizCompleted = false;
    this.timer = 0;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.questionTimers = {};
    this.lockedQuestions = {};
    this.userAnswers = {};
    this.shuffledOptions = {};
    localStorage.removeItem(this.storageKey('questionTimers'));
    localStorage.removeItem(this.storageKey('lockedQuestions'));
    localStorage.removeItem(this.storageKey('userAnswers'));
    localStorage.removeItem(this.storageKey('shuffledOptions'));
    localStorage.removeItem(this.storageKey('quizCompleted'));
    // Do NOT remove 'userQuestionOrder' so order persists across logout/login
  }

  private saveQuizState(): void {
    localStorage.setItem(
      this.storageKey('questionTimers'),
      JSON.stringify(this.questionTimers)
    );
    localStorage.setItem(
      this.storageKey('lockedQuestions'),
      JSON.stringify(this.lockedQuestions)
    );
    localStorage.setItem(
      this.storageKey('userAnswers'),
      JSON.stringify(this.userAnswers)
    );
    localStorage.setItem(
      this.storageKey('currentQuestionIndex'),
      this.currentQuestionIndex.toString()
    );
    localStorage.setItem(this.storageKey('testStarted'), this.testStarted.toString());
    localStorage.setItem(this.storageKey('quizCompleted'), this.quizCompleted.toString());

    // Save shuffled options
    this.saveShuffledOptions();

    // ALSO save without user suffix for cross-login persistence
    if (this.quizCompleted) {
      localStorage.setItem('quizCompleted', 'true');
    }
  }
  private restoreQuizState(): void {
  try {
    const answers = localStorage.getItem(this.storageKey('userAnswers'));
    if (answers) this.userAnswers = JSON.parse(answers);

    const idx = localStorage.getItem(this.storageKey('currentQuestionIndex'));
    if (idx && !isNaN(Number(idx))) this.currentQuestionIndex = Number(idx);

    const ts = localStorage.getItem(this.storageKey('testStarted'));
    if (ts) this.testStarted = ts === 'true';

    // Don't restore completion status from localStorage
    // Let checkServerQuizStatus() be the authoritative source
    
    // Restore shuffled options
    this.restoreShuffledOptions();
  } catch {
    // ignore parse errors
  }
}
}
