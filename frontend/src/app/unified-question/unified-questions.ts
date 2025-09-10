import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface AIQuestion {
  _id: string;
  skill: string;
  level: string;
  question: string;
  options: { a: string; b: string; c: string; d: string; };
  correctanswer: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  source: string;
  assignedTo?: { _id: string; name: string; }; // Remove | string
  generatedBy?: { _id: string; name: string; }; // Remove | string
  questionCount: number;
  createdAt: string;
  setid?: string;
}

interface AcceptedQuestion {
  _id: string;
  skill: string;
  level: string;
  question: string;
  options: { a: string; b: string; c: string; d: string; };
  correctanswer: string;
  accepted?: boolean;
  source?: string;
  createdAt?: string;
  assignedTo?: { _id: string; name: string; };
  setid?: string;
  generatedBy?: { _id: string; name: string; };
}

interface SetOption {
  number: number;
  displayName: string;
}

@Component({
  selector: 'app-unified-questions',
  templateUrl: './unified-questions.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class UnifiedQuestionsComponent implements OnInit {
  // AI Questions (pending review)
  aiQuestions: AIQuestion[] = [];
  // Accepted Questions
  acceptedQuestions: AcceptedQuestion[] = [];
  allQuestionsForSetMapping: AcceptedQuestion[] = [];
  setLabelMappings: Map<string, string> = new Map();

  // Common properties
  loading = true;
  searchTerm = '';
  candidateNameSearch = '';

  selectedSkill = '';
  selectedLevel = '';
  selectedSetNumber = '';

  // Pagination for both sections
  aiCurrentPage = 0;
  aiPageSize = 10;
  aiTotalPages = 0;
  acceptedCurrentPage = 0;
  acceptedPageSize = 10;
  acceptedTotalPages = 0;

  // Filter options
  skills: string[] = ['Node.js', 'React', 'Angular', 'MongoDB', 'PostgreSQL', 'Next.js', 'Django', 'Git', 'Docker', 'TypeScript'];
  levels: string[] = ['beginner', 'intermediate', 'advanced'];
  setOptions: SetOption[] = [];

  // UI state
  selectedQuestion: AIQuestion | AcceptedQuestion | null = null;
  processingQuestions: Set<string> = new Set();
  deleteQuestionId: string | null = null;
  showApproveAllModal: boolean = false;
  isBulkProcessing: boolean = false;

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.loadAllData();
  }

  async loadAllData(): Promise<void> {
    this.loading = true;
    await Promise.all([
      this.loadSetLabelMappings(),
      this.loadAllQuestionsForSetMapping(),
      this.loadAIQuestions(),
      this.loadAcceptedQuestions()
    ]);
    // Update set options after all data is loaded
    this.updateSetOptions();
    this.loading = false;
  }

  // AI Questions methods
  async loadAIQuestions(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const params: any = {
        page: this.aiCurrentPage,
        limit: this.aiPageSize,
        excludeApproved: 'true'
      };

      if (this.searchTerm.trim()) params.search = this.searchTerm;
      if (this.selectedSkill) params.skill = this.selectedSkill;
      if (this.selectedLevel) params.level = this.selectedLevel;
      if (this.candidateNameSearch.trim()) params.candidateName = this.candidateNameSearch;
      if (this.selectedSetNumber) params.setNumber = this.selectedSetNumber;


      const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

      const url = `${environment.apiUrl}/ai-quiz/all-ai-questions${queryString ? '?' + queryString : ''}`;


      const response: any = await firstValueFrom(this.http.get(url, { headers }));



      // Handle both old and new response formats
      if (response.questions) {
        // New format with pagination
        this.aiQuestions = response.questions;
        this.aiTotalPages = response.totalPages || 0;
      } else {
        // Old format (array) - for set mapping
        this.aiQuestions = response || [];
        this.aiTotalPages = Math.ceil(this.aiQuestions.length / this.aiPageSize);
      }

    } catch (error) {
      console.error('Error loading AI questions:', error);
    }
  }

  // Accepted Questions methods
  async loadAllQuestionsForSetMapping(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      // Load accepted questions
      const acceptedParams: any = { page: 0, limit: 10000 };
      const acceptedResponse: any = await this.http.get(`${environment.apiUrl}/accepted-questions`, {
        headers, params: acceptedParams
      }).toPromise();

      // Load AI questions (including pending ones)
      const aiParams: any = { page: 0, limit: 10000 };
      const aiResponse: any = await this.http.get(`${environment.apiUrl}/ai-quiz/all-ai-questions`, {
        headers, params: aiParams
      }).toPromise();

      // Combine both arrays for set mapping
      const acceptedQuestions = (acceptedResponse?.questions || []).map((q: any) => ({ ...q, source: 'Accepted' }));
      const aiQuestionsArray: any[] = Array.isArray(aiResponse) ? aiResponse : (aiResponse?.questions || []);
      const aiQuestions = aiQuestionsArray.map((q: any) => ({ ...q, source: 'AI' }));

      this.allQuestionsForSetMapping = [...acceptedQuestions, ...aiQuestions];
      this.updateSetOptions();
    } catch (error) {
      console.error('Error loading all questions for set mapping:', error);
    }
  }

  async loadAcceptedQuestions(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      const params: any = {
        page: this.acceptedCurrentPage,
        limit: this.acceptedPageSize
      };

      if (this.searchTerm) params.search = this.searchTerm;
      if (this.candidateNameSearch.trim()) params.candidateName = this.candidateNameSearch;
      if (this.selectedSkill) params.skill = this.selectedSkill;
      if (this.selectedLevel) params.level = this.selectedLevel;
      if (this.selectedSetNumber) params.setNumber = this.selectedSetNumber;

      const response: any = await this.http.get(`${environment.apiUrl}/accepted-questions`, {
        headers, params
      }).toPromise();

      this.acceptedQuestions = (response?.questions || []).map((q: any) => ({ ...q, source: 'AI' }));
      this.acceptedTotalPages = response?.totalPages || 0;
      this.acceptedCurrentPage = response?.currentPage || 0;
    } catch (error) {
      console.error('Error loading accepted questions:', error);
    }
  }

  private resolveUserIdToName(userId: string): string {
    if (userId && !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return userId;
    }
    return userId || 'Unknown User';
  }

  updateSetOptions(): void {
    // Simple set options based on available sets
    this.setOptions = [];
    for (let i = 1; i <= 10; i++) {
      this.setOptions.push({ number: i, displayName: `Set ${i}` });
    }
  }

  // Filter and search methods - FIXED
  filterQuestions(): void {
    console.log('=== Filter Questions Called ===');
    console.log('selectedSetNumber before:', this.selectedSetNumber);

    this.aiCurrentPage = 0;
    this.acceptedCurrentPage = 0;

    this.loadAllData();
  }

  onSearch(): void {
    this.aiCurrentPage = 0;
    this.acceptedCurrentPage = 0;
    this.loadAllData();
  }

  async searchByCandidateName(): Promise<void> {
    this.aiCurrentPage = 0;
    this.acceptedCurrentPage = 0;
    await this.loadAIQuestions();
    await this.loadAcceptedQuestions();
  }

  // Add a method to clear all filters
  clearAllFilters(): void {
    this.searchTerm = '';
    this.candidateNameSearch = '';
    this.selectedSkill = '';
    this.selectedLevel = '';
    this.selectedSetNumber = '';
    this.aiCurrentPage = 0;
    this.acceptedCurrentPage = 0;
    this.loadAllData();
  }

  // AI Questions actions
  async approveQuestion(questionId: string): Promise<void> {
    this.processingQuestions.add(questionId);
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const question = this.aiQuestions.find(q => q._id === questionId);
      if (!question) throw new Error('Question not found');

      const assignTo = question.assignedTo || question.generatedBy;
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/ai-quiz/approve-ai-question`, {
          questionId,
          assignedTo: assignTo
        }, { headers })
      );

      this.aiQuestions = this.aiQuestions.filter(q => q._id !== questionId);
      this.updateSetOptions();
      await this.loadAllQuestionsForSetMapping();
      await this.loadAcceptedQuestions();
    } catch (error) {
      console.error('Error approving question:', error);
      alert('Failed to approve question. Please try again.');
    } finally {
      this.processingQuestions.delete(questionId);
    }
  }

  async deleteQuestion(): Promise<void> {
    if (!this.deleteQuestionId) return;

    this.processingQuestions.add(this.deleteQuestionId);
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/ai-quiz/delete-ai-question/${this.deleteQuestionId}`, { headers })
      );

      this.aiQuestions = this.aiQuestions.filter(q => q._id !== this.deleteQuestionId);
      this.deleteQuestionId = null;
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question. Please try again.');
    } finally {
      if (this.deleteQuestionId) {
        this.processingQuestions.delete(this.deleteQuestionId);
      }
    }
  }

  async approveAllQuestions(): Promise<void> {
    this.isBulkProcessing = true;
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

      const approvalPromises = this.aiQuestions.map(async (question) => {
        try {
          await firstValueFrom(
            this.http.post(`${environment.apiUrl}/ai-quiz/approve-ai-question`, {
              questionId: question._id,
              assignedTo: question.generatedBy
            }, { headers })
          );
          return { success: true, questionId: question._id };
        } catch (error) {
          console.error(`Error approving question ${question._id}:`, error);
          return { success: false, questionId: question._id, error };
        }
      });

      await Promise.all(approvalPromises);
      this.aiQuestions = [];
      await this.loadAllQuestionsForSetMapping();
      await this.loadAcceptedQuestions();
    } catch (error) {
      console.error('Error in bulk approval:', error);
      alert('Failed to approve all questions. Please try again.');
    } finally {
      this.isBulkProcessing = false;
    }
  }

  // Pagination methods
  changeAIPage(page: number): void {
    if (page !== this.aiCurrentPage) {
      this.aiCurrentPage = page;
      this.loadAIQuestions();
    }
  }

  changeAcceptedPage(page: number): void {
    if (page !== this.acceptedCurrentPage) {
      this.acceptedCurrentPage = page;
      this.loadAcceptedQuestions();
    }
  }

  getVisiblePages(currentPage: number, totalPages: number): number[] {
    const maxVisible = 3;
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages - 2, currentPage + 1);

    if (currentPage <= 1) {
      end = Math.min(totalPages - 2, maxVisible);
    }

    if (currentPage >= totalPages - 2) {
      start = Math.max(1, totalPages - maxVisible);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      if (i > 0 && i < totalPages - 1) pages.push(i);
    }

    return pages;
  }

  // Utility methods
  async loadSetLabelMappings(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      
      // Get all users to build set label mappings
      const response: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/admin/users?page=0&limit=10000`, { headers })
      );
      
      const users = response.users || [];
      this.setLabelMappings.clear();
      
      users.forEach((user: any) => {
        if (user.userSpecificSets && Array.isArray(user.userSpecificSets)) {
          user.userSpecificSets.forEach((userSet: any) => {
            this.setLabelMappings.set(userSet.setId, userSet.label);
          });
        }
      });
    } catch (error) {
      console.error('Error loading set label mappings:', error);
    }
  }

  getSetDisplayName(setid: string | undefined, candidateName?: string): string {
    if (!setid) return 'N/A';
    return this.setLabelMappings.get(setid) || 'Unknown Set';
  }

  showQuestionDetails(question: AIQuestion | AcceptedQuestion): void {
    this.selectedQuestion = question;
  }

  closeQuestionDetails(): void {
    this.selectedQuestion = null;
  }

  showDeleteConfirmation(questionId: string): void {
    this.deleteQuestionId = questionId;
  }

  cancelDelete(): void {
    this.deleteQuestionId = null;
  }

  showApproveAllConfirmation(): void {
    this.showApproveAllModal = true;
  }

  handleApproveAllModalAction(approve: boolean): void {
    this.showApproveAllModal = false;
    if (approve) {
      this.approveAllQuestions();
    }
  }

  isProcessing(questionId: string): boolean {
    return this.processingQuestions.has(questionId);
  }

  getOptionKeys(): ('a' | 'b' | 'c' | 'd')[] {
    return ['a', 'b', 'c', 'd'];
  }

  getOptionText(question: AIQuestion | AcceptedQuestion, option: string): string {
    return question.options[option as keyof typeof question.options] || '';
  }

  goBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  trackByFn(index: number, item: any): any {
    return item._id;
  }
}