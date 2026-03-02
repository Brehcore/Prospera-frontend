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
                  <ng-container *ngIf="findEnrollment(t.id || t['trainingId']) as en; else showDescription">
                    <p class="meta-item">
                      <i class="fas fa-book" aria-hidden="true"></i>
                      {{ (en.progressPercentage !== undefined && en.progressPercentage !== null) ? (en.progressPercentage + '% completo') : '0% completo' }}
                    </p>
                  </ng-container>
                  <ng-template #showDescription>
                    <p class="meta-item" *ngIf="t.description">
                      <i class="fas fa-book" aria-hidden="true"></i>
                      {{ t.description }}
                    </p>
                  </ng-template>
                </div>
              </div>
              <div class="training-actions">
                <button class="btn btn-secondary" (click)="$event.stopPropagation(); openDetails(t.id || t['trainingId'])">Detalhes</button>
                <ng-container *ngIf="isEnrolled(t.id || t['trainingId']); else enrollBtn">
                  <button class="btn btn-primary" (click)="$event.stopPropagation(); openTraining(t.id || t['trainingId'])">Acessar</button>
                </ng-container>
                <ng-template #enrollBtn>
                  <button class="btn btn-primary" (click)="$event.stopPropagation(); enroll(t.id || t['trainingId'])" [disabled]="isEnrolled(t.id || t['trainingId'])">Matricular</button>
                </ng-template>
              </div>
              <div class="training-progress-wrap" *ngIf="findEnrollment(t.id || t['trainingId']) as en">
                <div class="training-progress-bar" *ngIf="en.progressPercentage !== undefined && en.progressPercentage !== null">
                  <div class="training-progress-fill" [style.width.%]="en.progressPercentage"></div>
                </div>
                <p class="training-progress-label" *ngIf="en.progressPercentage !== undefined && en.progressPercentage !== null">{{ en.progressPercentage }}% completo</p>
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
  readonly enrollmentProgress = signal<Record<string, number | null>>({});

  ngOnInit(): void {
    this.load();
    this.loadEnrollments();
  }

  openTraining(enrollmentOrId?: EnrollmentResponseDTO | string) {
    let id = '';
    if (!enrollmentOrId) return;
    if (typeof enrollmentOrId === 'string') id = enrollmentOrId;
    else id = enrollmentOrId.trainingId || enrollmentOrId.enrollmentId || '';
    if (!id) return;
    // Abrir página de detalhe do treinamento para usuários logados
    this.router.navigate(['/treinamento', id]);
  }

  openDetails(enrollmentOrId: EnrollmentResponseDTO | string) {
    let id = '';
    if (!enrollmentOrId) return;
    if (typeof enrollmentOrId === 'string') id = enrollmentOrId;
    else id = enrollmentOrId.trainingId || enrollmentOrId.enrollmentId || '';
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
    if (!trainingId) {
      console.warn('[Trainings] enroll called without trainingId');
      return;
    }

    this.trainingService.enrollInTraining(trainingId).subscribe({
      next: resp => {
        const current = this.myEnrollments() ?? [];
        this.myEnrollments.set([...(current || []), resp]);
        // Recarregar lista de matrículas do backend (retorna progressPercentage corretamente)
        this.loadEnrollments();
        console.debug('[Trainings] matriculado', resp);
      },
      error: err => console.warn('[Trainings] erro ao matricular', err)
    });
  }

  loadEnrollments() {
    this.myEnrollments.set(null);
    this.trainingService.getMyEnrollments().subscribe({
      next: items => {
        const list = items || [];
        this.myEnrollments.set(list);
        this.fetchMissingProgressForEnrollments(list);
      },
      error: err => { console.warn('[Trainings] erro ao carregar matrículas', err); this.myEnrollments.set([]); }
    });
  }

  private fetchMissingProgressForEnrollments(enrollments: EnrollmentResponseDTO[] | null) {
    const list = enrollments ?? [];
    for (const e of list) {
      const tid = String(e.trainingId ?? e.enrollmentId ?? '');
      if (!tid) continue;
      const already = this.enrollmentProgress()[tid];
      if ((e.progressPercentage === undefined || e.progressPercentage === null) && already === undefined) {
        this.enrollmentProgress.update(prev => ({ ...prev, [tid]: null }));
        this.trainingService.getEbookProgress(tid).pipe(take(1)).subscribe({
          next: p => {
            let pct: number | null = null;
            if (p == null) pct = null;
            else if (p.progressPercentage !== undefined && p.progressPercentage !== null) pct = p.progressPercentage;
            else if (p.lastPageRead !== undefined && p.totalPages !== undefined && p.totalPages > 0) {
              pct = Math.round((p.lastPageRead / p.totalPages) * 10000) / 100; // two decimals
            }
            this.enrollmentProgress.update(prev => ({ ...prev, [tid]: pct }));
          },
          error: () => this.enrollmentProgress.update(prev => ({ ...prev, [tid]: null }))
        });
      }
    }
  }


  isEnrolled(trainingId: string) {
    if (!trainingId) return false;
    const e = this.myEnrollments() ?? [];
    const tid = String(trainingId);
    return e.some(x => String(x.trainingId ?? '') === tid);
  }

  findEnrollment(trainingId: string): EnrollmentResponseDTO | undefined {
    const e = this.myEnrollments() ?? [];
    if (!trainingId) return undefined;
    const tid = String(trainingId);
    const found = e.find(x => String(x.trainingId ?? '') === tid || String(x.enrollmentId ?? '') === tid);
    if (!found) return undefined;
    const key = String(found.trainingId ?? found.enrollmentId ?? '');
    const progress = this.enrollmentProgress()[key];
    return { ...found, progressPercentage: found.progressPercentage ?? progress };
  }

  trackById(_: number, item: TrainingCatalogItemDTO) { return item?.id || (item as any)?.trainingId; }
}
