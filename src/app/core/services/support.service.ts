import { Injectable } from '@angular/core';
import { catchError, map, of, throwError } from 'rxjs';
import { HttpContext } from '@angular/common/http';

import { ApiService } from './api.service';
import { SKIP_AUTH } from '../http.tokens';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface SupportTicket {
  name: string;
  userEmail: string;
  subject: string;
  message: string;
}

interface SupportResponse {
  success?: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  constructor(private readonly api: ApiService) {}

  sendContactMessage(payload: ContactMessage) {
    const url = this.api.createPublicUrl('/support/contact');
    const context = new HttpContext().set(SKIP_AUTH, true);
    return this.api.post<SupportResponse>(url, payload, { context }).pipe(
      map(response => ({ success: response?.success ?? true, message: response?.message ?? 'Mensagem enviada.' })),
      catchError(error => {
        const fallbackMessage = error?.error?.message ?? 'Não foi possível enviar sua mensagem agora.';
        return throwError(() => new Error(fallbackMessage));
      })
    );
  }

  openSupportTicket(payload: SupportTicket) {
    const url = this.api.createPublicUrl('/support/tickets');
    const context = new HttpContext().set(SKIP_AUTH, true);
    return this.api.post<SupportResponse>(url, payload, { context }).pipe(
      map(response => ({ success: response?.success ?? true, message: response?.message ?? 'Chamado registrado.' })),
      catchError(error => {
        const fallbackMessage = error?.error?.message ?? 'Não foi possível registrar o chamado.';
        return throwError(() => new Error(fallbackMessage));
      })
    );
  }

  getSupportTopics() {
    return of([
      { id: 'access', label: 'Dificuldades de acesso' },
      { id: 'content', label: 'Conteúdos e certificações' },
      { id: 'billing', label: 'Financeiro e faturamento' },
      { id: 'platform', label: 'Instabilidades na plataforma' },
      { id: 'other', label: 'Outros assuntos' }
    ]);
  }
}
