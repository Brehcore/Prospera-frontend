import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SubscriptionService, UserSubscription, AccessStatus } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';
import { TrainingService, TrainingCatalogItemDTO, EnrollmentResponseDTO } from '../../core/services/training.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'pros-subscription-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <section class="subscription" aria-live="polite">
    <div class="container">
      <h1>Minha Assinatura</h1>

      <div *ngIf="isSystemAdmin()" class="empty" style="text-align:center;padding:1.5rem 0;margin-bottom:1rem;">
        <p style="font-weight:600">Administrador do Sistema: Acesso liberado sem assinatura</p>
      </div>

      <ng-container *ngIf="!isSystemAdmin()">

      <div class="loading" *ngIf="loading()">
        <span class="spinner" aria-hidden="true"></span>
        <p>Carregando assinatura…</p>
      </div>

      <div class="empty" *ngIf="!loading() && !error() && subscription() === null">
        <p>Você ainda não possui uma assinatura ativa.</p>
        <a routerLink="/planos" class="btn btn-primary">Ver Planos</a>
  </div>

  </ng-container>

      <div class="error" *ngIf="!loading() && error()">
        <p>{{ error() }}</p>
        <button class="btn btn-secondary" (click)="reload()">Tentar novamente</button>
      </div>

      <div class="sub-card" *ngIf="!loading() && subscription() as sub">
        <header class="sub-header">
          <h2>{{ sub.planName }}</h2>
          <span class="status" [attr.data-status]="sub.status">{{ humanStatus(sub.status) }}</span>
        </header>
        <p class="description" *ngIf="sub.description">{{ sub.description }}</p>
        <dl class="meta">
          <div *ngIf="sub.startedAt">
            <dt>Início</dt>
            <dd>{{ sub.startedAt | date:'dd/MM/yyyy' }}</dd>
          </div>
          <div *ngIf="sub.expiresAt">
            <dt>Expira em</dt>
            <dd>{{ sub.expiresAt | date:'dd/MM/yyyy' }}</dd>
          </div>
          <div *ngIf="sub.durationInDays">
            <dt>Duração</dt>
            <dd>{{ durationLabel(sub.durationInDays) }}</dd>
          </div>
        </dl>
        <div class="pricing" *ngIf="sub.currentPrice">
          <span class="old" *ngIf="showDiscount(sub)">{{ sub.originalPrice | currency:'BRL':'symbol':'1.2-2' }}</span>
          <span class="current">{{ sub.currentPrice | currency:'BRL':'symbol':'1.2-2' }}</span>
        </div>
      </div>

      <!-- My Enrollments Section (outside trainingsLoading check) -->
      <div class="container">
        <section class="my-enrollments" *ngIf="(myEnrollments() || []).length > 0">
          <h3>Cursos & Treinamentos</h3>
          <p class="section-subtitle">Acompanhe sua jornada de aprendizado</p>
          <div class="training-grid">
            <article class="training-card enrollment-card" *ngFor="let e of (myEnrollments() || []); trackBy: trackByEnrollmentId">
              <div class="card-cover" *ngIf="e.coverImageUrl" [style.backgroundImage]="'url(' + e.coverImageUrl + ')'"></div>
              <div class="card-content">
                <h4>{{ e.trainingTitle }}</h4>
                <div class="enrollment-info">
                  <p class="muted">Matriculado em {{ e.enrolledAt | date:'dd/MM/yyyy' }}</p>
                </div>
                <div class="progress-container" *ngIf="e.progressPercentage !== undefined && e.progressPercentage !== null">
                  <div class="progress-bar">
                    <div class="progress-fill" [style.width.%]="e.progressPercentage"></div>
                  </div>
                  <span class="progress-text">{{ e.progressPercentage | number:'1.0-0' }}% completo</span>
                </div>
                <div class="enrollment-status" [attr.data-status]="e.status">
                  {{ e.status === 'ACTIVE' ? 'Em Progresso' : e.status }}
                </div>
                <div class="certificate-actions" *ngIf="e.status === 'COMPLETED'">
                  <button 
                    *ngIf="!e.certificateId"
                    class="btn btn--certificate" 
                    (click)="issueCertificateForEnrollment(e)"
                    [disabled]="issuingCertificateId() === e.enrollmentId">
                    {{ issuingCertificateId() === e.enrollmentId ? 'Emitindo...' : '📜 Emitir Certificado' }}
                  </button>
                  <button 
                    *ngIf="e.certificateId"
                    class="btn btn--certificate" 
                    (click)="downloadCertificate(e)"
                    title="Baixar certificado">
                    📥 Baixar Certificado
                  </button>
                  <div *ngIf="certificateErrorMap()[e.enrollmentId || ''] as err" class="error-message">
                    {{ err }}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- Trainings catalog for authenticated user -->
      <div class="container" *ngIf="!trainingsLoading()">

        <section class="trainings" *ngIf="trainings()?.length">
          <h3>Catálogo de Treinamentos</h3>
          <div class="training-grid">
            <article class="training-card" *ngFor="let t of (trainings() || []); trackBy: trackByTrainingId">
              <h4>{{ t.title }}</h4>
              <p class="muted" *ngIf="t.description">{{ t.description }}</p>
              <div class="training-actions">
                <button class="btn btn-primary" (click)="enrollInTraining(t.id)" [disabled]="isEnrolled(t.id)">
                  {{ isEnrolled(t.id) ? 'Matriculado' : 'Matricular' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <div class="empty" *ngIf="(trainings() || []).length === 0">
          <p>Nenhum treinamento disponível no catálogo.</p>
        </div>

        <div class="error" *ngIf="trainingsError()">
          <p>{{ trainingsError() }}</p>
          <button class="btn btn-secondary" (click)="loadMyCatalog()">Recarregar catálogo</button>
        </div>
      </div>
    </div>
  </section>
  `,
  styles: [`
  .subscription { padding:2.5rem 0 4rem; }
  h1 { font-size: clamp(1.75rem,4vw,2.5rem); margin-bottom:1.5rem; }
  .loading,.empty,.error { text-align:center; padding:3rem 0; }
  .spinner { width:2.75rem;height:2.75rem;border-radius:50%;border:3px solid rgba(91,95,99,.25);border-top-color:var(--color-primary-500,#6a5acd);display:inline-block;animation:spin 1s linear infinite;margin-bottom:1rem; }
  .sub-card { background:#fff; border:1px solid rgba(106,90,205,.15); border-radius:16px; padding:2rem 2.25rem; box-shadow:0 12px 32px rgba(31,36,43,.08); max-width:720px; }
  .sub-header { display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between; }
  .sub-header h2 { margin:0; font-size:1.5rem; }
  .status { font-size:.65rem; letter-spacing:.14em; text-transform:uppercase; font-weight:600; padding:.4rem .7rem; border-radius:999px; background:rgba(91,95,99,.15); }
  .status[data-status="ATIVA"], .status[data-status="ACTIVE"] { background:rgba(46,182,125,.18); color:#11805a; }
  .status[data-status="CANCELADA"], .status[data-status="CANCELED"] { background:rgba(255,82,82,.18); color:#b30021; }
  .description { margin:.75rem 0 1.25rem; color:var(--color-text-muted,#5b5f63); }
  dl.meta { display:flex; flex-wrap:wrap; gap:2rem; margin:0 0 1.5rem; }
  dl.meta div { min-width:120px; }
  dl.meta dt { font-size:.7rem; letter-spacing:.12em; text-transform:uppercase; font-weight:600; margin-bottom:.25rem; color:#555; }
  dl.meta dd { margin:0; font-weight:500; }
  .pricing { display:flex; align-items:baseline; gap:.75rem; font-weight:600; }
  .pricing .old { text-decoration:line-through; color:#888; font-weight:400; }
  .pricing .current { font-size:1.5rem; color:var(--color-primary-600,#5a4bcf); }
  .section-subtitle { margin:-0.75rem 0 1.5rem; color:var(--color-text-muted,#5b5f63); font-size:.95rem; }
  .training-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem; }
  .training-card { background:#fff; border:1px solid rgba(91,95,99,.12); border-radius:12px; padding:1.5rem; transition:box-shadow .3s ease; }
  .training-card:hover { box-shadow:0 8px 24px rgba(31,36,43,.12); }
  .training-card h4 { margin:0 0 0.75rem; font-size:1.1rem; }
  .training-card .muted { margin:0.5rem 0; color:var(--color-text-muted,#5b5f63); font-size:.9rem; }
  .training-actions { display:flex; gap:0.75rem; margin-top:1rem; }
  .training-card .btn { flex:1; }
  .enrollment-card { display:flex; flex-direction:column; overflow:hidden; padding:0; }
  .card-cover { width:100%; height:150px; background-size:cover; background-position:center; }
  .card-content { padding:1.5rem; flex:1; display:flex; flex-direction:column; }
  .card-content h4 { margin:0 0 0.75rem; font-size:1.1rem; }
  .enrollment-info { margin:0.75rem 0; }
  .progress-container { margin:1rem 0; }
  .progress-bar { width:100%; height:6px; background:rgba(91,95,99,.15); border-radius:3px; overflow:hidden; margin-bottom:0.5rem; }
  .progress-fill { height:100%; background:linear-gradient(90deg, var(--verde-escuro), var(--verde-claro)); transition:width .3s ease; }
  .progress-text { font-size:.8rem; color:var(--color-text-muted,#5b5f63); }
  .enrollment-status { font-size:.75rem; letter-spacing:.02em; text-transform:uppercase; font-weight:600; padding:.4rem .7rem; border-radius:999px; background:rgba(91,95,99,.15); display:inline-block; margin-top:auto; width:fit-content; }
  .enrollment-status[data-status="ACTIVE"], .enrollment-status[data-status="ATIVA"] { background:rgba(46,182,125,.18); color:#11805a; }
  .enrollment-status[data-status="COMPLETED"], .enrollment-status[data-status="CONCLUÍDO"] { background:rgba(79,168,108,.15); color:var(--verde-escuro); }
  .certificate-actions { margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem; }
  .btn--certificate { background:#6a5acd; color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer; font-size:0.85rem; transition:all 0.2s; }
  .btn--certificate:hover:not(:disabled) { background:#5a4bcf; }
  .btn--certificate:disabled { opacity:0.6; cursor:not-allowed; }
  .error-message { background:rgba(255,82,82,.1); border:1px solid rgba(255,82,82,.3); padding:0.5rem; border-radius:4px; color:#b30021; font-size:0.8rem; }
  @keyframes spin { to { transform: rotate(360deg);} }
  `]
})
export class SubscriptionViewComponent implements OnInit {
  private readonly service = inject(SubscriptionService);
  private readonly authService = inject(AuthService);
  private readonly trainingService = inject(TrainingService);
  private readonly api = inject(ApiService);

  // Trainings state
  readonly trainings = signal<TrainingCatalogItemDTO[] | null>(null);
  readonly trainingsLoading = computed(() => this.trainings() === null);
  readonly trainingsError = signal<string | null>(null);

  // Enrollments
  readonly myEnrollments = signal<EnrollmentResponseDTO[] | null>(null);

  // Certificate state
  readonly issuingCertificateId = signal<string | null>(null);
  readonly certificateErrorMap = signal<{ [key: string]: string | null }>({});

  readonly subscription = signal<UserSubscription | null | undefined>(undefined); // undefined=loading, null=sem assinatura
  readonly loading = computed(() => this.subscription() === undefined);
  readonly error = signal<string | null>(null);
  readonly isSystemAdmin = computed(() => this.authService.isSystemAdmin());
  readonly tokenRole = computed(() => this.authService.getRole() ?? this.authService.getSystemRole());

  ngOnInit(): void {
    try {
      console.debug('[SubscriptionView] init role', { role: this.authService.getRole(), systemRole: this.authService.getSystemRole(), isSystemAdmin: this.authService.isSystemAdmin() });
      // localStorage flags (do not print token value)
      try { console.debug('[SubscriptionView] storage', { hasToken: !!localStorage.getItem('jwtToken') || !!localStorage.getItem('jwttoken'), storedRole: localStorage.getItem('systemRole'), email: localStorage.getItem('loggedInUserEmail') }); } catch (e) {}
    } catch (e) {}
    this.load();
    // load trainings/catalog for authenticated user
    this.loadMyCatalog();
    this.loadMyEnrollments();
  }

  reload() { this.load(true); }

  private load(reset = false) {
    if (reset) {
      this.subscription.set(undefined);
      this.error.set(null);
    }
    // Se o usuário for SYSTEM_ADMIN, não precisamos consultar o endpoint; o
    // token já determina a role e mostramos a mensagem informativa.
    if (this.authService.isSystemAdmin()) {
      this.subscription.set(null);
      this.error.set(null);
      return;
    }
    // Primeiro consulte o status de acesso — para membros de organização o backend
    // informa se o acesso vem da organização. Se for PERSONAL_SUBSCRIPTION, busque
    // os detalhes completos da assinatura pessoal; se for ORGANIZATIONAL_SUBSCRIPTION
    // mapeie para um cartão resumido indicando "Acesso via organização".
    this.service.getMyAccessStatus().subscribe({
      next: (status: AccessStatus) => {
        if (!status || status.accessType === 'NONE') {
          this.subscription.set(null);
          return;
        }

        if (status.accessType === 'PERSONAL_SUBSCRIPTION') {
          // usuário tem assinatura pessoal — carregar detalhes completos
          this.service.getMySubscription().subscribe({
            next: sub => this.subscription.set(sub),
            error: err => {
              console.warn('[SubscriptionView] erro ao carregar assinatura pessoal', err);
              this.error.set('Não foi possível carregar sua assinatura agora.');
              this.subscription.set(null);
            }
          });
          return;
        }

        // ORGANIZATIONAL_SUBSCRIPTION — exibir acesso fornecido pela organização
        this.subscription.set({
          id: 'org-access',
          planName: status.planName ?? 'Plano (fornecido pela organização)',
          origin: 'ORGANIZATION',
          description: status.organizationName ? `Acesso via organização ${status.organizationName}` : 'Acesso via organização',
          startedAt: undefined,
          expiresAt: status.endDate ?? undefined,
          originalPrice: null,
          currentPrice: null,
          durationInDays: null,
          status: 'ATIVA',
          raw: status.raw ?? status
        } as UserSubscription);
      },
      error: err => {
        console.warn('[SubscriptionView] erro ao carregar status de acesso', err);
        this.error.set('Não foi possível carregar sua assinatura agora.');
        this.subscription.set(null);
      }
    });
  }

  // Training related methods
  loadMyCatalog() {
    this.trainings.set(null); // loading
    this.trainingsError.set(null);
    this.trainingService.getMyCatalog().subscribe({
      next: (items: TrainingCatalogItemDTO[]) => {
        this.trainings.set(items || []);
      },
      error: err => {
        console.warn('[SubscriptionView] erro ao carregar catálogo de treinamentos', err);
        this.trainings.set([]);
        this.trainingsError.set('Não foi possível carregar o catálogo de treinamentos.');
      }
    });
  }

  enrollInTraining(trainingId: string) {
    this.trainingService.enrollInTraining(trainingId).subscribe({
      next: (resp) => {
        // Atualiza lista de matrículas locais
        const current = this.myEnrollments() ?? [];
        this.myEnrollments.set([...(current || []), resp]);
        console.debug('[SubscriptionView] matriculado', resp);
      },
      error: (err) => {
        console.warn('[SubscriptionView] erro ao matricular', err);
      }
    });
  }

  markLessonComplete(lessonId: string) {
    this.trainingService.markLessonAsCompleted(lessonId).subscribe({
      next: () => console.debug('[SubscriptionView] lição marcada como concluída', lessonId),
      error: err => console.warn('[SubscriptionView] erro ao marcar lição concluída', err)
    });
  }

  loadMyEnrollments() {
    this.myEnrollments.set(null);
    this.trainingService.getMyEnrollments().subscribe({
      next: items => {
        console.debug('[SubscriptionView] minhas matrículas carregadas:', items);
        this.myEnrollments.set(items || []);
      },
      error: err => {
        console.warn('[SubscriptionView] erro ao carregar minhas matrículas', err);
        this.myEnrollments.set([]);
      }
    });
  }

  trackByTrainingId(_: number, item: TrainingCatalogItemDTO) {
    return item?.id;
  }

  trackByEnrollmentId(_: number, item: EnrollmentResponseDTO) {
    return item?.id;
  }

  isEnrolled(trainingId: string) {
    const enrolls = this.myEnrollments() ?? [];
    return enrolls.some(e => e.trainingId === trainingId);
  }

  showDiscount(sub: UserSubscription) {
    return !!sub.originalPrice && !!sub.currentPrice && sub.originalPrice > sub.currentPrice;
  }

  durationLabel(days?: number | null) {
    if (!days) return '—';
    if (days >= 28 && days <= 31) return 'Mensal';
    if (days >= 85 && days <= 95) return 'Trimestral';
    if (days >= 170 && days <= 190) return 'Semestral';
    if (days >= 360 && days <= 370) return 'Anual';
    if (days === 7) return 'Semanal';
    return `${days} dias`;
  }

  humanStatus(status?: string) {
    if (!status) return '—';
    const s = status.toUpperCase();
    switch (s) {
      case 'ACTIVE':
      case 'ATIVA':
        return 'Ativa';
      case 'CANCELED':
      case 'CANCELADA':
        return 'Cancelada';
      case 'EXPIRED':
      case 'EXPIRADA':
        return 'Expirada';
      case 'PENDING':
      case 'PENDENTE':
        return 'Pendente';
      default:
        return s.charAt(0) + s.slice(1).toLowerCase();
    }
  }

  issueCertificateForEnrollment(enrollment: EnrollmentResponseDTO): void {
    if (!enrollment.enrollmentId) {
      this.updateCertificateError(enrollment.enrollmentId || '', 'ID da matrícula não disponível');
      return;
    }

    this.issuingCertificateId.set(enrollment.enrollmentId);
    this.updateCertificateError(enrollment.enrollmentId, null);

    // Backend retorna um código de validação (string simples, não JSON)
    this.api.post<string>(`/api/certificates/issue/${encodeURIComponent(enrollment.enrollmentId)}`, {}, { responseType: 'text' as any }).subscribe({
      next: (validationCode) => {
        this.issuingCertificateId.set(null);
        // Atualiza matrícula reconsultando enrollments para obter certificateId atualizado
        this.trainingService.getMyEnrollments().subscribe({
          next: (updatedEnrollments: any[]) => {
            const updated = updatedEnrollments.find(e => e.enrollmentId === enrollment.enrollmentId);
            if (updated) {
              const enrollments = this.myEnrollments() || [];
              const idx = enrollments.findIndex(e => e.enrollmentId === enrollment.enrollmentId);
              if (idx >= 0) {
                enrollments[idx] = updated;
                this.myEnrollments.set([...enrollments]);
              }
            }
          },
          error: () => {}
        });
      },
      error: (err) => {
        this.issuingCertificateId.set(null);
        const errMsg = err?.error?.message || err?.message || 'Erro ao emitir certificado';
        this.updateCertificateError(enrollment.enrollmentId || '', errMsg);
      }
    });
  }

  downloadCertificate(enrollment: EnrollmentResponseDTO): void {
    if (!enrollment.certificateId) {
      this.updateCertificateError(enrollment.enrollmentId || '', 'Certificado não disponível');
      return;
    }

    // Construa a URL para download do certificado
    const url = this.api.createUrl(`/api/certificates/download/${encodeURIComponent(enrollment.certificateId)}`)
    window.location.href = url;
  }

  private updateCertificateError(enrollmentId: string, error: string | null): void {
    const map = this.certificateErrorMap();
    map[enrollmentId] = error;
    this.certificateErrorMap.set({ ...map });
  }
}
