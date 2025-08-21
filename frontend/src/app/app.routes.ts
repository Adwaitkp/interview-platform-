import { Routes } from '@angular/router';
import { Login } from './login/login';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { HeaderComponent } from './header/header';
import { CandidateManagement } from './candidate-management/candidate-management'
import { QuestionsComponent } from './questions/questions';
import { QuizComponent } from './quiz/quiz';

import { AIQuizComponent } from './ai-quiz/ai-quiz';

import { UnifiedQuestionsComponent } from './unified-question/unified-questions'; // Change this line

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'admin-dashboard', component: AdminDashboardComponent },
  { path: 'candidate-management', component: CandidateManagement },
  { path: 'header', component: HeaderComponent },
  { path: 'questions', component: QuestionsComponent }, // Normal questions 
  { path: 'quiz', component: QuizComponent },
  { path: 'ai-quiz', component: AIQuizComponent },
  
 
  { path: 'ai-questions-unified', component: UnifiedQuestionsComponent },

  
  { path: '**', redirectTo: 'login' }
];
