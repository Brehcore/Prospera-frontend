import { CommonModule, AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SupportService } from '../../core/services/support.service';

interface ContactChannel {
  icon: string;
  title: string;
  description: string;
  value: string;
  link?: string;
}

@Component({
  selector: 'pros-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AsyncPipe, RouterLink],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent {
  private readonly fb = inject(FormBuilder);
  private readonly supportService = inject(SupportService);

  readonly topics$ = this.supportService.getSupportTopics();

  readonly supportSubjects = [
    { label: 'Dificuldades de acesso', value: 'ACCESS_DIFFICULTIES' },
    { label: 'Conteúdos e Certificações', value: 'CONTENT_CERTIFICATIONS' },
    { label: 'Financeiro e Faturamento', value: 'FINANCIAL_BILLING' },
    { label: 'Instabilidade na Plataforma', value: 'PLATFORM_INSTABILITY' },
    { label: 'Outros assuntos', value: 'OTHER' }
  ];

  readonly contactChannels: ContactChannel[] = [
    {
      icon: 'fa-envelope',
      title: 'E-mail',
      description: 'Resposta em até 24 horas',
      value: 'suporte@prospera.com.br',
      link: 'mailto:suporte@prospera.com.br'
    },
    {
      icon: 'fa-envelope',
      title: 'E-mail Comercial',
      description: 'Para propostas e parcerias',
      value: 'contato@gotreeconsultoria.com.br',
      link: 'mailto:contato@gotreeconsultoria.com.br'
    },
    {
      icon: 'fa-phone',
      title: 'Telefone',
      description: 'Seg-Sex, 9h-18h',
      value: '+55 (81) 98944-4164',
      link: 'https://wa.me/5581989444164'
    },
    // Chat ao Vivo foi movido para o componente flutuante
  ];

  readonly supportForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    userEmail: ['', [Validators.required, Validators.email]],
    subject: [this.supportSubjects[0].value, Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]]
  });

  snackbarVisible = false;
  snackbarMessage = '';

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  showSnackbar(message: string, duration = 5000): void {
    this.snackbarMessage = message;
    this.snackbarVisible = true;
    setTimeout(() => (this.snackbarVisible = false), duration);
  }

  submit(): void {
    if (this.supportForm.invalid) {
      this.supportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = this.supportForm.getRawValue();

    // Usar fetch() para evitar o HttpInterceptor que adicionaria JWT (rota pública)
    fetch('http://localhost:8080/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        this.isSubmitting = false;
        if (res.ok) {
          this.supportForm.reset({ subject: this.supportSubjects[0].value });
          this.showSnackbar('Sua solicitação foi enviada com sucesso. Nossa equipe entrará em contato em breve.');
        } else {
          const err = await res.json().catch(() => null);
          this.errorMessage = (err && err.message) || `Erro: ${res.status} ${res.statusText}`;
        }
      })
      .catch(err => {
        this.isSubmitting = false;
        this.errorMessage = err?.message ?? 'Não foi possível registrar o chamado.';
      });
  }
}
