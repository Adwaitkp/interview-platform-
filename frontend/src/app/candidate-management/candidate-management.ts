import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddIntervieweeComponent } from '../add-interviewee/add-interviewee';
import { CandidateManagementService } from '../services/candidate-management.service';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-candidate-management',
  templateUrl: './candidate-management.html',
  standalone: true,
  imports: [CommonModule, FormsModule, AddIntervieweeComponent]
})
export class CandidateManagement implements OnInit {
  Math = Math;

  availableSkills: string[] = ['Node.js', 'React', 'Angular', 'MongoDB', 'PostgreSQL', 'Next.js', 'Django', 'Git', 'Docker', 'TypeScript'];
  availableLevels: string[] = ['Beginner', 'Intermediate', 'Advanced'];
  skillSelections: { [userId: string]: { [skill: string]: boolean } } = {};
  levelSelections: { [userId: string]: { [level: string]: boolean } } = {};
  users: User[] = [];
  loading = true;
  showAddIntervieweeModal = false;
  showQuestionDetailsModal = false;
  editUserId: string | null = null;
  deleteUserId: string | null = null;
  resetUserId: string | null = null;
  selectedUser: User | null = null;
  questionCountsEdit: { [skill: string]: { [level: string]: number } } = {};
  editForms: { [key: string]: Partial<Pick<User, 'name' | 'email' | 'skill' | 'level'>> } = {};
  resetPassword = '';
  resetLoading = false;
  resetMsg = '';
  currentPage: number = 0;
  pageSize: number = 10;
  quizAssignmentLoading: { [userId: string]: boolean } = {};
  totalPages: number = 0;
  totalUsers: number = 0;
  searchTerm: string = '';

  userSpecificSets: { [userId: string]: { setId: string; label: string }[] } = {};
  userSetsLoaded: { [userId: string]: boolean } = {};

  showAITestModal: boolean = false;
  selectedUserForAI: User | null = null;
  skillLevels: { skill: string; level: string; count: number }[] = [{ skill: '', level: '', count: 1 }];
  isGeneratingAIQuestions: boolean = false;

  showSuccessModal: boolean = false;
  availableSetIds: { setId: string; label: string }[] = [];
  selectedSetId: string = '';
  showSetChoiceModal: boolean = false;
  // Question Type Control Modal Properties
  showNormalQuizModal: boolean = false;
  selectedUserForNormal: User | null = null;
  questionTypeConfig = {
    multipleChoice: 0,
    trueFalse: 0,
    singleChoice: 0,
    totalQuestions: 0
  };

  skillLevelQuestionTypes: { skill: string; level: string; multipleChoice: number; trueFalse: number; singleChoice: number; total: number }[] = [];

  useExistingSet: boolean = false;

  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private candidateService: CandidateManagementService, private cdr: ChangeDetectorRef, private router: Router) { }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    this.getAllUsers();
  }

  handleEditChange(userId: string, field: 'name' | 'email', value: string) {
    if (!this.editForms[userId]) {
      this.editForms[userId] = {};
    }
    this.editForms[userId][field] = value;
  }

  handleEditSave(userId: string) {
    const originalUser = this.users.find(u => u._id === userId);
    if (!originalUser) return;

    const newSkills = this.editForms[userId]?.skill || [];
    if (newSkills.length === 0) {
      alert('At least one skill must be selected.');
      return;
    }

    // Detect removed skills
    const originalSkills = Array.isArray(originalUser.skill) ? originalUser.skill : [];
    const removedSkills = originalSkills.filter((skill: string) => !newSkills.includes(skill));

    // Detect removed levels
    const originalLevels = Array.isArray(originalUser.level) ? originalUser.level : [originalUser.level];
    const newLevels = this.editForms[userId]?.level || [];
    const removedLevels = originalLevels
      .filter((level: string) => !newLevels.includes(level))
      .flatMap((level: string) => newSkills.map((skill: string) => ({ skill, level })));

    // Check if we need to do a cascade update
    if (removedSkills.length > 0 || removedLevels.length > 0) {
      const updatedQuestionCounts = { ...originalUser.questionCounts };
      
      // Clear question counts for removed levels
      removedLevels.forEach(({ skill, level }: { skill: string; level: string }) => {
        if (updatedQuestionCounts[skill]) {
          updatedQuestionCounts[skill][level] = 0;
        }
      });

      // Clear question counts for removed skills entirely
      removedSkills.forEach((skill: string) => {
        if (updatedQuestionCounts[skill]) {
          delete updatedQuestionCounts[skill];
        }
      });

      const payload = {
        removedSkills,
        removedLevels,
        ...this.editForms[userId],
        questionCounts: updatedQuestionCounts
      };

      this.candidateService.cascadeUpdateUser(userId, payload).subscribe({
        next: () => {
          this.editUserId = null;
          this.getAllUsers();
        },
        error: (err) => console.error('Failed to update user:', err)
      });
    } else {
      this.candidateService.updateUser(userId, this.editForms[userId]).subscribe({
        next: () => {
          this.editUserId = null;
          this.getAllUsers();
        },
        error: (err) => console.error('Update failed', err)
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
    this.candidateService.deleteUser(this.deleteUserId).subscribe({
      next: () => {
        this.deleteUserId = null;
        this.getAllUsers();
      },
      error: (err) => console.error('Delete failed', err)
    });
  }

  handleResetPassword() {
    if (!this.resetUserId || !this.resetPassword) return;
    this.resetLoading = true;
    this.candidateService.resetPassword(this.resetUserId, this.resetPassword).subscribe({
      next: (res: { message: string }) => {
        this.resetMsg = res.message || 'Password reset successful';
        this.resetLoading = false;
      },
      error: () => {
        this.resetMsg = 'Reset failed';
        this.resetLoading = false;
      }
    });
  }

  startEdit(user: User) {
    this.editUserId = user._id;
    this.editForms[user._id] = {
      name: user.name,
      email: user.email,
      skill: Array.isArray(user.skill) ? [...user.skill] : [],
      level: Array.isArray(user.level) ? [...user.level] : (user.level ? [user.level] : ['Beginner'])
    };

    this.skillSelections[user._id] = {};
    if (Array.isArray(user.skill)) {
      user.skill.forEach((skill: string) => this.skillSelections[user._id][skill] = true);
    }

    this.levelSelections[user._id] = {};
    const levels = Array.isArray(user.level) ? user.level : [user.level];
    levels.forEach((level: string) => this.levelSelections[user._id][level] = true);
  }

  cancelEdit() {
    if (this.editUserId) {
      delete this.skillSelections[this.editUserId];
      delete this.levelSelections[this.editUserId];
    }
    this.editUserId = null;
  }

  toggleSkill(userId: string, skill: string, event: MouseEvent) {
    event.preventDefault();
    this.skillSelections[userId] = this.skillSelections[userId] || {};
    this.skillSelections[userId][skill] = !this.skillSelections[userId][skill];
    const selectedSkills = Object.keys(this.skillSelections[userId]).filter(s => this.skillSelections[userId][s]);

    if (selectedSkills.length === 0) {
      alert('At least one skill must be selected.');
      this.skillSelections[userId][skill] = true;
      return;
    }
    if (this.editForms[userId]) {
      this.editForms[userId].skill = selectedSkills;
    }
  }

  toggleLevel(userId: string, level: string, event: MouseEvent) {
    event.preventDefault();
    this.levelSelections[userId] = this.levelSelections[userId] || {};
    this.levelSelections[userId][level] = !this.levelSelections[userId][level];
    if (this.editForms[userId]) {
      this.editForms[userId].level = Object.keys(this.levelSelections[userId]).filter(l => this.levelSelections[userId][l]);
    }
  }

  isSkillSelected = (userId: string, skill: string): boolean => this.skillSelections[userId]?.[skill];
  isLevelSelected = (userId: string, level: string): boolean => this.levelSelections[userId]?.[level];
  isArray = (value: any): boolean => Array.isArray(value);

  startReset(user: User) {
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

  trackByUserId = (index: number, user: User): string => user._id;

  get paginatedUsers(): User[] {
    return this.users;
  }

  getVisiblePages(): number[] {
    const total = this.totalPages, maxVisible = 3;
    let start = Math.max(1, this.currentPage - 1);
    let end = Math.min(total - 2, this.currentPage + 1);
    if (this.currentPage <= 1) end = Math.min(total - 2, maxVisible);
    if (this.currentPage >= total - 2) start = Math.max(1, total - maxVisible);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) if (i > 0 && i < total - 1) pages.push(i);
    return pages;
  }

  changePage(page: number): void {
    if (page === this.currentPage) return;
    this.currentPage = page;
    // Reset sorting when changing pages
    this.sortField = '';
    this.sortDirection = 'asc';
    this.getAllUsers();
  }

  setSearch(term: string) {
    this.searchTerm = term;
    this.currentPage = 0;
    // Reset sorting when searching
    this.sortField = '';
    this.sortDirection = 'asc';
    this.getAllUsers();
  }

  onSearchInput = (event: Event) => this.setSearch((event.target as HTMLInputElement).value);
  onNameInput = (userId: string, event: Event) => this.handleEditChange(userId, 'name', (event.target as HTMLInputElement).value);
  onEmailInput = (userId: string, event: Event) => this.handleEditChange(userId, 'email', (event.target as HTMLInputElement).value);

  openQuestionDetails(user: User) {
    this.selectedUser = user;
    this.questionCountsEdit = {};
    if (Array.isArray(user.skill)) {
      user.skill.forEach((skill: string) => {
        this.questionCountsEdit[skill] = {};
        this.availableLevels.forEach(level => {
          this.questionCountsEdit[skill][level] = user.questionCounts?.[skill]?.[level] || 0;
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

  getQuestionCount = (skill: string, level: string): number => this.questionCountsEdit[skill]?.[level] || 0;

  updateQuestionCount(skill: string, level: string, event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value) || 0;
    if (!this.questionCountsEdit[skill]) this.questionCountsEdit[skill] = {};
    this.questionCountsEdit[skill][level] = value;
  }

  isLevelAssignedToUser(level: string): boolean {
    if (!this.selectedUser?.level) return false;
    const userLevels = Array.isArray(this.selectedUser.level) ? this.selectedUser.level : [this.selectedUser.level];
    return userLevels.includes(level);
  }

  saveQuestionDetails() {
    if (!this.selectedUser) return;
    const { questionCounts } = this.selectedUser;
    const removedSkills = questionCounts ? Object.keys(questionCounts).filter(skill => !this.questionCountsEdit[skill]) : [];
    const removedLevels = questionCounts ? Object.keys(questionCounts).flatMap(skill =>
      Object.keys(questionCounts[skill]).filter(level => this.questionCountsEdit[skill]?.[level] === 0 || this.questionCountsEdit[skill]?.[level] === undefined)
        .map(level => ({ skill, level }))
    ) : [];

    if (removedSkills.length > 0 || removedLevels.length > 0) {
      this.candidateService.cascadeUpdateUser(this.selectedUser._id, { removedSkills, removedLevels, questionCounts: this.questionCountsEdit }).subscribe({
        next: () => { 
          // Update local user's question counts immediately before closing
          const userIndex = this.users.findIndex(u => u._id === this.selectedUser?._id);
          if (userIndex !== -1) {
            this.users[userIndex].questionCounts = { ...this.questionCountsEdit };
          }
          this.closeQuestionDetails(); 
          this.getAllUsers(); 
        },
        error: (err) => console.error('Failed to perform cascading delete:', err)
      });
    } else {
      this.candidateService.updateUser(this.selectedUser._id, { questionCounts: this.questionCountsEdit }).subscribe({
        next: () => { 
          // Update local user's question counts immediately before closing
          const userIndex = this.users.findIndex(u => u._id === this.selectedUser?._id);
          if (userIndex !== -1) {
            this.users[userIndex].questionCounts = { ...this.questionCountsEdit };
          }
          this.closeQuestionDetails(); 
          this.getAllUsers(); 
        },
        error: (err) => console.error('Failed to update question counts', err)
      });
    }
  }

  assignQuizType(userId: string, quizType: 'normal' | 'ai'): Promise<any> {
    this.quizAssignmentLoading[userId] = true;
    return new Promise((resolve, reject) => {
      this.candidateService.assignQuizType(userId, quizType).subscribe({
        next: (res) => {
          const user = this.users.find(u => u._id === userId);
          if (user) user.quizType = quizType;
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

  getQuizTypeStatus = (user: User): string => user.quizType ? (user.quizType === 'normal' ? 'Normal Quiz' : 'AI Quiz') : 'Not Assigned';

  openAITestMode(user: User) {
    this.selectedUserForAI = user;
    this.skillLevels = [];
    this.availableSetIds = [];
    this.selectedSetId = '';
    this.showSetChoiceModal = false;
    this.useExistingSet = false;

    if (user?._id) {
      this.candidateService.getUserSets(user._id).subscribe({
        next: (res: { sets: { setId: string; label: string }[] }) => {
          this.availableSetIds = res.sets || [];
          if (this.availableSetIds.length > 0) {
            this.showSetChoiceModal = true;
          } else {
            this.initializeSkillLevelsAndShowModal(user.skill, user.level);
          }
        },
        error: (err) => {
          console.error('Error checking existing sets:', err);
          this.initializeSkillLevelsAndShowModal(user.skill, user.level);
        }
      });
    } else {
      this.initializeSkillLevelsAndShowModal(user.skill, user.level);
    }
  }

  private initializeSkillLevelsAndShowModal(userSkills: string[], userLevels: string[]): void {
    this.skillLevels = [];
    const skills = Array.isArray(userSkills) ? userSkills : (userSkills ? [userSkills] : []);
    const levels = Array.isArray(userLevels) ? userLevels : (userLevels ? [userLevels] : []);

    if (skills.length > 0 && levels.length > 0) {
      skills.forEach((skill: string) => levels.forEach((level: string) => this.skillLevels.push({ skill, level, count: 1 })));
    } else {
      this.skillLevels.push({ skill: '', level: '', count: 1 });
    }
    this.showAITestModal = true;
  }

  continueWithSet() {
    this.useExistingSet = true;
    this.showSetChoiceModal = false;
    if (!this.selectedSetId) {
      alert('Please select a set first');
      this.showSetChoiceModal = true;
      return;
    }
    if (this.selectedUserForAI) {
      this.initializeSkillLevelsAndShowModal(this.selectedUserForAI.skill, this.selectedUserForAI.level);
    }
  }

  createNewSet() {
    this.useExistingSet = false;
    this.selectedSetId = '';
    this.showSetChoiceModal = false;
    if (this.selectedUserForAI) {
      this.initializeSkillLevelsAndShowModal(this.selectedUserForAI.skill, this.selectedUserForAI.level);
    }
  }

  skipAndAssignAI() {
    if (!this.selectedUserForAI) return;
    this.assignQuizType(this.selectedUserForAI._id, 'ai').then(() => {
      this.closeSetChoiceModal();
      this.getAllUsers();
    }).catch(err => {
      console.error('Failed to assign AI quiz type:', err);
      alert('Failed to assign AI quiz type');
    });
  }

  closeAITestModal() {
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

  addSkillLevel = () => this.skillLevels.push({ skill: '', level: '', count: 1 });
  removeSkillLevel = (index: number) => { if (this.skillLevels.length > 1) this.skillLevels.splice(index, 1); };
  isAITestFormValid = (): boolean => this.skillLevels.every(sl => sl.skill && sl.level && sl.count > 0);

  generateAIQuestions() {
    if (!this.isAITestFormValid() || !this.selectedUserForAI) return;
    this.isGeneratingAIQuestions = true;

    const payload: any = {
      skillLevels: this.skillLevels,
      generatedBy: this.selectedUserForAI._id,
      useExistingSet: this.useExistingSet
    };
    if (this.useExistingSet && this.selectedSetId) {
      payload.setid = this.selectedSetId;
    }

    this.candidateService.generateAIQuestions(payload).subscribe({
      next: () => {
        if (this.selectedUserForAI) {
          this.assignQuizType(this.selectedUserForAI._id, 'ai').then(() => {
            this.showAITestModal = false;
            this.selectedUserForAI = null;
            this.skillLevels = [];
            this.isGeneratingAIQuestions = false;
            this.showSuccessModal = true;
            this.getAllUsers();
            this.cdr.detectChanges();
          });
        }
      },
      error: (error) => {
        console.error('Error generating AI questions:', error);
        this.isGeneratingAIQuestions = false;
        alert('Failed to generate AI questions. Please try again.');
        this.cdr.detectChanges();
      }
    });
  }

  handleSuccessModalAction(shouldRedirect: boolean) {
    this.showSuccessModal = false;
    if (shouldRedirect) {
      window.location.href = '/ai-questions-unified';
    }
  }

  updateAssignedSetImmediate(userId: string, setId: string | null) {
    const userIndex = this.users.findIndex((u: User) => u._id === userId);
    if (userIndex !== -1) {
      this.users[userIndex].assignedSetId = setId;
    }

    this.candidateService.updateAssignedSet(userId, setId).subscribe({
      error: (err: any) => {
        console.error('Backend update failed, reverting UI:', err);
        alert(`Failed to update set. Error: ${err.error?.message || 'Unknown error'}`);
        this.getAllUsers();
      }
    });
  }

  onSetSelectionChange(userId: string, event: Event) {
    const target = event.target as HTMLSelectElement;
    const setIdToSend = target.value === '' ? null : target.value;
    this.updateAssignedSetImmediate(userId, setIdToSend);
  }

  loadUserSets(userId: string): Promise<{ setId: string; label: string }[]> {
    if (this.userSetsLoaded[userId]) {
      return Promise.resolve(this.userSpecificSets[userId] || []);
    }
    return new Promise((resolve) => {
      this.candidateService.getUserSets(userId).subscribe({
        next: (response: { sets: { setId: string; label: string }[] }) => {
          const userSets = response.sets || [];
          this.userSpecificSets[userId] = userSets;
          this.userSetsLoaded[userId] = true;
          resolve(userSets);
        },
        error: (error) => {
          console.error('Error loading user sets:', error);
          this.userSpecificSets[userId] = [];
          this.userSetsLoaded[userId] = true;
          resolve([]);
        }
      });
    });
  }

  getAllUsers() {
    this.loading = true;
    this.candidateService.getUsers(this.currentPage, this.pageSize, this.searchTerm).subscribe({
      next: async (res: { users: User[], totalPages: number, totalUsers: number }) => {
        this.users = res.users;
        this.totalPages = res.totalPages;
        this.totalUsers = res.totalUsers;

        await Promise.all(this.users.map(user =>
          this.userSetsLoaded[user._id] ? Promise.resolve() : this.loadUserSets(user._id).catch(err => console.error(`Failed to load sets for ${user._id}:`, err))
        ));

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch users', err);
        this.loading = false;
      }
    });
  }

  getUserAvailableSets = (userId: string): { setId: string; label: string }[] => this.userSpecificSets[userId] || [];

  getSetDisplayForUser(user: User): string {
    if (!user.assignedSetId) return 'No Set Assigned';
    const userSets = this.getUserAvailableSets(user._id);
    const userSet = userSets.find(s => s.setId === user.assignedSetId);
    return userSet ? userSet.label : 'Unknown Set';
  }

  getSelectedSetIndex = (assignedSetId: string): string => assignedSetId || '';

  loadUserSetsForDropdown(userId: string): void {
    if (!this.userSetsLoaded[userId]) {
      this.loadUserSets(userId).then(() => this.cdr.detectChanges());
    }
  }
  sortResults(field: string): void {
    if (this.sortField === field) {
      // Toggle direction if same field
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to ascending
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    // Sort the current page results
    this.users.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (field) {
        case 'name':
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
          break;
        case 'email':
          valueA = a.email?.toLowerCase() || '';
          valueB = b.email?.toLowerCase() || '';
          break;
        case 'date':
          valueA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          valueB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return '↕'; // Default sort icon
    }
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  validateQuestionCount(index: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = parseInt(target.value) || 0;

    // Enforce limits
    if (value > 10) {
      value = value % 10;
    }

    // Update the skillLevels array
    this.skillLevels[index].count = value;

    // Update the input field value
    target.value = value.toString();
  }
  openNormalQuizConfig(user: User) {
    this.selectedUserForNormal = user;

    // Create skill-level combinations
    this.skillLevelQuestionTypes = [];

    // Get current skills and levels (either from edit form if in edit mode, or from user data)
    let currentSkills: string[] = [];
    let currentLevels: string[] = [];

    if (this.editUserId === user._id && this.editForms[user._id]) {
      // User is in edit mode, use the current edit form data
      currentSkills = this.editForms[user._id].skill || [];
      currentLevels = this.editForms[user._id].level || [];
    } else {
      // User is not in edit mode, use saved data
      currentSkills = Array.isArray(user.skill) ? user.skill : [];
      currentLevels = Array.isArray(user.level) ? user.level : (user.level ? [user.level] : []);
    }

    // Create combinations for all current skill-level pairs
    currentSkills.forEach(skill => {
      currentLevels.forEach(level => {
        // Get the question count - use most up-to-date value from user's questionCounts
        const savedCount = user.questionCounts?.[skill]?.[level] || 0;
        
        // Check if user has existing question type configuration
        const existingConfig = user.questionTypeConfig?.find((config: any) =>
          config.skill === skill && config.level === level
        );

        // If savedCount is 0, default all question types to 0
        if (savedCount === 0) {
          this.skillLevelQuestionTypes.push({
            skill: skill,
            level: level,
            multipleChoice: 0,
            trueFalse: 0,
            singleChoice: 0,
            total: 0
          });
        } else {
          this.skillLevelQuestionTypes.push({
            skill: skill,
            level: level,
            multipleChoice: existingConfig?.multipleChoice || 0,
            trueFalse: existingConfig?.trueFalse || 0,
            singleChoice: existingConfig?.singleChoice || savedCount,
            total: savedCount
          });
        }
      });
    });

    this.showNormalQuizModal = true;
  }

  calculateTotalQuestions(user: User): number {
    if (!user.questionCounts) return 0;

    let total = 0;
    const questionCounts = user.questionCounts;

    Object.keys(questionCounts).forEach(skill => {
      Object.keys(questionCounts[skill]).forEach(level => {
        total += questionCounts[skill][level];
      });
    });
    return total;
  }


  onQuestionTypeChange() {
    const { multipleChoice, trueFalse, totalQuestions } = this.questionTypeConfig;
    this.questionTypeConfig.singleChoice = Math.max(0, totalQuestions - multipleChoice - trueFalse);
  }
  updateQuestionTypeDistribution(index: number) {
    const skillLevel = this.skillLevelQuestionTypes[index];
    const used = skillLevel.multipleChoice + skillLevel.trueFalse;
    skillLevel.singleChoice = Math.max(0, skillLevel.total - used);

    // Validate the inputs
    if (skillLevel.multipleChoice < 0) skillLevel.multipleChoice = 0;
    if (skillLevel.trueFalse < 0) skillLevel.trueFalse = 0;
    if (used > skillLevel.total) {
      // Prioritize multiple choice, then true/false
      if (skillLevel.multipleChoice > skillLevel.total) {
        skillLevel.multipleChoice = skillLevel.total;
        skillLevel.trueFalse = 0;
      } else {
        skillLevel.trueFalse = skillLevel.total - skillLevel.multipleChoice;
      }
      skillLevel.singleChoice = 0;
    }
  }

  validateAllQuestionTypes(): boolean {
    return this.skillLevelQuestionTypes.every(skillLevel => {
      const total = skillLevel.multipleChoice + skillLevel.trueFalse + skillLevel.singleChoice;
      return total === skillLevel.total &&
        skillLevel.multipleChoice >= 0 &&
        skillLevel.trueFalse >= 0 &&
        skillLevel.singleChoice >= 0;
    });
  }

  assignNormalQuizWithTypes() {
    if (!this.selectedUserForNormal || !this.validateAllQuestionTypes()) {
      alert('Invalid question type configuration! Please check your inputs.');
      return;
    }

    // Prepare the question type configuration
    const questionTypeConfig = this.skillLevelQuestionTypes;

    // Store the configuration for this user (you might want to save this to the user model)
    this.candidateService.updateUserQuestionTypeConfig(
      this.selectedUserForNormal._id,
      questionTypeConfig
    ).subscribe({
      next: () => {
        this.assignQuizType(this.selectedUserForNormal!._id, 'normal').then(() => {
          this.closeNormalQuizModal();
          this.getAllUsers();
        }).catch(err => {
          console.error('Failed to assign normal quiz:', err);
          alert('Failed to assign normal quiz');
        });
      },
      error: (err: any) => {
        console.error('Failed to save question type configuration:', err);
        alert('Failed to save configuration');
      }
    });
  }
  validateQuestionTypeAvailability(): boolean {
    return this.skillLevelQuestionTypes.every(skillLevel => {
      const total = skillLevel.multipleChoice + skillLevel.trueFalse + skillLevel.singleChoice;
      return total <= skillLevel.total && total >= 0;
    });
  }

  closeNormalQuizModal() {
    this.showNormalQuizModal = false;
    this.selectedUserForNormal = null;
  }

}