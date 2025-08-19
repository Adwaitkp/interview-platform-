
import { Component, ElementRef, HostListener, ViewChild, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-add-interviewee',
  templateUrl: './add-interviewee.html',
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true
})
export class AddIntervieweeComponent implements AfterViewInit {
  @Output() onSuccess = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  form: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  loading = false;
  submitError: string | null = null;
  onSuccessMessage: string | null = null;
  showSkillDropdown = false;
  selectedSkills: string[] = [];
  selectedLevels: string[] = [];
  questionCounts: { [skill: string]: { [level: string]: number } } = {};
  showLevelDropdown = false;

  skillOptions: string[] = [
    'Node.js', 'React', 'Angular', 'MongoDB', 'PostgreSQL',
    'Next.js', 'Django', 'Git', 'Docker', 'TypeScript'
  ];

  levelOptions: string[] = [
    'Beginner', 'Intermediate', 'Advanced'
  ];

  get availableSkills(): string[] {
    return this.skillOptions;
  }

  @ViewChild('skillDropdown') skillDropdownRef!: ElementRef;
  @ViewChild('levelDropdown') levelDropdownRef!: ElementRef;

  constructor(private fb: FormBuilder, private http: HttpClient, private elementRef: ElementRef) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      skill: [[], Validators.required], // Multi-select field
      level: [[], Validators.required] // Change to multi-select
    }, { validators: this.passwordsMatchValidator });

    // Initialize selectedSkills from form value
    this.form.get('skill')?.valueChanges.subscribe(values => {
      this.selectedSkills = values || [];
      this.updateQuestionCounts();
    });
    this.form.get('level')?.valueChanges.subscribe(values => {
      this.selectedLevels = values || [];
      this.updateQuestionCounts();
    });
  }

  // Custom validator for password match
  passwordsMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordsMismatch: true };
  }

  get name() { return this.form.get('name'); }
  get email() { return this.form.get('email'); }
  get password() { return this.form.get('password'); }
  get confirmPassword() { return this.form.get('confirmPassword'); }
  get skill() { return this.form.get('skill'); }
  get level() { return this.form.get('level'); }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  toggleShowConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  toggleSkillDropdown(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.showSkillDropdown = !this.showSkillDropdown;
    this.showLevelDropdown = false;
  }

  closeSkillDropdown() {
    this.showSkillDropdown = false;
  }

  toggleLevelDropdown(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.showLevelDropdown = !this.showLevelDropdown;
    this.showSkillDropdown = false;
  }

  closeLevelDropdown() {
    this.showLevelDropdown = false;
  }
  closeAllDropdowns() {
    this.showSkillDropdown = false;
    this.showLevelDropdown = false;
  }
  // Initialize after view is ready
  ngAfterViewInit() {

  }

  // Listen for clicks on the document
  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent) {
    // Skill dropdown
    if (this.skillDropdownRef && this.showSkillDropdown) {
      const clickedInside = this.skillDropdownRef.nativeElement.contains(event.target);
      if (!clickedInside) {
        this.closeSkillDropdown();
      }
    }
    // Level dropdown
    if (this.levelDropdownRef && this.showLevelDropdown) {
      const clickedInside = this.levelDropdownRef.nativeElement.contains(event.target);
      if (!clickedInside) {
        this.closeLevelDropdown();
      }
    }
  }

  toggleSkillSelection(skill: string, event: MouseEvent) {
    // Prevent default behavior (context menu for right-click)
    event.preventDefault();
    event.stopPropagation();

    const currentSkills = [...this.selectedSkills];
    const index = currentSkills.indexOf(skill);

    if (index === -1) {
      currentSkills.push(skill);
    } else {
      currentSkills.splice(index, 1);
    }

    this.selectedSkills = currentSkills;
    this.form.get('skill')?.setValue(currentSkills);
    return false; // Prevent default context menu
  }

  removeSkill(skill: string, event: MouseEvent) {
    event.stopPropagation(); // Prevent dropdown from opening
    const currentSkills = [...this.selectedSkills];
    const index = currentSkills.indexOf(skill);

    if (index !== -1) {
      currentSkills.splice(index, 1);
      this.selectedSkills = currentSkills;
      this.form.get('skill')?.setValue(currentSkills);
    }
  }

  isSkillSelected(skill: string): boolean {
    return this.selectedSkills.includes(skill);
  }

  toggleLevelSelection(level: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const currentLevels = [...this.selectedLevels];
    const index = currentLevels.indexOf(level);
    if (index === -1) {
      currentLevels.push(level);
    } else {
      currentLevels.splice(index, 1);
    }
    this.selectedLevels = currentLevels;
    this.form.get('level')?.setValue(currentLevels);
    return false;
  }

  removeLevel(level: string, event: MouseEvent) {
    event.stopPropagation();
    const currentLevels = [...this.selectedLevels];
    const index = currentLevels.indexOf(level);
    if (index !== -1) {
      currentLevels.splice(index, 1);
      this.selectedLevels = currentLevels;
      this.form.get('level')?.setValue(currentLevels);
    }
  }

  isLevelSelected(level: string): boolean {
    return this.selectedLevels.includes(level);
  }

  updateQuestionCounts() {
    // Ensure questionCounts has an entry for each selected skill and level
    for (const skill of this.selectedSkills) {
      if (!this.questionCounts[skill]) {
        this.questionCounts[skill] = {};
      }
      for (const level of this.selectedLevels) {
        if (this.questionCounts[skill][level] == null) {
          this.questionCounts[skill][level] = 5; // default value
        }
      }
    }
    // Remove unselected skills/levels
    for (const skill of Object.keys(this.questionCounts)) {
      if (!this.selectedSkills.includes(skill)) {
        delete this.questionCounts[skill];
      } else {
        for (const level of Object.keys(this.questionCounts[skill])) {
          if (!this.selectedLevels.includes(level)) {
            delete this.questionCounts[skill][level];
          }
        }
      }
    }
  }

  onQuestionCountChange(skill: string, level: string, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      this.questionCounts[skill][level] = num;
    }
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.submitError = null;
    this.onSuccessMessage = null;
    const body = {
      name: this.form.value.name,
      email: this.form.value.email,
      password: this.form.value.password,
      confirmPassword: this.form.value.confirmPassword,
      role: 'interviewee',
      skill: this.form.value.skill, // Will be an array (multi-select)
      level: this.form.value.level, // Now an array
      questionCounts: this.questionCounts // <-- include in payload
    };
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
    this.http.post(`${environment.apiUrl}/admin/addinterviewee`, body, { headers })
      .subscribe({
        next: (res) => {
          this.onSuccessMessage = 'User created successfully!';
          this.form.reset();
          this.form.controls['skill'].setValue([]);
          this.form.controls['level'].setValue([]);
          this.questionCounts = {};
          this.selectedSkills = [];
          this.selectedLevels = [];
          setTimeout(() => this.onSuccessMessage = null, 1500);
          // Emit success event to refresh the user list
          this.onSuccess.emit();
        },
        error: (err) => {
          this.submitError = err.error?.message || 'Something went wrong. Please try again.';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
  }
}
