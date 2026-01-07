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

  // GET /stream/ebooks/{trainingId} -> returns blob (PDF/ebook)
  getEbookBlob(trainingId: string): Observable<Blob> {
    const token = this.auth.getToken();
    const url = this.api.createUrl(`/stream/ebooks/${trainingId}`);
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get(url, { headers, responseType: 'blob' as 'blob' });
  }
}
