import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

// Defines a specific type for the cascade update payload for better type-checking
interface CascadeUpdatePayload {
  removedSkills?: string[];
  removedLevels?: { skill: string; level: string }[];
  questionCounts?: { [skill: string]: { [level: string]: number } };
  [key: string]: any; // Allows for other properties that may be part of the payload
}

@Injectable({
  providedIn: 'root'
})
export class CandidateManagementService {

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getUsers(page: number, limit: number, search: string): Observable<{ users: User[], totalPages: number, totalUsers: number }> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('search', search);
    return this.http.get<{ users: User[], totalPages: number, totalUsers: number }>(`${environment.apiUrl}/admin/users`, { headers, params });
  }

  updateUser(userId: string, data: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/admin/users/${userId}`, data, {
      headers: this.getAuthHeaders().set('Content-Type', 'application/json')
    });
  }

  cascadeUpdateUser(userId: string, data: CascadeUpdatePayload): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/admin/users/cascade-delete/${userId}`, data, {
        headers: this.getAuthHeaders().set('Content-Type', 'application/json')
    });
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/users/${userId}`, {
      headers: this.getAuthHeaders()
    });
  }

  resetPassword(userId: string, newPassword: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${environment.apiUrl}/admin/users/update/${userId}`, { newPassword }, {
      headers: this.getAuthHeaders().set('Content-Type', 'application/json')
    });
  }

  assignQuizType(userId: string, quizType: 'normal' | 'ai'): Observable<any> {
    return this.http.post(`${environment.apiUrl}/quiz-assignment/assign-quiz-type`, { userId, quizType }, {
      headers: this.getAuthHeaders().set('Content-Type', 'application/json')
    });
  }

  getUserSets(userId: string): Observable<{ sets: { setId: string; label: string }[] }> {
      return this.http.get<{ sets: { setId: string; label: string }[] }>(`${environment.apiUrl}/ai-quiz/user-sets/${userId}`, { headers: this.getAuthHeaders() });
  }

  generateAIQuestions(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/ai-quiz/generate-ai-questions`, payload, { headers: this.getAuthHeaders() });
  }

  updateAssignedSet(userId: string, setId: string | null): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/admin/users/${userId}`, { assignedSetId: setId }, {
        headers: this.getAuthHeaders().set('Content-Type', 'application/json')
    });
  }
}
