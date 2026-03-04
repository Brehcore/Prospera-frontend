import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class LessonService {
  private readonly api = inject(ApiService);

  /**
   * Marca uma lição como concluída no backend
   * POST /lessons/{lessonId}/complete
   * 
   * Isso cria um registro em LessonProgress e atualiza o progresso do curso
   * 
   * @param lessonId - ID da lição concluída
   * @returns Observable do resultado da requisição
   */
  markLessonAsCompleted(lessonId: string): Observable<any> {
    console.log('[LessonService] Marcando lição como concluída:', { lessonId });
    const url = `/lessons/${encodeURIComponent(lessonId)}/complete`;
    
    // POST com body vazio - o userId vem do token no interceptor
    return this.api.post<any>(url, {});
  }
}
