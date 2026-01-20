import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'pros-auth-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  tokenInvalid = false;
  isSuccess = false;

  private token: string | null = null;
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly resetForm = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.passwordMatchValidator() }
  );

  ngOnInit(): void {
    // Extrair token da URL
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || null;

      if (!this.token) {
        this.tokenInvalid = true;
        this.errorMessage = 'Token ausente. Link inválido ou expirado.';
        // Redirecionar após 2 segundos
        setTimeout(() => this.goBackToLogin(), 2000);
      }
    });
  }

  passwordMatchValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const newPassword = control.get('newPassword');
      const confirmPassword = control.get('confirmPassword');

      if (!newPassword || !confirmPassword) {
        return null;
      }

      return newPassword.value === confirmPassword.value ? null : { passwordMismatch: true };
    };
  }

  getPasswordMatchError(): boolean {
    return this.resetForm.hasError('passwordMismatch') && this.resetForm.touched;
  }

  submitResetPassword(): void {
    if (this.resetForm.invalid || !this.token) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService
      .resetPassword({
        token: this.token,
        newPassword: this.resetForm.get('newPassword')?.value || ''
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Senha alterada com sucesso! Redirecionando para o login...';
          this.isSuccess = true;
          this.resetForm.disable();
          // Redirecionar após 2 segundos
          setTimeout(() => this.goBackToLogin(), 2000);
        },
        error: (error) => {
          const serverMsg = error?.error?.message || error?.error || error?.message;

          if (error?.status === 400 || error?.status === 401 || error?.status === 403) {
            this.errorMessage = 'Este link expirou ou é inválido. Por favor, solicite uma nova redefinição.';
            this.tokenInvalid = true;
          } else {
            this.errorMessage = serverMsg || 'Erro ao redefinir a senha. Tente novamente.';
          }
        }
      });
  }

  goBackToLogin(): void {
    this.router.navigate(['']);
  }
}
