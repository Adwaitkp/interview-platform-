import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';   
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface QuestionResponse {
  questionId: string;
  question: string;
  skill: string;
  level: string;
  userAnswer: string;
  correctanswer: string;
  isCorrect: boolean;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
}

interface SkillLevelSummary {
  skill: string;
  level: string;
  totalQuestions: number;
  correctAnswers: number;
}

interface QuizResult {
  _id: string;
  name: string;
  email: string;
  totalMarks: number;
  totalQuestions: number;
  overallPercentage: number;
  skillResults: SkillLevelSummary[];
  questionResponses?: QuestionResponse[];
  quizDate?: string | Date;
  userId?: string;
  aiScore?: {
    totalMarks: number;
    totalQuestions: number;
    overallPercentage: number;
    skillLevelSummaries?: Array<{
      skill: string;
      level: string;
      totalQuestions: number;
      correctAnswers: number;
    }>;
  };
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  skill?: string[];
  level?: string;
  questionCounts?: { [skill: string]: { [level: string]: number } };
}

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

  currentPage: number = 0;
  pageSize: number = 10;

  get filteredResults(): QuizResult[] {
    return this.results.filter(r =>
      r.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  get paginatedResults(): QuizResult[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredResults.slice(start, start + this.pageSize);
  }

  totalPagesArray(): number[] {
    return Array(Math.ceil(this.filteredResults.length / this.pageSize)).fill(0).map((x, i) => i);
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

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    // Fetch users, results, and AI results in parallel
    Promise.all([
      firstValueFrom(this.http.get<User[]>(`${environment.apiUrl}/admin/users`, { headers })),
      firstValueFrom(this.http.get<QuizResult[]>(`${environment.apiUrl}/quiz/results`, { headers })),
      firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/ai-quiz/ai-results`, { headers }))
    ]).then(([users = [], quizResults = [], aiResults = []]) => {
      // keep only interviewees
      const interviewees = users.filter(u => u.role !== 'admin');
      this.users = interviewees;
      
      const combinedResults: QuizResult[] = [];
      
      // 1) add regular quiz results and ensure quizDate is set
      quizResults.forEach((result: any) => {
        combinedResults.push({
          ...result,
          quizDate: result.quizDate || result.createdAt || null, // use quizDate if backend already sent it or createdAt
          userId: interviewees.find(u => u.email === result.email)?._id || '',
          aiScore: undefined
        });
      });
      
      // 2) merge AI results: if user already has a regular result, attach aiScore and prefer AI date,
      // otherwise add a new entry for AI-only result (with quizDate set)
      aiResults.forEach((aiResult: any) => {
        const existingResult = combinedResults.find(r => r.email === aiResult.email);
        if (existingResult) {
          existingResult.aiScore = {
            totalMarks: aiResult.totalMarks,
            totalQuestions: aiResult.totalQuestions,
            overallPercentage: aiResult.overallPercentage,
            skillLevelSummaries: aiResult.skillResults?.map((s: any) => ({
              skill: s.skill,
              level: s.level,
              totalQuestions: s.totalQuestions,
              correctAnswers: s.correctAnswers
            }))
          };
          // Prefer AI quiz date if AI exists (overwrites normal quiz date)
          existingResult.quizDate = aiResult.quizDate || aiResult.createdAt || existingResult.quizDate;
        } else {
          combinedResults.push({
            _id: aiResult._id,
            name: aiResult.name,
            email: aiResult.email,
            totalMarks: 0,
            totalQuestions: 0,
            overallPercentage: 0,
            skillResults: [],
            quizDate: aiResult.quizDate || aiResult.createdAt || null,
            userId: interviewees.find(u => u.email === aiResult.email)?._id || '',
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
        }
      });
      
      // assign results and set userIds just in case
      this.results = combinedResults;
      this.results.forEach(r => {
        const user = interviewees.find(u => u.email === r.email);
        if (user) r.userId = user._id;
      });
      
      this.loading = false;
    }).catch(err => {
      console.error('❌ Error fetching data:', err);
      this.loading = false;
    });
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
        const token = localStorage.getItem('token');
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        
        const detailedResult = await firstValueFrom(this.http.get<QuizResult>(
          `${environment.apiUrl}/quiz/result/${result._id}`, 
          { headers }
        ));
        
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

  async resetQuiz(result: QuizResult) {
    if (!result.userId) {
      alert('User ID not found. Cannot reset quiz.');
      return;
    }

    if (confirm(`Are you sure you want to reset the quiz for ${result.name}? They will be able to take the quiz again with different questions.`)) {
      this.resettingQuizIds.add(result.userId);
      
      try {
        const token = localStorage.getItem('token');
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        
        const response = await firstValueFrom(this.http.patch(
          `${environment.apiUrl}/admin/users/retest/${result.userId}`,
          {},
          { headers }
        ));
        
        alert(`Quiz reset successfully! The user can now retake the quiz with completely new questions. (Deleted ${(response as any).deletedResults} previous results)`);
        
        // Refresh the data to show updated results
        this.ngOnInit();
      } catch (error) {
        console.error('Error resetting quiz:', error);
        alert('Failed to reset quiz. Please try again.');
      } finally {
        this.resettingQuizIds.delete(result.userId);
      }
    }
  }

  isResettingQuiz(userId: string): boolean {
    return this.resettingQuizIds.has(userId);
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
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    // Get all AI results and find the one for this user
    const aiResults = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/ai-quiz/ai-results`, { headers }));
    const userAIResult = aiResults.find((aiResult: any) => aiResult.email === result.email);

    if (userAIResult) {
      // Fetch detailed AI result with question responses
      const detailedAIResult = await firstValueFrom(this.http.get<any>(
        `${environment.apiUrl}/ai-quiz/ai-result/${userAIResult._id}`, 
        { headers }
      ));

      if (detailedAIResult && detailedAIResult.questionResponses) {
        // Filter questions by skill and level
        this.selectedAIQuizQuestions = detailedAIResult.questionResponses.filter(
          (q: any) => q.skill === skill && q.level === level
        );
      } else {
        this.selectedAIQuizQuestions = [];
      }
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
        const token = localStorage.getItem('token');
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        
        const detailedResult = await firstValueFrom(this.http.get<QuizResult>(
          `${environment.apiUrl}/quiz/result/${result._id}`, 
          { headers }
        ));
        
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

}