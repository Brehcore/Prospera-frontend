import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainingService, TrainingCatalogItemDTO, EnrollmentResponseDTO } from '../../core/services/training.service';

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

      <div *ngIf="!loading()">
        <div *ngIf="(catalog()?.length ?? 0) > 0">
          <div class="grid">
            <article class="card" *ngFor="let t of (catalog() || []); trackBy: trackById">
              <h3>{{ t.title }}</h3>
              <p class="muted" *ngIf="t.description">{{ t.description }}</p>
              <div class="actions">
                <button class="btn btn-primary" (click)="enroll(t.id)" [disabled]="isEnrolled(t.id)">
                  {{ isEnrolled(t.id) ? 'Matriculado' : 'Matricular' }}
                </button>
              </div>
            </article>
          </div>
        </div>
        <div *ngIf="(catalog()?.length ?? 0) === 0 && !loading()">
          <!-- Se não há catálogo, exibir matrículas ativas do usuário -->
          <div *ngIf="(myEnrollments()?.length ?? 0) > 0" class="enrollments-grid">
            <div class="enrollment-card" *ngFor="let e of (myEnrollments() || [])" (click)="openTraining(e)" role="button" tabindex="0">
              <div class="accent-bar" aria-hidden="true"></div>
              <div class="cover" *ngIf="e.coverImageUrl" [style.backgroundImage]="'url(' + e.coverImageUrl + ')'" role="img" aria-label="Capa do treinamento"></div>
              <div class="content">
                <h3 class="title">{{ e.trainingTitle || ('Treinamento ' + e.trainingId) }}</h3>
                <div class="org-line">
                  <i class="fas fa-user-circle" aria-hidden="true"></i>
                  <span class="org-name">Go-Tree Consultoria</span>
                </div>
                <p class="muted">Matriculado em {{ e.enrolledAt | date:'dd/MM/yyyy' }}</p>
                <div class="card-actions">
                  <button class="btn btn-secondary" (click)="$event.stopPropagation();">Detalhes</button>
                  <button class="btn btn-primary" (click)="$event.stopPropagation(); openTraining(e)">Acessar</button>
                </div>
                <div class="progress-wrap">
                  <div class="progress-bar" *ngIf="e.progressPercentage !== undefined && e.progressPercentage !== null">
                    <div class="progress-fill" [style.width.%]="e.progressPercentage"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="(myEnrollments()?.length ?? 0) === 0" class="empty">
            <p>Nenhum treinamento disponível para você no momento.</p>
          </div>
        </div>
        <div *ngIf="error()" class="error">
          <p>{{ error() }}</p>
          <button class="btn btn-secondary" (click)="load()">Recarregar</button>
        </div>
      </div>
    </div>
  </section>
  `,
  styles: [`
  .trainings-page { padding:2rem 0; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; }
  .card { background:#fff; padding:1rem; border-radius:10px; border:1px solid rgba(0,0,0,0.05);} 
  .actions { margin-top:0.75rem; }
  /* Fixed-width cards centered like design */
  .enrollments-grid { display:grid; grid-template-columns:repeat(auto-fill,180px); justify-content:center; gap:0.4rem; padding:0.2rem 0; }
  .enrollment-card { width:180px; overflow:hidden; border-radius:8px; padding:0; cursor:pointer; display:flex; flex-direction:column; background:#fff; box-shadow:0 4px 12px rgba(15,107,58,0.04); border:1px solid rgba(15,107,58,0.04); }
  .enrollment-card .accent-bar { height:4px; background:var(--verde-escuro,#0f6b3a); width:100%; }
  .enrollment-card .cover { width:100%; height:76px; background-size:cover; background-position:center; border-top-left-radius:6px; border-top-right-radius:6px; }
  .enrollment-card .content { padding:0.35rem 0.45rem 0.5rem 0.45rem; display:flex; flex-direction:column; gap:0.24rem; }
  .enrollment-card .title { margin:0; font-size:0.82rem; line-height:1.05; max-height:1.9rem; overflow:hidden; color:var(--verde-escuro,#0f6b3a); font-weight:700; }
  .org-line { display:flex; align-items:center; gap:0.5rem; color:var(--color-text-muted,#6b6f73); font-size:0.86rem; }
  .org-line .org-name { font-weight:600; color:var(--verde-escuro,#0f6b3a); }
  .card-actions { display:flex; gap:0.28rem; margin-top:auto; }
  .card-actions .btn { padding:0.18rem 0.36rem; font-size:0.78rem; border-radius:6px; }
  .btn-primary { background:var(--verde-escuro,#0f6b3a); color:#fff; border:none; }
  .btn-secondary { background:#fff; color:var(--verde-escuro,#0f6b3a); border:1px solid rgba(15,107,58,0.14); }
  .progress-wrap { padding-top:0.35rem; }
  .progress-bar { width:100%; height:4px; background:rgba(0,0,0,0.04); border-radius:6px; overflow:hidden; box-shadow:inset 0 -1px 0 rgba(255,255,255,0.2); }
  .progress-fill { height:100%; background:linear-gradient(90deg,var(--verde-escuro,#0f6b3a),var(--verde-claro,#5fc07a)); transition:width .3s ease; }
  .progress-fill { height:100%; background:linear-gradient(90deg,var(--verde-escuro),var(--verde-claro)); transition:width .3s ease; }
  `]
})
export class TrainingsComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly router = inject(Router);

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
    // Abrir a página do curso em vez de tentar abrir blob (melhor UX e mesma página de SYSTEM_ADMIN)
    this.router.navigate(['/conteudo/visualizar', id]);
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
