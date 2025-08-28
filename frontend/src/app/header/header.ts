import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html'
})
export class HeaderComponent implements OnInit {
  // profileOpen = false;

  name: string = '';
  role: string = '';
  sidebarExpanded: boolean = false; // Start expanded by default

  constructor(private router: Router, private eRef: ElementRef) { }

  ngOnInit(): void {
    this.name = localStorage.getItem('name') || 'User';
    this.role = localStorage.getItem('role') || '';
    this.updateSidebarWidth();
  }

  // Toggle sidebar between expanded and collapsed
  toggleSidebar(): void {
    this.sidebarExpanded = !this.sidebarExpanded;
    this.updateSidebarWidth();
    
    // Close profile dropdown when toggling sidebar
    // if (this.profileOpen) {
    //   this.profileOpen = false;
    // }
  }

  // Update CSS custom property for sidebar width
  private updateSidebarWidth(): void {
    const width = this.sidebarExpanded ? '16rem' : '4rem';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }

  navigateTo(target: string): void {
    switch (target) {
      case 'admin-dashboard':
        this.router.navigate(['/admin-dashboard']);
        break;
      case 'candidate-management':
        this.router.navigate(['/candidate-management']);
        break;
      case 'questions':
        this.router.navigate(['/questions']); // Keep this - for normal questions
        break;
      case 'ai-questions':
        this.router.navigate(['/ai-questions-unified']); // CHANGE THIS LINE
        break;
      default:
        break;
    }
    // this.profileOpen = false;
    // Don't close sidebar when navigating - keep it in current state
  }

  logout(): void {
    // Preserve quiz state during logout
    const quizStateKeys = [
      // Normal quiz keys
      'questionTimers',
      'currentQuestionIndex',
      'lockedQuestions',
      'selectedOptions',
      'userAnswers', // <-- added for answer persistence
      'testStarted',
      'quizCompleted',
      'allQuestions',
      // AI quiz keys
      'aiQuestionTimers',
      'aiCurrentQuestionIndex',
      'aiLockedQuestions',
      'aiSelectedOptions',
      'aiTestStarted',
      'aiQuizCompleted',
      // Common keys
      'skill',
      'level',
      'questionCounts'
    ];

    const preservedState: { [key: string]: string | null } = {};
    quizStateKeys.forEach(key => {
      preservedState[key] = localStorage.getItem(key);
    });

    localStorage.clear();

    // Restore quiz state
    Object.entries(preservedState).forEach(([key, value]) => {
      if (value !== null) {
        localStorage.setItem(key, value);
      }
    });

    this.router.navigate(['/login']);
    // this.profileOpen = false;
    this.sidebarExpanded = true; // Reset to expanded for next login
  }


  // @HostListener('document:mousedown', ['$event'])
  // clickout(event: MouseEvent): void {
  //   if (this.profileOpen && !this.eRef.nativeElement.contains(event.target)) {
  //     this.profileOpen = false;
  //   }
  //   // Remove auto-close behavior for sidebar - let user control it manually
  // }
}