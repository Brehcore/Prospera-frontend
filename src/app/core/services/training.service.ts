import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

export interface TrainingCatalogItemDTO {
  id: string;
  title: string;
  description?: string | null;
  author?: string | null;
  entityType: string;
  type: string;
  enrollmentStatus: string;
  coverImageUrl?: string | null;
  sectorNames?: string[] | null;
}

export interface EnrollmentResponseDTO {
  id?: string;
  enrollmentId?: string;
  trainingId: string;
  trainingTitle: string;
  enrolledAt: string;
  status: string;
  coverImageUrl?: string | null;
  progressPercentage?: number | null;
  certificateId?: string | null;
  validationCode?: string | null;
  userRating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
}

export interface LessonDTO {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  lessonOrder: number;
  isCompleted?: boolean;
}

export interface EbookProgressDTO {
  lastPageRead: number;
  totalPages?: number;
  progressPercentage?: number;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  constructor(private readonly api: ApiService) {}

  // Catálogo Público / B2B
  getMyCatalog(): Observable<TrainingCatalogItemDTO[]> {
    return this.api.get<TrainingCatalogItemDTO[]>('/trainings/catalog'); // Rota corrigida
  }

  // Matrícula Self-Service
  enrollInTraining(trainingId: string): Observable<EnrollmentResponseDTO> {
    if (!trainingId) throw new Error('trainingId is required for enrollment');
    return this.api.post<EnrollmentResponseDTO>(`/enrollments/${encodeURIComponent(trainingId)}`, {});
  }

  // Listar Matrículas do Usuário
  getMyEnrollments(): Observable<EnrollmentResponseDTO[]> {
    return this.api.get<EnrollmentResponseDTO[]>('/trainings/my-enrollments'); // Rota corrigida
  }

  // Buscar Módulos de um Treinamento
  getModules(trainingId: string): Observable<any[]> {
    return this.api.get<any[]>(`/trainings/${trainingId}/modules`); // Rota corrigida
  }

  // Download Seguro do E-book
  getEbookBlob(trainingId: string): Observable<Blob> {
    const token = this.auth.getToken();
    const url = this.api.createUrl(`/stream/ebooks/${trainingId}`);
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get(url, { headers, responseType: 'blob' as 'blob' });
  }

  // PLAYER DE AULAS
  getLesson(lessonId: string): Observable<LessonDTO> {
    return this.api.get<LessonDTO>(`/lessons/${lessonId}`);
  }

  getNextLesson(lessonId: string): Observable<LessonDTO | null> {
    return this.api.get<LessonDTO | null>(`/lessons/${lessonId}/next`);
  }

  getPreviousLesson(lessonId: string): Observable<LessonDTO | null> {
    return this.api.get<LessonDTO | null>(`/lessons/${lessonId}/previous`);
  }

  // Método unificado e correto para concluir aula
  completeLesson(lessonId: string): Observable<void> {
    return this.api.post<void>(`/lessons/${lessonId}/complete`, {});
  }

  // Compatibilidade retroativa: alguns componentes ainda chamam este método
  markLessonAsCompleted(lessonId: string): Observable<void> {
    return this.completeLesson(lessonId);
  }

  // PROGRESSO DE E-BOOK
  getEbookProgress(trainingId: string): Observable<EbookProgressDTO> {
    return this.api.get<EbookProgressDTO>(`/progress/ebooks/${trainingId}`); // Rota corrigida
  }

  updateEbookProgress(trainingId: string, lastPageRead: number): Observable<void> {
    return this.api.put<void>(`/progress/ebooks/${trainingId}`, { lastPageRead }); // Rota corrigida
  }
}
