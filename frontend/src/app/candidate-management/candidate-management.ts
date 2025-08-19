import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { AddIntervieweeComponent } from '../add-interviewee/add-interviewee';

@Component({
  selector: 'app-candidate-management',
  templateUrl: './candidate-management.html',
  standalone: true,
  imports: [CommonModule, FormsModule, AddIntervieweeComponent]
})
export class CandidateManagement implements OnInit {
  // ADD THIS LINE - Expose Math to template
  Math = Math;

  availableSkills: string[] = ['Node.js', 'React', 'Angular', 'MongoDB', 'PostgreSQL', 'Next.js', 'Django', 'Git', 'Docker', 'TypeScript'];
  availableLevels: string[] = ['Beginner', 'Intermediate', 'Advanced'];
  skillSelections: { [userId: string]: { [skill: string]: boolean } } = {};
  levelSelections: { [userId: string]: { [level: string]: boolean } } = {};
  users: any[] = [];
  loading = true;
  showAddIntervieweeModal = false;
  showQuestionDetailsModal = false;
  editUserId: string | null = null;
  deleteUserId: string | null = null;
  resetUserId: string | null = null;
  selectedUser: any = null;
  questionCountsEdit: { [skill: string]: { [level: string]: number } } = {};
  editForms: { [key: string]: any } = {};
  resetPassword = '';
  resetLoading = false;
  resetMsg = '';
  currentPage: number = 0;
  pageSize: number = 10;
  quizAssignmentLoading: { [userId: string]: boolean } = {};
  totalPages: number = 0;
  totalUsers: number = 0;
  searchTerm: string = '';

  // AI Test Mode properties
  showAITestModal: boolean = false;
  selectedUserForAI: any = null;
  skillLevels: { skill: string; level: string; count: number }[] = [{ skill: '', level: '', count: 1 }];
  isGeneratingAIQuestions: boolean = false;

  // Success modal property
  showSuccessModal: boolean = false;

  availableSetIds: string[] = [];
  selectedSetId: string = '';
  showSetChoiceModal: boolean = false;
  useExistingSet: boolean = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.getAllUsers();
  }

  getAllUsers() {
    this.loading = true;
    const token = localStorage.getItem('token');
    this.http.get(`${environment.apiUrl}/admin/users?page=${this.currentPage}&limit=${this.pageSize}&search=${this.searchTerm}`, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    }).subscribe({
      next: (res: any) => {
        this.users = res.users;
        this.totalPages = res.totalPages;
        this.totalUsers = res.totalUsers;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to fetch users', err);
        this.loading = false;
      }
    });
  }

  setSearch(term: string) {
    this.searchTerm = term;
    this.currentPage = 0; // Reset to first page when searching
    this.getAllUsers();
  }

  handleEditChange(userId: string, field: string, value: any) {
    if (!this.editForms[userId]) {
      this.editForms[userId] = {};
    }
    this.editForms[userId][field] = value;
  }

  handleEditSave(userId: string) {
    const originalUser = this.users.find(u => u._id === userId);
    if (!originalUser) return;

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const removedLevels: { skill: string; level: string }[] = [];
    const originalSkills = Array.isArray(originalUser.skill) ? originalUser.skill : [originalUser.skill];
    const newSkills = this.editForms[userId].skill || [];

    if (newSkills.length === 0) {
      alert('At least one skill must be selected.');
      return;
    }

    const originalLevels = Array.isArray(originalUser.level) ? originalUser.level : [originalUser.level];
    const newLevels = this.editForms[userId].level || [];

    for (const level of originalLevels) {
      if (!newLevels.includes(level)) {
        for (const skill of newSkills) {
          removedLevels.push({ skill, level });
        }
      }
    }

    if (removedLevels.length > 0) {
      const updatedQuestionCounts = { ...originalUser.questionCounts };
      for (const { skill, level } of removedLevels) {
        if (updatedQuestionCounts[skill]) {
          updatedQuestionCounts[skill][level] = 0;
        }
      }

      this.http.patch(`${environment.apiUrl}/admin/users/cascade-delete/${userId}`, {
        removedSkills: [],
        removedLevels,
        ...this.editForms[userId],
        questionCounts: updatedQuestionCounts
      }, { headers }).subscribe({
        next: (response: any) => {
          this.editUserId = null;
          this.getAllUsers();
        },
        error: (err) => {
          console.error('Failed to update user:', err);
        }
      });
    } else {
      this.http.patch(`${environment.apiUrl}/admin/users/${userId}`, this.editForms[userId], {
        headers
      }).subscribe({
        next: () => {
          this.editUserId = null;
          this.getAllUsers();
        },
        error: (err) => {
          console.error('Update failed', err);
        }
      });
    }
  }

  confirmDelete(userId: string) {
    this.deleteUserId = userId;
  }

  cancelDelete() {
    this.deleteUserId = null;
  }

  deleteUser() {
    if (!this.deleteUserId) return;

    const token = localStorage.getItem('token');
    this.http.delete(`${environment.apiUrl}/admin/users/${this.deleteUserId}`, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    }).subscribe({
      next: () => {
        this.deleteUserId = null;
        this.getAllUsers();
      },
      error: (err) => {
        console.error('Delete failed', err);
      }
    });
  }

  handleResetPassword() {
    if (!this.resetUserId || !this.resetPassword) return;

    this.resetLoading = true;
    const token = localStorage.getItem('token');

    this.http.patch(`${environment.apiUrl}/admin/users/update/${this.resetUserId}`, {
      newPassword: this.resetPassword
    }, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    }).subscribe({
      next: (res: any) => {
        this.resetMsg = res.message || 'Password reset successful';
        this.resetLoading = false;
      },
      error: (err) => {
        this.resetMsg = 'Reset failed';
        this.resetLoading = false;
      }
    });
  }

  startEdit(user: any) {
    this.editUserId = user._id;
    this.editForms[user._id] = {
      name: user.name,
      email: user.email,
      skill: Array.isArray(user.skill) ? [...user.skill] : [],
      level: Array.isArray(user.level) ? [...user.level] : (user.level ? [user.level] : ['Beginner'])
    };

    this.skillSelections[user._id] = {};
    if (user.skill && Array.isArray(user.skill)) {
      user.skill.forEach((skill: string) => {
        this.skillSelections[user._id][skill] = true;
      });
    }

    this.levelSelections[user._id] = {};
    if (user.level) {
      const levels = Array.isArray(user.level) ? user.level : [user.level];
      levels.forEach((level: string) => {
        this.levelSelections[user._id][level] = true;
      });
    }
  }

  cancelEdit() {
    this.editUserId = null;
    if (this.editUserId) {
      delete this.skillSelections[this.editUserId];
      delete this.levelSelections[this.editUserId];
    }
  }

  toggleSkill(userId: string, skill: string, event: MouseEvent) {
    event.preventDefault();

    if (!this.skillSelections[userId]) {
      this.skillSelections[userId] = {};
    }

    this.skillSelections[userId][skill] = !this.skillSelections[userId][skill];
    const selectedSkills = Object.keys(this.skillSelections[userId])
      .filter(s => this.skillSelections[userId][s]);

    if (selectedSkills.length === 0) {
      alert('At least one skill must be selected.');
      this.skillSelections[userId][skill] = true;
      return;
    }

    this.editForms[userId].skill = selectedSkills;
  }

  toggleLevel(userId: string, level: string, event: MouseEvent) {
    event.preventDefault();

    if (!this.levelSelections[userId]) {
      this.levelSelections[userId] = {};
    }

    this.levelSelections[userId][level] = !this.levelSelections[userId][level];
    const selectedLevels = Object.keys(this.levelSelections[userId])
      .filter(l => this.levelSelections[userId][l]);

    this.editForms[userId].level = selectedLevels;
  }

  isSkillSelected(userId: string, skill: string): boolean {
    return this.skillSelections[userId] && this.skillSelections[userId][skill];
  }

  isLevelSelected(userId: string, level: string): boolean {
    return this.levelSelections[userId] && this.levelSelections[userId][level];
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  startReset(user: any) {
    this.resetUserId = user._id;
    this.resetPassword = '';
    this.resetMsg = '';
  }

  cancelReset() {
    this.resetUserId = null;
    this.resetPassword = '';
    this.resetMsg = '';
  }

  closeAddIntervieweeModal() {
    this.showAddIntervieweeModal = false;
  }

  onIntervieweeAdded() {
    this.showAddIntervieweeModal = false;
    this.getAllUsers();
  }

  trackByUserId(index: number, user: any): string {
    return user._id;
  }

  get paginatedUsers(): any[] {
    return this.users;
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

  changePage(page: number): void {
    if (page !== this.currentPage) {
      this.currentPage = page;
      this.getAllUsers();
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setSearch(target.value);
  }

  onNameInput(userId: string, event: any): void {
    const target = event.target as HTMLInputElement;
    this.handleEditChange(userId, 'name', target.value);
  }

  onEmailInput(userId: string, event: any): void {
    const target = event.target as HTMLInputElement;
    this.handleEditChange(userId, 'email', target.value);
  }

  openQuestionDetails(user: any) {
    this.selectedUser = user;
    this.questionCountsEdit = {};

    if (user.skill) {
      user.skill.forEach((skill: string) => {
        this.questionCountsEdit[skill] = {};
        this.availableLevels.forEach((level: string) => {
          const savedCount = user.questionCounts?.[skill]?.[level];
          this.questionCountsEdit[skill][level] = savedCount !== undefined ? savedCount : 0;
        });
      });
    }

    this.showQuestionDetailsModal = true;
  }

  closeQuestionDetails() {
    this.showQuestionDetailsModal = false;
    this.selectedUser = null;
    this.questionCountsEdit = {};
  }

  getQuestionCount(skill: string, level: string): number {
    if (this.questionCountsEdit[skill] && this.questionCountsEdit[skill][level] !== undefined) {
      return this.questionCountsEdit[skill][level];
    }
    return 0;
  }

  updateQuestionCount(skill: string, level: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value) || 0;

    if (!this.questionCountsEdit[skill]) {
      this.questionCountsEdit[skill] = {};
    }

    this.questionCountsEdit[skill][level] = value;
  }

  // NEW METHOD: Check if a level is assigned to the current selected user
  isLevelAssignedToUser(level: string): boolean {
    if (!this.selectedUser || !this.selectedUser.level) {
      return false;
    }

    const userLevels = Array.isArray(this.selectedUser.level)
      ? this.selectedUser.level
      : [this.selectedUser.level];

    return userLevels.includes(level);
  }

  saveQuestionDetails() {
    if (!this.selectedUser) return;

    const removedSkills: string[] = [];
    const removedLevels: { skill: string; level: string }[] = [];

    if (this.selectedUser.questionCounts) {
      for (const skill in this.selectedUser.questionCounts) {
        if (!this.questionCountsEdit[skill]) {
          removedSkills.push(skill);
        } else {
          for (const level in this.selectedUser.questionCounts[skill]) {
            if (this.questionCountsEdit[skill][level] === 0 || this.questionCountsEdit[skill][level] === undefined) {
              removedLevels.push({ skill, level });
            }
          }
        }
      }
    }

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    if (removedSkills.length > 0 || removedLevels.length > 0) {
      this.http.patch(`${environment.apiUrl}/admin/users/cascade-delete/${this.selectedUser._id}`, {
        removedSkills,
        removedLevels,
        questionCounts: this.questionCountsEdit
      }, { headers }).subscribe({
        next: (response: any) => {
          this.closeQuestionDetails();
          this.getAllUsers();
        },
        error: (err) => {
          console.error('Failed to perform cascading delete:', err);
        }
      });
    } else {
      this.http.patch(`${environment.apiUrl}/admin/users/${this.selectedUser._id}`, {
        questionCounts: this.questionCountsEdit
      }, { headers }).subscribe({
        next: () => {
          this.closeQuestionDetails();
          this.getAllUsers();
        },
        error: (err) => {
          console.error('Failed to update question counts', err);
        }
      });
    }
  }

  // FIXED: assignQuizType method - returns Promise
  assignQuizType(userId: string, quizType: 'normal' | 'ai'): Promise<any> {
    return new Promise((resolve, reject) => {
      this.quizAssignmentLoading[userId] = true;
      const token = localStorage.getItem('token');

      this.http.post(`${environment.apiUrl}/quiz-assignment/assign-quiz-type`, {
        userId,
        quizType
      }, {
        headers: new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })
      }).subscribe({
        next: (res: any) => {
          const userIndex = this.users.findIndex(u => u._id === userId);
          if (userIndex !== -1) {
            this.users[userIndex].quizType = quizType;
            // this.searchItems = this.users;
          }
          this.quizAssignmentLoading[userId] = false;
          resolve(res);
        },
        error: (err) => {
          console.error('Failed to assign quiz type:', err);
          this.quizAssignmentLoading[userId] = false;
          reject(err);
        }
      });
    });
  }

  getQuizTypeStatus(user: any): string {
    if (!user.quizType) return 'Not Assigned';
    return user.quizType === 'normal' ? 'Normal Quiz' : 'AI Quiz';
  }
  async openAITestMode(user: any): Promise<void> {
    this.selectedUserForAI = user;
    this.skillLevels = [];
    this.availableSetIds = [];
    this.selectedSetId = '';
    this.showSetChoiceModal = false;
    this.useExistingSet = false;

    const userSkills = Array.isArray(user.skill) ? user.skill : (user.skill ? [user.skill] : []);
    const userLevels = Array.isArray(user.level) ? user.level : (user.level ? [user.level] : []);

    // Check for existing sets
    if (user && user._id) {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      try {
        const res: any = await this.http.get(`${environment.apiUrl}/ai-quiz/user-sets/${user._id}`, { headers }).toPromise();
        this.availableSetIds = res.sets || [];

        // If sets exist, show choice modal
        if (this.availableSetIds.length > 0) {
          this.showSetChoiceModal = true;
          return; // Wait for admin choice
        }
      } catch (err) {
        console.error('Error checking existing sets:', err);
      }
    }

    this.initializeSkillLevelsAndShowModal(userSkills, userLevels);
  }
  // Helper method to initialize skill levels and show modal
  private initializeSkillLevelsAndShowModal(userSkills: string[], userLevels: string[]): void {
    this.skillLevels = [];

    if (userSkills.length > 0 && userLevels.length > 0) {
      userSkills.forEach((skill: string) => {
        userLevels.forEach((level: string) => {
          this.skillLevels.push({ skill, level, count: 1 });
        });
      });
    }

    if (this.skillLevels.length === 0) {
      this.skillLevels.push({ skill: '', level: '', count: 1 });
    }

    this.showAITestModal = true;
  }
  continueWithSet() {
    this.useExistingSet = true;
    this.showSetChoiceModal = false;

    // Initialize skillLevels for the AI Test Modal
    const userSkills = Array.isArray(this.selectedUserForAI.skill)
      ? this.selectedUserForAI.skill
      : (this.selectedUserForAI.skill ? [this.selectedUserForAI.skill] : []);
    const userLevels = Array.isArray(this.selectedUserForAI.level)
      ? this.selectedUserForAI.level
      : (this.selectedUserForAI.level ? [this.selectedUserForAI.level] : []);

    this.initializeSkillLevelsAndShowModal(userSkills, userLevels);
  }
  createNewSet() {
    this.useExistingSet = false;
    this.selectedSetId = '';
    this.showSetChoiceModal = false;

    // Initialize skillLevels for the AI Test Modal
    const userSkills = Array.isArray(this.selectedUserForAI.skill)
      ? this.selectedUserForAI.skill
      : (this.selectedUserForAI.skill ? [this.selectedUserForAI.skill] : []);
    const userLevels = Array.isArray(this.selectedUserForAI.level)
      ? this.selectedUserForAI.level
      : (this.selectedUserForAI.level ? [this.selectedUserForAI.level] : []);

    this.initializeSkillLevelsAndShowModal(userSkills, userLevels);
  }
  closeAITestModal(): void {
    this.showAITestModal = false;
    this.selectedUserForAI = null;
    this.skillLevels = [];
  }

  closeSetChoiceModal() {
  this.showSetChoiceModal = false;
  this.selectedUserForAI = null;
  this.availableSetIds = [];
  this.selectedSetId = '';
  this.useExistingSet = false;
}

  addSkillLevel(): void {
    this.skillLevels.push({ skill: '', level: '', count: 1 });
  }

  removeSkillLevel(index: number): void {
    if (this.skillLevels.length > 1) {
      this.skillLevels.splice(index, 1);
    }
  }

  isAITestFormValid(): boolean {
    return this.skillLevels.every(sl => sl.skill && sl.level && sl.count > 0);
  }

  // MAIN FIX: generateAIQuestions method - GUARANTEED TO WORK
  async generateAIQuestions(): Promise<void> {
    if (!this.isAITestFormValid() || !this.selectedUserForAI) {
      return;
    }
    this.isGeneratingAIQuestions = true;
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const payload: any = {
        skillLevels: this.skillLevels,
        generatedBy: this.selectedUserForAI._id,
        useExistingSet: this.useExistingSet
      };
      if (this.useExistingSet && this.selectedSetId) {
        payload.setid = this.selectedSetId;
      }
      await this.http.post(`${environment.apiUrl}/ai-quiz/generate-ai-questions`, payload, { headers }).toPromise();
      await this.assignQuizType(this.selectedUserForAI._id, 'ai');
      this.showAITestModal = false;
      this.selectedUserForAI = null;
      this.skillLevels = [];
      this.isGeneratingAIQuestions = false;
      this.cdr.detectChanges();
      this.showSuccessModal = true;
      this.cdr.detectChanges();
      this.getAllUsers();
    } catch (error) {
      this.isGeneratingAIQuestions = false;
      this.cdr.detectChanges();
      alert('Failed to generate AI questions. Please try again.');
    }
  }


  // handleSuccessModalAction method
  handleSuccessModalAction(shouldRedirect: boolean): void {
    this.showSuccessModal = false;

    if (shouldRedirect) {
      window.location.href = '/ai-questions';
    }
  }

}