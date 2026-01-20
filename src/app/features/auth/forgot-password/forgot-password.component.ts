import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'pros-auth-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  isSubmitted = false;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

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
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Verifique sua caixa de entrada e pasta de spam.';
          this.isSubmitted = true;
          this.forgotPasswordForm.disable();
        },
        error: () => {
          // Mesmo em caso de erro, mostramos a mensagem de segurança
          this.successMessage = 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Verifique sua caixa de entrada e pasta de spam.';
          this.isSubmitted = true;
          this.forgotPasswordForm.disable();
        }
      });
  }

  goBackToLogin(): void {
    this.router.navigate(['']);
  }

  resetForm(): void {
    this.forgotPasswordForm.enable();
    this.forgotPasswordForm.reset();
    this.successMessage = '';
    this.errorMessage = '';
    this.isSubmitted = false;
  }
}
