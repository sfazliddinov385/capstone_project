import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../authentication.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  standalone: false
})
export class Login {
  loginForm: FormGroup;
  errorMessage = '';
  signingIn   = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.signingIn) return;
    const { email, password } = this.loginForm.value;
    this.signingIn = true;
    this.errorMessage = '';
    this.authService.login(email, password).subscribe({
      next: () => { this.signingIn = false; this.router.navigate(['/']); },
      error: err => {
        this.signingIn = false;
        this.errorMessage = err.error?.message || 'Login failed. Please try again.';
      }
    });
  }
}
