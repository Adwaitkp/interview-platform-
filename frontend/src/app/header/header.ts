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
  isDarkMode: boolean = false;
  showLogoutConfirmation = false;

  constructor(private router: Router, private eRef: ElementRef) { }

  ngOnInit(): void {
    this.name = localStorage.getItem('name') || 'User';
    this.role = localStorage.getItem('role') || '';
    this.updateSidebarWidth();
    this.initializeDarkMode();
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

  // Initialize dark mode from localStorage or default to false
// Initialize dark mode from localStorage or default to false
private initializeDarkMode(): void {
  // Check for saved theme preference or default to 'light'
  const savedTheme = localStorage.getItem('color-theme');
  const legacyDarkMode = localStorage.getItem('darkMode');
  
  // Determine initial dark mode state
  if (savedTheme === 'dark') {
    this.isDarkMode = true;
  } else if (savedTheme === 'light') {
    this.isDarkMode = false;
  } else if (legacyDarkMode === 'true') {
    this.isDarkMode = true;
  } else {
    // Default to light mode
    this.isDarkMode = false;
  }
  
  // Apply the theme immediately
  this.applyDarkMode();
  console.log('[Theme] Initialized. isDarkMode =', this.isDarkMode);
}

// Toggle dark mode
toggleDarkMode(): void {
  this.isDarkMode = !this.isDarkMode;
  localStorage.setItem('color-theme', this.isDarkMode ? 'dark' : 'light');
  
  // Remove legacy key if it exists
  localStorage.removeItem('darkMode');
  
  this.applyDarkMode();
}


private applyDarkMode(): void {
  const html = document.documentElement;

  if (this.isDarkMode) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // Debugging log to confirm the class is present (you can remove later)
  setTimeout(() => {
    console.log('[Theme] Applied. html.classList =', html.className);
  }, 50);
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

  confirmLogout(): void {
    this.showLogoutConfirmation = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirmation = false;
  }

  proceedToLogout(): void {
  this.showLogoutConfirmation = false;
  
  // Get current user ID to preserve their specific quiz state
  const userId = localStorage.getItem('intervieweeId') || 'anon';
  
  // Preserve ALL user-specific quiz state keys (with userId suffix)
  const userSpecificKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.endsWith(`_${userId}`)) {
      userSpecificKeys.push(key);
    }
  }
  
  // Also preserve these general keys
  const generalKeys = ['skill', 'level', 'questionCounts'];
  
  // Store all data we want to preserve
  const preservedState: { [key: string]: string | null } = {};
  
  userSpecificKeys.forEach(key => {
    preservedState[key] = localStorage.getItem(key);
  });
  
  generalKeys.forEach(key => {
    preservedState[key] = localStorage.getItem(key);
  });

  // Clear only auth-related items instead of clearing everything
  const authKeys = ['token', 'name', 'email', 'role', 'intervieweeId', 'color-theme'];
  authKeys.forEach(key => {
    localStorage.removeItem(key);
  });

  // Restore preserved quiz state
  Object.entries(preservedState).forEach(([key, value]) => {
    if (value !== null) {
      localStorage.setItem(key, value);
    }
  });

  this.router.navigate(['/login']);
  this.sidebarExpanded = true;
}

}