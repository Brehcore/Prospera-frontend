import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainingService, TrainingCatalogItemDTO, EnrollmentResponseDTO } from '../../core/services/training.service';
import { CatalogService, CatalogItem } from '../../core/services/catalog.service';
import { CatalogModalService } from '../../core/services/catalog-modal.service';
import { take } from 'rxjs';

@Component({
  selector: 'pros-trainings',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="trainings-page">
    <div class="container">
      <h1>Treinamentos</h1>

      <div class="loading" *ngIf="loading()">
        <span class="spinner" aria-hidden="true"></span>
        <p>Carregando catálogo de treinamentos…</p>
      </div>
    </div>

    <div *ngIf="!loading()">
      <div *ngIf="(catalog()?.length ?? 0) > 0">
        <div class="training-catalog-grid">
            <article class="training-card" *ngFor="let t of (catalog() || []); trackBy: trackById">
              <div class="training-image">
                <img
                  *ngIf="t.coverImageUrl"
                  [src]="t.coverImageUrl"
                  [alt]="t.title || 'Capa do treinamento'"
                  class="cover"
                />
                <div *ngIf="!t.coverImageUrl" class="cover-placeholder">
                  <i class="fas fa-graduation-cap" aria-hidden="true"></i>
                </div>
              </div>
              <div class="training-content">
                <h3 class="training-title">{{ t.title }}</h3>
                <div class="training-meta-items">
                  <p class="meta-item" *ngIf="t.description">
                    <i class="fas fa-book" aria-hidden="true"></i>
                    {{ t.description }}
                  </p>
                </div>
              </div>
              <div class="training-actions">
                <button class="btn btn-secondary" (click)="$event.stopPropagation()" disabled>Detalhes</button>
                <button class="btn btn-primary" (click)="enroll(t.id)" [disabled]="isEnrolled(t.id)">
                  {{ isEnrolled(t.id) ? 'Matriculado' : 'Matricular' }}
                </button>
              </div>
            </article>
          </div>
      </div>

      <ng-container *ngIf="(catalog()?.length ?? 0) === 0">
        <div *ngIf="(myEnrollments()?.length ?? 0) > 0" class="training-catalog-grid">
            <article class="training-card" *ngFor="let e of (myEnrollments() || [])" (click)="openTraining(e)" role="button" tabindex="0">
              <div class="training-image">
                <img
                  *ngIf="e.coverImageUrl"
                  [src]="e.coverImageUrl"
                  [alt]="e.trainingTitle || 'Capa do treinamento'"
                  class="cover"
                />
                <div *ngIf="!e.coverImageUrl" class="cover-placeholder">
                  <i class="fas fa-graduation-cap" aria-hidden="true"></i>
                </div>
              </div>
              <div class="training-content">
                <h3 class="training-title">{{ e.trainingTitle || 'Treinamento' }}</h3>
                <div class="training-meta-items">
                  <p class="meta-item">
                    <i class="fas fa-building" aria-hidden="true"></i>
                    Go-Tree Consultoria
                  </p>
                  <p class="meta-item">
                    <i class="fas fa-calendar" aria-hidden="true"></i>
                    {{ e.enrolledAt | date:'dd/MM/yyyy' }}
                  </p>
                  <p class="meta-item" *ngIf="e.progressPercentage !== undefined && e.progressPercentage !== null">
                    <i class="fas fa-chart-pie" aria-hidden="true"></i>
                    {{ e.progressPercentage }}% completo
                  </p>
                </div>
              </div>
              <div class="training-actions">
                <button class="btn btn-secondary" (click)="$event.stopPropagation(); openDetails(e)">Detalhes</button>
                <button class="btn btn-primary" (click)="$event.stopPropagation(); openTraining(e)">Acessar</button>
              </div>
              <div class="training-progress-wrap" *ngIf="e.progressPercentage !== undefined && e.progressPercentage !== null">
                <div class="training-progress-bar">
                  <div class="training-progress-fill" [style.width.%]="e.progressPercentage"></div>
                </div>
              </div>
            </article>
          </div>

        <div *ngIf="(myEnrollments()?.length ?? 0) === 0" class="container">
          <div class="empty">
            <p>Nenhum treinamento disponível para você no momento.</p>
          </div>
        </div>
      </ng-container>

      <div *ngIf="error()" class="container">
        <div class="error">
          <p>{{ error() }}</p>
          <button class="btn btn-secondary" (click)="load()">Recarregar</button>
        </div>
      </div>
    </div>
  </section>
  `,
  styles: [],
  styleUrls: ['../../shared/styles/training-card.scss']
})
export class TrainingsComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly catalogModal = inject(CatalogModalService);

  readonly catalog = signal<TrainingCatalogItemDTO[] | null>(null);
  readonly loading = computed(() => this.catalog() === null);
  readonly error = signal<string | null>(null);

  readonly myEnrollments = signal<EnrollmentResponseDTO[] | null>(null);

  ngOnInit(): void {
    this.load();
    this.loadEnrollments();
  }

  openTraining(enrollment: EnrollmentResponseDTO) {
    const id = enrollment.trainingId || enrollment.enrollmentId || '';
    if (!id) return;
    // Abrir página de detalhe do treinamento para usuários logados
    this.router.navigate(['/treinamento', id]);
  }

  openDetails(enrollment: EnrollmentResponseDTO) {
    const id = enrollment.trainingId || enrollment.enrollmentId || '';
    if (!id) return;
    this.catalogService.loadCatalog().pipe(take(1)).subscribe({
      next: (items: CatalogItem[]) => {
        const found = (items || []).find(i => i.id === id);
        if (found) {
          this.catalogModal.open(found);
        } else {
          this.router.navigate(['/catalog'], { queryParams: { id } });
        }
      },
      error: () => this.router.navigate(['/catalog'], { queryParams: { id } })
    });
  }

  load() {
    this.catalog.set(null);
    this.error.set(null);
    this.trainingService.getMyCatalog().subscribe({
      next: items => this.catalog.set(items || []),
      error: err => {
        console.warn('[Trainings] erro ao carregar catálogo', err);
        this.catalog.set([]);
        this.error.set('Erro ao carregar catálogo de treinamentos.');
      }
    });
  }

  enroll(trainingId: string) {
    this.trainingService.enrollInTraining(trainingId).subscribe({
      next: resp => {
        const current = this.myEnrollments() ?? [];
        this.myEnrollments.set([...(current || []), resp]);
        console.debug('[Trainings] matriculado', resp);
      },
      error: err => console.warn('[Trainings] erro ao matricular', err)
    });
  }

  loadEnrollments() {
    this.myEnrollments.set(null);
    this.trainingService.getMyEnrollments().subscribe({
      next: items => this.myEnrollments.set(items || []),
      error: err => { console.warn('[Trainings] erro ao carregar matrículas', err); this.myEnrollments.set([]); }
    });
  }

  isEnrolled(trainingId: string) {
    const e = this.myEnrollments() ?? [];
    return e.some(x => x.trainingId === trainingId);
  }

  trackById(_: number, item: TrainingCatalogItemDTO) { return item?.id; }
}
