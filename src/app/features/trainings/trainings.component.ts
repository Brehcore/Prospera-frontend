import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainingService, TrainingCatalogItemDTO, EnrollmentResponseDTO } from '../../core/services/training.service';
import { CatalogService, CatalogItem } from '../../core/services/catalog.service';
import { CatalogModalService } from '../../core/services/catalog-modal.service';
import { FilterService } from '../../core/services/filter.service';
import { AuthService } from '../../core/services/auth.service';
import { FiltersSidebarComponent } from '../../shared/components/filters-sidebar.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { take } from 'rxjs';

@Component({
  selector: 'pros-trainings',
  standalone: true,
  imports: [CommonModule, FiltersSidebarComponent, PaginationComponent],
  template: `
  <section class="trainings-page">
    <div class="container">
      <div class="trainings-main-wrapper">
        <!-- Filters Sidebar -->
        <pros-filters-sidebar
          [courseTypeOptions]="courseTypeOptions"
          [sectors]="uniqueSectorNames()"
        ></pros-filters-sidebar>

        <!-- Main Content -->
        <div class="trainings-content">
          <div class="loading" *ngIf="loading()">
            <span class="spinner" aria-hidden="true"></span>
            <p>Carregando catálogo de treinamentos…</p>
          </div>

          <div *ngIf="!loading()">
            <!-- Training Catalog Grid -->
            <div *ngIf="paginatedItems().length > 0">
              <div class="training-catalog-grid">
                <article 
                  class="training-card" 
                  [class.training-card--org]="isOrgAccount()" 
                  [class.training-card--personal]="!isOrgAccount()" 
                  *ngFor="let t of (paginatedItems() || []); trackBy: trackById"
                >
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

            <!-- Empty State or Fallback to Enrollments -->
            <ng-container *ngIf="paginatedItems().length === 0">
              <div *ngIf="paginatedEnrollments().length > 0" class="training-catalog-grid">
                <article 
                  class="training-card" 
                  [class.training-card--org]="isOrgAccount()" 
                  [class.training-card--personal]="!isOrgAccount()" 
                  *ngFor="let e of (paginatedEnrollments() || [])" 
                  (click)="openTraining(e)" 
                  role="button" 
                  tabindex="0"
                >
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

              <div *ngIf="paginatedEnrollments().length === 0 && (myEnrollments()?.length ?? 0) === 0" class="container">
                <div class="empty">
                  <i class="fas fa-inbox" aria-hidden="true"></i>
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
        </div>
      </div>

      <!-- Pagination for Catalog -->
      <pros-pagination
        *ngIf="!loading() && (paginatedItems().length > 0 || paginatedEnrollments().length > 0)"
        [currentPage]="filterService.currentPage()"
        [pageSize]="filterService.pageSize()"
        [totalItems]="paginatedItems().length > 0 ? totalItems() : totalEnrollments()"
        (pageChanged)="onPageChange($event)"
        (pageSizeChanged)="onPageSizeChange($event)"
      ></pros-pagination>
    </div>
  </section>
  `,
  styles: [`
    .trainings-page {
      padding: 3rem 0 4rem;
      background: var(--cinza-claro, #f6f7fb);
      min-height: 100vh;
    }

    .trainings-main-wrapper {
      display: flex;
      gap: 2.5rem;
      margin-bottom: 3rem;
      align-items: flex-start;
    }

    .trainings-content {
      flex: 1;
      min-width: 0;
    }

    .loading {
      text-align: center;
      padding: 3rem;
    }

    .spinner {
      display: inline-block;
      width: 2.5rem;
      height: 2.5rem;
      border: 3px solid rgba(76, 175, 80, 0.2);
      border-top-color: var(--verde-claro, #4CAF50);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .trainings-main-wrapper {
        flex-direction: column;
        gap: 1.5rem;
      }
    }
  `],
  styleUrls: ['../../shared/styles/training-card.scss']
})
export class TrainingsComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly auth = inject(AuthService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly catalogModal = inject(CatalogModalService);
  public readonly filterService = inject(FilterService);

  readonly catalog = signal<TrainingCatalogItemDTO[] | null>(null);
  readonly myEnrollments = signal<EnrollmentResponseDTO[] | null>(null);
  readonly enrollmentProgress = signal<Record<string, number | null>>({});

  readonly loading = computed(() => this.catalog() === null || this.myEnrollments() === null);
  readonly error = signal<string | null>(null);

  readonly courseTypeOptions = [
    { label: 'Cursos gravados', value: 'RECORDED_COURSE' },
    { label: 'E-Books', value: 'EBOOK' }
  ];

  readonly uniqueSectorNames = computed(() => {
    const allSectors = new Set<string>();
    
    // Extract from catalog
    (this.catalog() || []).forEach(item => {
      (item.sectorNames || []).forEach(sector => {
        if (sector) allSectors.add(sector);
      });
    });

    // Extract from enrollments
    (this.myEnrollments() || []).forEach(item => {
      (item as any).sectorNames?.forEach((sector: string) => {
        if (sector) allSectors.add(sector);
      });
    });

    return Array.from(allSectors).sort();
  });

  readonly filteredItems = computed(() => {
    const filterState = this.filterService.getFilterState();
    let result = [...(this.catalog() || [])];

    // Apply search filter
    if (filterState.searchTerm) {
      const term = filterState.searchTerm.toLowerCase();
      result = result.filter(item =>
        `${item.title} ${item.description}`.toLowerCase().includes(term)
      );
    }

    // Apply course type filter
    if (filterState.courseTypes.length > 0) {
      result = result.filter(item => filterState.courseTypes.includes(item.type));
    }

    // Apply sector filter
    if (filterState.sectors.length > 0) {
      result = result.filter(item => {
        const itemSectors = item.sectorNames || [];
        return filterState.sectors.some(s => itemSectors.includes(s));
      });
    }

    return result;
  });

  readonly filteredEnrollments = computed(() => {
    const filterState = this.filterService.getFilterState();
    let result = [...(this.myEnrollments() || [])];

    // Apply search filter
    if (filterState.searchTerm) {
      const term = filterState.searchTerm.toLowerCase();
      result = result.filter(item =>
        `${item.trainingTitle}`.toLowerCase().includes(term)
      );
    }

    return result;
  });

  readonly paginatedItems = computed(() => {
    const filterState = this.filterService.getFilterState();
    const filtered = this.filteredItems();
    const start = (filterState.currentPage - 1) * filterState.pageSize;
    const end = start + filterState.pageSize;
    return filtered.slice(start, end);
  });

  readonly paginatedEnrollments = computed(() => {
    const filterState = this.filterService.getFilterState();
    const filtered = this.filteredEnrollments();
    const start = (filterState.currentPage - 1) * filterState.pageSize;
    const end = start + filterState.pageSize;
    return filtered.slice(start, end);
  });

  readonly totalItems = computed(() => this.filteredItems().length);
  readonly totalEnrollments = computed(() => this.filteredEnrollments().length);

  readonly isOrgAccount = computed(() => {
    try {
      const orgs = this.auth.getOrganizations();
      if (Array.isArray(orgs) && orgs.length > 0) return true;
      // Fallback: check if profile has company field
      const profileAny: any = (this as any).auth?.user$?.value ?? null;
      return !!(profileAny && profileAny.company);
    } catch {
      return false;
    }
  });

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
      error: err => {
        console.warn('[Trainings] erro ao carregar matrículas', err);
        this.myEnrollments.set([]);
      }
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
              pct = Math.round((p.lastPageRead / p.totalPages) * 10000) / 100;
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

  trackById(_: number, item: TrainingCatalogItemDTO | EnrollmentResponseDTO) {
    const trainingId = (item as any)?.trainingId || (item as any)?.id;
    return trainingId;
  }

  onPageChange(page: number): void {
    this.filterService.setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onPageSizeChange(size: number): void {
    this.filterService.setPageSize(size);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

