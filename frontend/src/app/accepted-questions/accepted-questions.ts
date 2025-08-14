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
      
      // Load only approved AI questions
      const aiQuestions = await this.http.get<Question[]>(`${environment.apiUrl}/accepted-questions`, { headers }).toPromise();

      this.questions = (aiQuestions || []).map(q => ({ ...q, source: 'AI' }));

      this.extractSkillsAndLevels();
      this.filterQuestions();
    } catch (error) {
      console.error('Error loading accepted questions:', error);
    } finally {
      this.loading = false;
    }
  }

  async searchByCandidateName(): Promise<void> {
    if (!this.candidateNameSearch.trim()) {
      // If search is empty, load all questions
      this.loadAcceptedQuestions();
      return;
    }

    try {
      this.loading = true;
      const token = localStorage.getItem('token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      
      // Search by candidate name
      const aiQuestions = await this.http.get<Question[]>(
        `${environment.apiUrl}/accepted-questions?candidateName=${encodeURIComponent(this.candidateNameSearch)}`, 
        { headers }
      ).toPromise();

      this.questions = (aiQuestions || []).map(q => ({ ...q, source: 'AI' }));
      this.filterQuestions();
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
    this.filteredQuestions = this.questions.filter(question => {
      const matchesSearch = !this.searchTerm || 
        question.question.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        question.skill.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        question.level.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesSkill = !this.selectedSkill || question.skill === this.selectedSkill;
      const matchesLevel = !this.selectedLevel || question.level === this.selectedLevel;

      return matchesSearch && matchesSkill && matchesLevel;
    });
    
    // Reset to first page when filtering
    this.currentPage = 0;
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
    const start = this.currentPage * this.pageSize;
    return this.filteredQuestions.slice(start, start + this.pageSize);
  }

  totalPagesArray(): number[] {
    return Array(Math.ceil(this.filteredQuestions.length / this.pageSize)).fill(0).map((x, i) => i);
  }

  getVisiblePages(): number[] {
    const total = this.totalPagesArray().length;
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