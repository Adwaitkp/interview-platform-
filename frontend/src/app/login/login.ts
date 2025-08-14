import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../environments/environment'; 

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [CommonModule, ReactiveFormsModule],
})
export class Login {
  loginForm: FormGroup;
  loading = false;
  error: string = '';
  showPassword = false;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    const { email, password } = this.loginForm.value;

    this.http.post<any>(`${environment.apiUrl}/auth/login`, { email, password }).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('name', res.user.name);
        localStorage.setItem('email', res.user.email);
        localStorage.setItem('role', res.user.role);
        // Store intervieweeId for non-admin users
        if (res.user.role !== 'admin') {
          localStorage.setItem('intervieweeId', res.user.id);
          // Always store skill as array
          if (res.user.skill) {
            const skillsArr = Array.isArray(res.user.skill) ? res.user.skill : [res.user.skill];
            localStorage.setItem('skill', JSON.stringify(skillsArr));
          }
          // Always store level as array
          if (res.user.level) {
            const levelsArr = Array.isArray(res.user.level) ? res.user.level : [res.user.level];
            localStorage.setItem('level', JSON.stringify(levelsArr));
          }
          if (res.user.questionCounts) {
            localStorage.setItem('questionCounts', JSON.stringify(res.user.questionCounts));
          }
        }
        // Redirect based on role
        if (res.user.role === 'admin') {
          this.loading = false;
          this.router.navigate(['/admin-dashboard']);
        } else {
          // After login, fetch /auth/me to check quizType
          this.http.get(`${environment.apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${res.token}` }
          }).subscribe({
            next: (userData: any) => {
              this.loading = false;
              if (userData.quizType === 'normal') {
                this.router.navigate(['/quiz']);
              } else if (userData.quizType === 'ai') {
                this.router.navigate(['/ai-quiz']);
              } else {
                alert('No quiz assigned. Please contact your administrator.');
              }
            },
            error: () => {
              this.loading = false;
              alert('Error fetching user data.');
            }
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error.message || 'Login failed. Please try again.';
        console.error('Login error:', err);
      },
    });
  }
}
