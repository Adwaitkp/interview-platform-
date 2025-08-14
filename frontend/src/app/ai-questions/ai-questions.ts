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
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctanswer: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  source: string;
  assignedTo?: string;
  generatedBy: string;
  questionCount: number;
  createdAt: string;
}

@Component({
  selector: 'app-ai-questions',
  templateUrl: './ai-questions.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AIQuestionsComponent implements OnInit {
  questions: AIQuestion[] = [];
  allQuestions: AIQuestion[] = []; // Store all questions for filtering
  loading: boolean = true;
  statusFilter: string = '';
  skillFilter: string = '';
  levelFilter: string = '';
  searchTerm: string = ''; // Added searchTerm property
  availableSkills: string[] = [];
  availableLevels: string[] = [];
  processingQuestions: Set<string> = new Set();
  selectedQuestion: AIQuestion | null = null;
  isBulkProcessing: boolean = false;
  deleteQuestionId: string | null = null;
  showApproveAllModal: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadQuestions();
  }

  async loadQuestions(): Promise<void> {
    this.loading = true;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      
      // Build query parameters - exclude approved questions by default
      const params: any = {};
      if (this.statusFilter) {
        params.reviewStatus = this.statusFilter;
      } else {
        // If no status filter is applied, exclude approved questions
        params.excludeApproved = 'true';
      }
      if (this.skillFilter) params.skill = this.skillFilter;
      if (this.levelFilter) params.level = this.levelFilter;

      const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

      const url = `${environment.apiUrl}/ai-quiz/all-ai-questions${queryString ? '?' + queryString : ''}`;
      
      const questions = await firstValueFrom(
        this.http.get<AIQuestion[]>(url, { headers })
      );

      this.allQuestions = questions; // Store all questions
      this.filterQuestions(); // Apply any existing filters
      
      // Extract unique skills and levels for filter dropdowns
      const skills = new Set(questions.map(q => q.skill));
      this.availableSkills = Array.from(skills).sort();
      
      const levels = new Set(questions.map(q => q.level));
      this.availableLevels = Array.from(levels).sort();

    } catch (error) {
      console.error('Error loading AI questions:', error);
    } finally {
      this.loading = false;
    }
  }

  // Added filterQuestions method
  filterQuestions(): void {
    let filtered = [...this.allQuestions];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(q => 
        q.question.toLowerCase().includes(searchLower) ||
        q.skill.toLowerCase().includes(searchLower) ||
        q.level.toLowerCase().includes(searchLower) ||
        q.correctanswer.toLowerCase().includes(searchLower)
      );
    }

    this.questions = filtered;
  }

  showApproveAllConfirmation(): void {
    this.showApproveAllModal = true;
  }

  async approveQuestion(questionId: string): Promise<void> {
    this.processingQuestions.add(questionId);
    
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      
      // Get the question
      const question = this.questions.find(q => q._id === questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      // Use the existing assignedTo if available, otherwise use generatedBy
      const assignTo = question.assignedTo || question.generatedBy;

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/ai-quiz/approve-ai-question`, 
          { 
            questionId,
            assignedTo: assignTo // Use existing assignment or fall back to generatedBy
          }, 
          { headers }
        )
      );

      // Remove the approved question from both arrays
      this.questions = this.questions.filter(q => q._id !== questionId);
      this.allQuestions = this.allQuestions.filter(q => q._id !== questionId);

    } catch (error) {
      console.error('Error approving question:', error);
      alert('Failed to approve question. Please try again.');
    } finally {
      this.processingQuestions.delete(questionId);
    }
  }

  showDeleteConfirmation(questionId: string): void {
    this.deleteQuestionId = questionId;
  }

  cancelDelete(): void {
    this.deleteQuestionId = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.deleteQuestionId) return;

    this.processingQuestions.add(this.deleteQuestionId);
    
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/ai-quiz/delete-ai-question/${this.deleteQuestionId}`, { headers })
      );

      // Remove the question from both arrays
      this.questions = this.questions.filter(q => q._id !== this.deleteQuestionId);
      this.allQuestions = this.allQuestions.filter(q => q._id !== this.deleteQuestionId);
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
      
      // Create an array of promises for all approval requests
      const approvalPromises = this.questions.map(async (question) => {
        try {
          await firstValueFrom(
            this.http.post(`${environment.apiUrl}/ai-quiz/approve-ai-question`, 
              { 
                questionId: question._id,
                assignedTo: question.generatedBy
              }, 
              { headers }
            )
          );
          return { success: true, questionId: question._id };
        } catch (error) {
          console.error(`Error approving question ${question._id}:`, error);
          return { success: false, questionId: question._id, error };
        }
      });

      // Wait for all approvals to complete
      const results = await Promise.all(approvalPromises);
      
      // Count successes and failures
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      // Clear all questions from both arrays since they should no longer appear
      this.questions = [];
      this.allQuestions = [];
      
      // Show results to user
      // if (failed === 0) {
      //   alert(`Successfully approved all ${successful} questions!`);
      // } else {
      //   alert(`Approved ${successful} questions. ${failed} questions failed to approve.`);
      // }

    } catch (error) {
      console.error('Error in bulk approval:', error);
      alert('Failed to approve all questions. Please try again.');
    } finally {
      this.isBulkProcessing = false;
    }
  }

  isProcessing(questionId: string): boolean {
    return this.processingQuestions.has(questionId);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  navigateToAITestMode(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  getOptionText(question: AIQuestion, option: string): string {
    return question.options[option as keyof typeof question.options] || '';
  }

  goBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  navigateToAcceptedQuestions(): void {
    this.router.navigate(['/accepted-questions']);
  }

  showQuestionDetails(question: AIQuestion): void {
    this.selectedQuestion = question;
  }

  closeQuestionDetails(): void {
    this.selectedQuestion = null;
  }

  handleApproveAllModalAction(approve: boolean): void {
    this.showApproveAllModal = false;
    if (approve) {
      this.approveAllQuestions();
    }
  }
}