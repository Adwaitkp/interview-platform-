import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { QuizResult, User } from '../models/admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  async getUsers(): Promise<User[]> {
    const headers = this.getAuthHeaders();
    const response = await firstValueFrom(
      this.http.get<any>(`${environment.apiUrl}/admin/users`, { headers })
    );

    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (response?.data && Array.isArray(response.data)) {
      users = response.data;
    } else if (response?.users && Array.isArray(response.users)) {
      users = response.users;
    } else if (response && typeof response === 'object') {
      const arrayProps = Object.keys(response).filter(key => Array.isArray(response[key]));
      if (arrayProps.length > 0) {
        users = response[arrayProps[0]];
      }
    }
    return users.filter((u: any) => u.role !== 'admin');
  }

  async getResults(page: number, limit: number, search: string): Promise<{ quizResults: any[], totalPages: number, currentPage: number, totalResults: number }> {
    const headers = this.getAuthHeaders();
    const response = await firstValueFrom(this.http.get<any>(
      `${environment.apiUrl}/quiz/results?page=${page}&limit=${limit}&search=${search}`,
      { headers }
    ));
    return {
      quizResults: response.results || [],
      totalPages: response.totalPages || 0,
      currentPage: response.currentPage || 0,
      totalResults: response.totalResults || 0
    };
  }

  async getAIResults(page: number, limit: number, search: string): Promise<{ aiResults: any[], totalPages: number, currentPage: number, totalResults: number }> {
    const headers = this.getAuthHeaders();
    const response = await firstValueFrom(this.http.get<any>(
      `${environment.apiUrl}/ai-quiz/ai-results?page=${page}&limit=${limit}&search=${search}`,
      { headers }
    ));
    return {
      aiResults: response.results || [],
      totalPages: response.totalPages || 0,
      currentPage: response.currentPage || 0,
      totalResults: response.totalResults || 0
    };
  }

  async getDetailedResult(resultId: string): Promise<QuizResult> {
    const headers = this.getAuthHeaders();
    return firstValueFrom(this.http.get<QuizResult>(
      `${environment.apiUrl}/quiz/result/${resultId}`,
      { headers }
    ));
  }

  async retestUser(userId: string): Promise<any> {
    const headers = this.getAuthHeaders();
    return firstValueFrom(this.http.patch<any>(
      `${environment.apiUrl}/admin/users/retest/${userId}`,
      {},
      { headers }
    ));
  }

  async getAIQuestionsForUser(email: string): Promise<any[]> {
    const headers = this.getAuthHeaders();
    const response = await firstValueFrom(
      this.http.get<any>(`${environment.apiUrl}/ai-quiz/ai-results?page=0&limit=1000`, { headers })
    );

    let aiResults: any[] = [];
    if (Array.isArray(response)) {
      aiResults = response;
    } else if (response?.results && Array.isArray(response.results)) {
      aiResults = response.results;
    }

    const userAIResult = aiResults.find((aiResult: any) => aiResult.email === email || aiResult.userEmail === email);

    if (userAIResult) {
      const detailedAIResult = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/ai-quiz/ai-result/${userAIResult._id}`, { headers })
      );
      return detailedAIResult?.questionResponses || [];
    }
    return [];
  }
}
