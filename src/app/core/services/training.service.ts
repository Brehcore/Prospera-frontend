import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

export interface TrainingCatalogItemDTO {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes?: number | null;
  provider?: string | null;
  coverImageUrl?: string | null;
  tags?: string[];
}

export interface EnrollmentResponseDTO {
  id?: string;
  enrollmentId?: string;
  trainingId: string;
  userId?: string;
  trainingTitle: string;
  enrolledAt: string;
  status: string;
  coverImageUrl?: string | null;
  progressPercentage?: number | null;
  entityType?: string;
}

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  constructor(private readonly api: ApiService) {}

  // GET /trainings/catalog
  getMyCatalog(): Observable<TrainingCatalogItemDTO[]> {
    return this.api.get<TrainingCatalogItemDTO[]>('/trainings/catalog');
  }

  // POST /trainings/{trainingId}/enroll
  enrollInTraining(trainingId: string): Observable<EnrollmentResponseDTO> {
    return this.api.post<EnrollmentResponseDTO>(`/trainings/${trainingId}/enroll`, {});
  }

  // POST /trainings/lessons/{lessonId}/complete
  markLessonAsCompleted(lessonId: string): Observable<void> {
    return this.api.post<void>(`/trainings/lessons/${lessonId}/complete`, {});
  }

  // GET /trainings/my-enrollments
  getMyEnrollments(): Observable<EnrollmentResponseDTO[]> {
    return this.api.get<EnrollmentResponseDTO[]>('/trainings/my-enrollments');
  }

  // GET /trainings/{trainingId}/modules
  getModules(trainingId: string): Observable<any[]> {
    return this.api.get<any[]>(`/trainings/${trainingId}/modules`);
  }

  // GET /stream/ebooks/{trainingId} -> returns blob (PDF/ebook)
  getEbookBlob(trainingId: string): Observable<Blob> {
    const token = this.auth.getToken();
    const url = this.api.createUrl(`/stream/ebooks/${trainingId}`);
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get(url, { headers, responseType: 'blob' as 'blob' });
  }

  // GET /api/lessons/{lessonId}
  getLesson(lessonId: string): Observable<LessonDTO> {
    return this.api.get<LessonDTO>(`/api/lessons/${lessonId}`);
  }

  // GET /api/lessons/{lessonId}/next
  getNextLesson(lessonId: string): Observable<LessonDTO | null> {
    return this.api.get<LessonDTO | null>(`/api/lessons/${lessonId}/next`);
  }

  // GET /api/lessons/{lessonId}/previous
  getPreviousLesson(lessonId: string): Observable<LessonDTO | null> {
    return this.api.get<LessonDTO | null>(`/api/lessons/${lessonId}/previous`);
  }

  // POST /api/lessons/{lessonId}/complete
  completeLessonFromApi(lessonId: string): Observable<void> {
    return this.api.post<void>(`/api/lessons/${lessonId}/complete`, {});
  }

  // GET /progress/ebooks/{trainingId}
  getEbookProgress(trainingId: string): Observable<EbookProgressDTO> {
    return this.api.get<EbookProgressDTO>(`/progress/ebooks/${trainingId}`);
  }

  // PUT /progress/ebooks/{trainingId}
  updateEbookProgress(trainingId: string, lastPageRead: number): Observable<void> {
    return this.api.put<void>(`/progress/ebooks/${trainingId}`, { lastPageRead });
  }
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
  trainingId: string;
  userId: string;
  lastPageRead: number;
  totalPages?: number;
  progressPercentage?: number;
}
