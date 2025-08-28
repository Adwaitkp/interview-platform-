import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { QuizResult, User, QuestionResponse } from '../models/admin.models';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AdminDashboardComponent implements OnInit {
  results: QuizResult[] = [];
  users: User[] = [];
  loading = true;
  searchTerm = '';
  selectedResult: QuizResult | null = null;
  isQuestionDetailsVisible = false;
  selectedSkillLevel: string = '';
  resettingQuizIds: Set<string> = new Set();

  // AI Summary Modal properties
  showAISummaryModal: boolean = false;
  selectedAIResult: QuizResult | null = null;

  // AI Questions Modal properties
  showAIQuizQuestionsModal: boolean = false;
  selectedAIQuizQuestions: any[] = [];

  // Normal Quiz Questions Modal properties
  showNormalQuizQuestionsModal: boolean = false;
  selectedNormalQuizQuestions: any[] = [];
  selectedNormalQuizSkillLevel: string = '';

  // Retest Modal properties
  showRetestModal: boolean = false;
  selectedRetestResult: QuizResult | null = null;

  currentPage: number = 0;
  pageSize: number = 10;

  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Server-side filtering is now handled by the API
  get filteredResults(): QuizResult[] {
    return this.results;
  }

  // Server-side pagination is now handled by the API
  get paginatedResults(): QuizResult[] {
    return this.filteredResults;
  }

  totalPages: number = 0;
  totalResults: number = 0;

  getVisiblePages(): number[] {
    if (this.totalPages <= 2) {
      return [];
    }

    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 1);
    const end = Math.min(this.totalPages - 1, this.currentPage + 2);
    
    for (let i = start; i < end; i++) {
      if (i !== 0 && i !== this.totalPages - 1) {
        pages.push(i);
      }
    }
    return pages;
  }

  changePage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    // Reset sorting when changing pages
    this.sortField = '';
    this.sortDirection = 'asc';
    this.loadResults();
  }

  constructor(private adminService: AdminService, private router: Router) { }

  async ngOnInit(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    // Load users first, then load results
    try {
      await this.loadUsers();
      console.log('Users loaded:', this.users.length); // Debug log
      this.loadResults();
    } catch (error) {
      console.error('Error loading users:', error);
      this.loadResults(); // Still try to load results
    }
  }

  async loadUsers(): Promise<void> {
    try {
      this.users = await this.adminService.getUsers();
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async loadResults(): Promise<void> {
    this.loading = true;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get all results from both APIs with a large limit to get total counts
      const [quizData, aiData] = await Promise.all([
        this.adminService.getResults(0, 1000, this.searchTerm), // Get all to calculate proper pagination
        this.adminService.getAIResults(0, 1000, this.searchTerm)
      ]);

      const { quizResults, totalResults: quizTotalResults } = quizData;
      const { aiResults, totalResults: aiTotalResults } = aiData;

      const allCombinedResults: QuizResult[] = [];

      // 1) add regular quiz results and ensure quizDate is set
      quizResults.forEach((result: any) => {
        const user = this.users.find(u => u.email === result.email);
        allCombinedResults.push({
          ...result,
          quizDate: result.quizDate || result.createdAt || null,
          userId: user?._id || result.userId || '',
          aiScore: undefined
        });
      });

      // 2) Add all AI results as separate entries (each retest gets its own row)
      aiResults.forEach((aiResult: any) => {
        const user = this.users.find(u => u.email === aiResult.email);
        allCombinedResults.push({
          _id: aiResult._id,
          name: aiResult.name,
          email: aiResult.email,
          totalMarks: 0,
          totalQuestions: 0,
          overallPercentage: 0,
          skillResults: [],
          quizDate: aiResult.quizDate || aiResult.createdAt || null,
          userId: user?._id || aiResult.userId || '',
          aiScore: {
            totalMarks: aiResult.totalMarks,
            totalQuestions: aiResult.totalQuestions,
            overallPercentage: aiResult.overallPercentage,
            skillLevelSummaries: aiResult.skillResults?.map((s: any) => ({
              skill: s.skill,
              level: s.level,
              totalQuestions: s.totalQuestions,
              correctAnswers: s.correctAnswers
            }))
          }
        });
      });

      // Sort all combined results by date (newest first)
      allCombinedResults.sort((a, b) => {
        const dateA = new Date(a.quizDate || 0).getTime();
        const dateB = new Date(b.quizDate || 0).getTime();
        return dateB - dateA;
      });

      // Calculate pagination
      this.totalResults = allCombinedResults.length;
      this.totalPages = Math.ceil(this.totalResults / this.pageSize);

      // Apply client-side pagination to get exactly 10 results for current page
      const startIndex = this.currentPage * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      this.results = allCombinedResults.slice(startIndex, endIndex);

      this.loading = false;
    } catch (err) {
      console.error('❌ Error fetching data:', err);
      this.loading = false;
    }
  }

  showSkillDetails(result: QuizResult) {
    this.selectedResult = result;
    this.isQuestionDetailsVisible = false;
    // If this is an AI-only result (no regular quiz results), show AI details instead
    if ((result.totalQuestions === 0 || !result.skillResults || result.skillResults.length === 0) && result.aiScore) {
      this.showAISkillDetails(result);
    }
  }

  async showQuestionDetails(result: QuizResult, skillLevel: string) {
    this.selectedSkillLevel = skillLevel;
    // If we don't have question responses, fetch them
    if (!result.questionResponses) {
      try {
        const detailedResult = await this.adminService.getDetailedResult(result._id);
        if (detailedResult) {
          result.questionResponses = detailedResult.questionResponses;
        }
      } catch (error) {
        console.error('Error fetching question details:', error);
      }
    }
    this.isQuestionDetailsVisible = true;
  }

  getQuestionsForSkillLevel(result: QuizResult, skill: string, level: string): QuestionResponse[] {
    if (!result.questionResponses) return [];
    return result.questionResponses.filter(q => q.skill === skill && q.level === level);
  }

  closeSkillDetails() {
    this.selectedResult = null;
    this.isQuestionDetailsVisible = false;
    this.selectedSkillLevel = '';
  }

  getOptionText(question: QuestionResponse, option: string): string {
    return question.options[option as keyof typeof question.options] || '';
  }

  async search(): Promise<void> {
    this.currentPage = 0;
    // Reset sorting when searching
    this.sortField = '';
    this.sortDirection = 'asc';
    this.loadResults();
  }

  async resetQuiz(result: QuizResult): Promise<void> {
    // Ensure we have a userId to reset the quiz
    if (!result.userId) {
      const user = this.users.find(u => u.email === result.email);
      if (user) {
        result.userId = user._id;
      } else {
        console.error('No user found for email:', result.email);
        alert('User ID not found. Cannot reset quiz.');
        return;
      }
    }

    // Show retest confirmation modal instead of browser confirm
    this.selectedRetestResult = result;
    this.showRetestModal = true;
  }

  isResettingQuiz(userId: string): boolean {
    return this.resettingQuizIds.has(userId);
  }

  // Retest Modal methods
  async handleRetestModalAction(confirm: boolean): Promise<void> {
    this.showRetestModal = false;

    if (confirm && this.selectedRetestResult) {
      const result = this.selectedRetestResult;
      this.resettingQuizIds.add(result.userId!);

      try {
        await this.adminService.retestUser(result.userId!);

        this.loadResults();
      } catch (error) {
        console.error('Error resetting quiz:', error);
        alert('Failed to reset quiz. Please try again.');
      } finally {
        this.resettingQuizIds.delete(result.userId!);
      }
    }

    this.selectedRetestResult = null;
  }

  // AI Summary Modal methods
  showAISkillDetails(result: QuizResult): void {
    this.selectedAIResult = result;
    this.showAISummaryModal = true;
  }

  closeAISummaryModal(): void {
    this.showAISummaryModal = false;
    this.selectedAIResult = null;
  }

  // AI Questions Modal methods
  async viewAIQuestions(result: QuizResult, skill: string, level: string): Promise<void> {
    try {
      const questionResponses = await this.adminService.getAIQuestionsForUser(result.email);
      if (questionResponses) {
        this.selectedAIQuizQuestions = questionResponses.filter(
          (q: any) => q.skill === skill && q.level === level
        );
      } else {
        this.selectedAIQuizQuestions = [];
      }

      this.showAIQuizQuestionsModal = true;
    } catch (error) {
      console.error('Error fetching AI quiz results:', error);
      this.selectedAIQuizQuestions = [];
      this.showAIQuizQuestionsModal = true;
    }
  }

  closeAIQuizQuestionsModal(): void {
    this.showAIQuizQuestionsModal = false;
    this.selectedAIQuizQuestions = [];
  }

  // Normal Quiz Questions Modal methods
  async viewNormalQuizQuestions(result: QuizResult, skillLevel: string): Promise<void> {
    this.selectedNormalQuizSkillLevel = skillLevel;
    // If we don't have question responses, fetch them
    if (!result.questionResponses) {
      try {
        const detailedResult = await this.adminService.getDetailedResult(result._id);
        if (detailedResult) {
          result.questionResponses = detailedResult.questionResponses;
        }
      } catch (error) {
        console.error('Error fetching question details:', error);
      }
    }

    this.selectedNormalQuizQuestions = this.getQuestionsForSkillLevel(result, skillLevel.split('-')[0], skillLevel.split('-')[1]);
    this.showNormalQuizQuestionsModal = true;
  }

  closeNormalQuizQuestionsModal(): void {
    this.showNormalQuizQuestionsModal = false;
    this.selectedNormalQuizQuestions = [];
    this.selectedNormalQuizSkillLevel = '';
  }

  getOptionKeys(): ('a' | 'b' | 'c' | 'd')[] {
    return ['a', 'b', 'c', 'd'];
  }
  sortResults(field: string): void {
    if (this.sortField === field) {
      // Toggle direction if same field
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to ascending
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    // Sort the current page results
    this.results.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (field) {
        case 'name':
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
          break;
        case 'email':
          valueA = a.email?.toLowerCase() || '';
          valueB = b.email?.toLowerCase() || '';
          break;
        case 'date':
          valueA = a.quizDate ? new Date(a.quizDate).getTime() : 0;
          valueB = b.quizDate ? new Date(b.quizDate).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return '↕'; // Default sort icon
    }
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }
}
