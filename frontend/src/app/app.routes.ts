import { Routes } from '@angular/router';
import { Login } from './login/login';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { HeaderComponent } from './header/header';
import { CandidateManagement } from './candidate-management/candidate-management'
import { QuestionsComponent } from './questions/questions';
import { QuizComponent } from './quiz/quiz';
import { AIQuestionsComponent } from './ai-questions/ai-questions';
import { AIQuizComponent } from './ai-quiz/ai-quiz';
import { AcceptedQuestionsComponent } from './accepted-questions/accepted-questions';

export const routes: Routes = [
  { path: '',         redirectTo: 'login', pathMatch: 'full' },

  // Login page
  { path: 'login',    component: Login },

  // Admin dashboard page
  { path: 'admin-dashboard', component: AdminDashboardComponent },

  // User info page
  { path: 'candidate-management', component: CandidateManagement },

  {path : 'header', component: HeaderComponent},

  {path : 'questions', component: QuestionsComponent},

  { path: 'quiz', component: QuizComponent },

  // AI Quiz routes
  { path: 'ai-questions', component: AIQuestionsComponent },
  { path: 'ai-quiz', component: AIQuizComponent },

  // Accepted Questions route
  { path: 'accepted-questions', component: AcceptedQuestionsComponent },

  // Wild-card – keep last
  { path: '**',       redirectTo: 'login' }
];
