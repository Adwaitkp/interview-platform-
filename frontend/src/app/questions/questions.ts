// questions.ts - Updated TypeScript component
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

export interface Question {
  _id: string;
  skill: string;
  level: string;
  question: string;
  type: 'single' | 'multiple' | 'truefalse';
  options: { a: string; b: string; c: string; d: string };
  correctanswer: string;
  accepted?: boolean;
}

@Component({
  selector: 'app-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './questions.html'
})
export class QuestionsComponent implements OnInit {
  filteredQuestions: Question[] = [];
  allQuestions: Question[] = [];
  selectedSkill = '';
  selectedLevel = '';
  showAddForm = false;
  isEdit = false;
  loading = false;

  searchTerm: string = '';
  currentPage: number = 0;
  pageSize: number = 10;
  totalPages: number = 0;

  skills: string[] = ['Node.js', 'React', 'Angular', 'MongoDB', 'PostgreSQL', 'Next.js', 'Django', 'Git', 'Docker', 'TypeScript'];

  levels = ['beginner', 'intermediate', 'advanced'];
  types = [
    { value: 'single', label: 'Single Choice' },
    { value: 'multiple', label: 'Multiple Choice' },
    { value: 'truefalse', label: 'True/False' }
  ];
  predefinedSkills: string[] = ['Node.js', 'React', 'Angular', 'MongoDB', 'PostgreSQL', 'Next.js', 'Django', 'Git', 'Docker', 'TypeScript'];

  form: Omit<Question, '_id'> & { _id?: string } = {
    skill: '',
    level: '',
    question: '',
    type: 'single',
    options: { a: '', b: '', c: '', d: '' },
    correctanswer: ''
  };

  showOptionsModal = false;
  optionsQuestionText = '';
  optionsToShow: { key: string; value: string }[] = [];
  optionsCorrectAnswer = '';

  // Delete confirmation modal properties
  deleteQuestionId: string | null = null;

  private apiUrl = `${environment.apiUrl}/questions`;

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.loading = true;
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchTerm
    };

    if (this.selectedSkill) params.skill = this.selectedSkill;
    if (this.selectedLevel) params.level = this.selectedLevel;

    this.http.get<any>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.allQuestions = response.questions;
        this.filteredQuestions = response.questions;
        this.currentPage = response.currentPage;
        this.totalPages = response.totalPages;
        // this.extractSkills();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load questions:', error);
        this.loading = false;
      }
    });
  }

  // extractSkills(): void {
  //   const skillSet = new Set(this.allQuestions.map(q => q.skill));
  //   this.skills = Array.from(skillSet).sort();
  // }

  filterQuestions(): void {
    // Reset to first page when filtering
    this.currentPage = 0;
    // Load questions with server-side filtering
    this.loadQuestions();
  }

  onSkillChange(): void {
    this.filterQuestions();
  }

  onLevelChange(): void {
    this.filterQuestions();
  }

  paginatedQuestions(): Question[] {
    return this.filteredQuestions;
  }


  changePage(page: number): void {
    if (page >= 0 && page < this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadQuestions();
    }
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 1);
    const end = Math.min(this.totalPages - 2, this.currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (i > 0 && i < this.totalPages - 1) {
        pages.push(i);
      }
    }

    return pages;
  }

  showOptions(question: Question): void {
    this.optionsQuestionText = question.question;
    this.optionsToShow = Object.entries(question.options)
      .map(([key, value]) => ({ key: key.toUpperCase(), value }));
    this.optionsCorrectAnswer = question.correctanswer;
    this.showOptionsModal = true;
  }

  closeOptionsModal(): void {
    this.showOptionsModal = false;
  }

  showAddQuestionForm(): void {
    this.showAddForm = true;
    this.isEdit = false;
    this.resetForm();
  }

  hideAddForm(): void {
    this.showAddForm = false;
    this.resetForm();
  }

  resetForm(): void {
    this.form = {
      skill: '',
      level: '',
      question: '',
      type: 'single',
      options: { a: '', b: '', c: '', d: '' },
      correctanswer: ''
    };
  }

  onEdit(question: Question): void {
    this.isEdit = true;
    this.showAddForm = true;
    this.form = {
      _id: question._id,
      skill: question.skill,
      level: question.level,
      question: question.question,
      type: question.type,
      options: { ...question.options },
      correctanswer: question.correctanswer
    };
  }

  // Updated delete method to show confirmation modal instead of alert
  onDelete(id: string): void {
    this.deleteQuestionId = id;
  }

  // Method to confirm and execute deletion
  confirmDelete(): void {
    if (!this.deleteQuestionId) return;

    const token = localStorage.getItem('token');
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    this.http.delete(`${this.apiUrl}/delete-question/${this.deleteQuestionId}`, headers).subscribe({
      next: () => {
        this.loadQuestions();
        this.cancelDelete();
      },
      error: (err) => {
        console.error('Delete failed:', err);
        this.cancelDelete();
      }
    });
  }

  // Method to cancel deletion
  cancelDelete(): void {
    this.deleteQuestionId = null;
  }

  getOptionKeys(): ('a' | 'b' | 'c' | 'd')[] {
    return ['a', 'b', 'c', 'd'];
  }

  getOptionLabel(key: string): string {
    return key.toUpperCase();
  }

  submitForm(): void {
    const trimLower = (s: string) => s.trim().toLowerCase();

    if (
      !this.form.skill.trim() ||
      !this.form.level.trim() ||
      !this.form.question.trim() ||
      Object.values(this.form.options).some(opt => !opt.trim()) ||
      !this.form.correctanswer.trim()
    ) {
      alert('Please fill in all fields.');
      return;
    }

    // Accept both a/b/c/d or actual content as valid correct answers
    // Handle multiple correct answers for multiple choice questions
    const answer = trimLower(this.form.correctanswer);
    const keyToValue = this.form.options;
    const optionsNormalized = Object.values(keyToValue).map(trimLower);

    let isAnswerValid = false;

    if (this.form.type === 'multiple') {
      // For multiple choice, allow comma-separated answers like "b,c" or "c,d"
      const answerParts = answer.split(',').map(part => part.trim());
      isAnswerValid = answerParts.every(part =>
        ['a', 'b', 'c', 'd'].includes(part) || optionsNormalized.includes(part)
      );
    } else {
      // For single choice and true/false
      isAnswerValid = ['a', 'b', 'c', 'd'].includes(answer) || optionsNormalized.includes(answer);
    }

    if (!isAnswerValid) {
      alert('Correct answer must match one of the options (a/b/c/d or full content). For multiple choice, use comma-separated values like "b,c".');
      return;
    }

    // If answer is a/b/c/d convert it to actual option value before sending
   // Handle conversion for multiple choice questions
let finalCorrectAnswer = this.form.correctanswer;

if (this.form.type === 'multiple') {
  // For multiple choice, keep the comma-separated format (e.g., "b,c")
  finalCorrectAnswer = answer;
} else {
  // For single choice and true/false, convert if needed
  finalCorrectAnswer = ['a', 'b', 'c', 'd'].includes(answer)
    ? keyToValue[answer as 'a' | 'b' | 'c' | 'd']
    : this.form.correctanswer;
}

    const payload: Omit<Question, '_id'> = {
      skill: this.form.skill,
      level: this.form.level,
      question: this.form.question,
      type: this.form.type,
      options: { ...this.form.options },
      correctanswer: finalCorrectAnswer
    };

    const token = localStorage.getItem('token');
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    if (this.isEdit && this.form._id) {
      this.http.patch(`${this.apiUrl}/update-question/${this.form._id}`, payload, headers).subscribe({
        next: () => {
          this.loadQuestions();
          this.hideAddForm();
        },
        error: (err) => console.error('Update failed:', err)
      });
    } else {
      this.http.post(`${this.apiUrl}/add-question`, payload, headers).subscribe({
        next: () => {
          this.loadQuestions();
          this.hideAddForm();
        },
        error: (err) => console.error('Create failed:', err)
      });
    }
  }
}