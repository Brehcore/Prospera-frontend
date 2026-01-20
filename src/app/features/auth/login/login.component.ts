import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'pros-auth-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  activeTab: 'login' | 'register' | 'forgot-password' = 'login';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  forgotPasswordSuccess = false;

  private readonly fb = inject(FormBuilder);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly registerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  selectTab(tab: 'login' | 'register' | 'forgot-password'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab !== 'forgot-password') {
      this.forgotPasswordSuccess = false;
    }
  }

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.authService
      .login(this.loginForm.getRawValue())
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => this.router.navigate(['/conta']),
        error: error => {
          // Prefer server-provided message in the JSON body: error.error.message
          const serverMsg = error?.error?.message || error?.error || error?.message || 'Não foi possível entrar. Verifique suas credenciais.';
          this.errorMessage = String(serverMsg);
        }
      });
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.authService
      .register(this.registerForm.getRawValue())
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          // Primeiro muda para a aba 'login' (que limpa mensagens de erro),
          // depois definimos a mensagem de sucesso para que ela persista na aba de login.
          this.selectTab('login');
          this.successMessage = 'Cadastro realizado com sucesso! Você já pode entrar com seu e-mail e senha.';
          this.loginForm.patchValue({ email: this.registerForm.value.email ?? '' });
        },
        error: error => {
          this.errorMessage = error?.message || 'Não foi possível criar sua conta. Tente novamente mais tarde.';
        }
      });
  }

  submitForgotPassword(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService
      .forgotPassword(this.forgotPasswordForm.getRawValue())
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Verifique sua caixa de entrada e pasta de spam.';
          this.forgotPasswordSuccess = true;
          this.forgotPasswordForm.disable();
        },
        error: () => {
          // Mesmo em caso de erro, mostramos a mensagem de segurança
          this.successMessage = 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Verifique sua caixa de entrada e pasta de spam.';
          this.forgotPasswordSuccess = true;
          this.forgotPasswordForm.disable();
        }
      });
  }

  resetForgotPasswordForm(): void {
    this.forgotPasswordForm.enable();
    this.forgotPasswordForm.reset();
    this.successMessage = '';
    this.errorMessage = '';
    this.forgotPasswordSuccess = false;
  }
}

