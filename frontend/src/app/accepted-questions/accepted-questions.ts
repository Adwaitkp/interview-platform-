import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Question {
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
  accepted?: boolean;
  source?: string;
  createdAt?: string;
  assignedTo?: {
    _id: string;
    name: string;
  };
  generatedBy?: {
    _id: string;
    name: string;
  };
}

@Component({
  selector: 'app-accepted-questions',
  templateUrl: './accepted-questions.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AcceptedQuestionsComponent implements OnInit {
  questions: Question[] = [];
  filteredQuestions: Question[] = [];
  loading = true;
  searchTerm = '';
  candidateNameSearch = '';
  selectedSkill = '';
  selectedLevel = '';
  selectedQuestion: Question | null = null;
  
  skills: string[] = [];
  levels: string[] = [];

  currentPage: number = 0;
  pageSize: number = 10;
  totalPages: number = 0;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadAcceptedQuestions();
  }

  async loadAcceptedQuestions(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      
      // Prepare query parameters for server-side pagination and search
      const params: any = {
        page: this.currentPage,
        limit: this.pageSize
      };
      
      if (this.searchTerm) params.search = this.searchTerm;
      if (this.selectedSkill) params.skill = this.selectedSkill;
      if (this.selectedLevel) params.level = this.selectedLevel;
      
      // Load only approved AI questions with pagination and search
      const response = await this.http.get<any>(`${environment.apiUrl}/accepted-questions`, { 
        headers,
        params
      }).toPromise();

      this.questions = (response.questions || []).map((q: any) => ({ ...q, source: 'AI' }));
      this.filteredQuestions = this.questions;
      this.totalPages = response.totalPages;
      this.currentPage = response.currentPage;
      
      if (!this.skills.length || !this.levels.length) {
        this.extractSkillsAndLevels();
      }
    } catch (error) {
      console.error('Error loading accepted questions:', error);
    } finally {
      this.loading = false;
    }
  }

  async searchByCandidateName(): Promise<void> {
    // Reset page when searching by candidate name
    this.currentPage = 0;
    
    try {
      this.loading = true;
      const token = localStorage.getItem('token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      
      // Prepare query parameters
      const params: any = {
        page: this.currentPage,
        limit: this.pageSize
      };
      
      if (this.candidateNameSearch.trim()) {
        params.candidateName = this.candidateNameSearch;
      }
      
      if (this.selectedSkill) params.skill = this.selectedSkill;
      if (this.selectedLevel) params.level = this.selectedLevel;
      
      // Search by candidate name with server-side pagination
      const response = await this.http.get<any>(
        `${environment.apiUrl}/accepted-questions`, 
        { headers, params }
      ).toPromise();

      this.questions = (response.questions || []).map((q: any) => ({ ...q, source: 'AI' }));
      this.filteredQuestions = this.questions;
      this.totalPages = response.totalPages;
      this.currentPage = response.currentPage;
    } catch (error) {
      console.error('Error searching by candidate name:', error);
    } finally {
      this.loading = false;
    }
  }

  extractSkillsAndLevels(): void {
    const skillSet = new Set<string>();
    const levelSet = new Set<string>();

    this.questions.forEach(question => {
      skillSet.add(question.skill);
      levelSet.add(question.level);
    });

    this.skills = Array.from(skillSet).sort();
    this.levels = Array.from(levelSet).sort();
  }

  filterQuestions(): void {
    // Reset to first page when filtering
    this.currentPage = 0;
    // Load questions with server-side filtering
    this.loadAcceptedQuestions();
  }

  navigateToReviwe(): void {
    this.router.navigate(['/ai-questions']);
  }

  getOptionKeys(): ('a' | 'b' | 'c' | 'd')[] {
    return ['a', 'b', 'c', 'd'];
  }

  showQuestionDetails(question: Question): void {
    this.selectedQuestion = question;
  }

  closeQuestionDetails(): void {
    this.selectedQuestion = null;
  }

  get paginatedQuestions(): Question[] {
    return this.filteredQuestions;
  }

  changePage(page: number): void {
    if (page !== this.currentPage) {
      this.currentPage = page;
      this.loadAcceptedQuestions();
    }
  }

  getVisiblePages(): number[] {
    const total = this.totalPages;
    const maxVisible = 3;
    let start = Math.max(1, this.currentPage - 1);
    let end = Math.min(total - 2, this.currentPage + 1);
    if (this.currentPage <= 1) {
      end = Math.min(total - 2, maxVisible);
    }
    if (this.currentPage >= total - 2) {
      start = Math.max(1, total - maxVisible);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      if (i > 0 && i < total - 1) pages.push(i);
    }
    return pages;
  }
}