import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CatalogModalService } from '../../core/services/catalog-modal.service';
import { take } from 'rxjs';

@Component({
  selector: 'pros-admin-training-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="training-card" [class]="'training-' + (getEntityType() || 'default')">
      <div class="training-image">
        <img
          *ngIf="training?.coverImageUrl"
          [src]="training.coverImageUrl"
          [alt]="training.title || 'Capa do treinamento'"
          class="cover"
        />
        <div *ngIf="!training?.coverImageUrl" class="cover-placeholder">
          <i [class]="getTrainingIcon()" aria-hidden="true"></i>
        </div>
        <ng-container *ngIf="getEntityType() === 'ebook'">
          <i class="fas fa-book training-badge-icon" aria-hidden="true"></i>
        </ng-container>
        <ng-container *ngIf="getEntityType() === 'video'">
          <i class="fas fa-play-circle training-badge-icon" aria-hidden="true"></i>
        </ng-container>
        <ng-container *ngIf="getEntityType() === 'live'">
          <i class="fas fa-calendar-alt training-badge-icon" aria-hidden="true"></i>
        </ng-container>
        <ng-container *ngIf="getEntityType() !== 'ebook' && getEntityType() !== 'video' && getEntityType() !== 'live'">
          <span class="training-badge">{{ getEntityTypeLabel() }}</span>
        </ng-container>
      </div>

      <div class="training-content">
        <h3 class="training-title">{{ training?.title || training?.name || 'Sem título' }}</h3>
        
        <div class="training-meta-items">
          <p class="meta-item" *ngIf="training?.author">
            <i class="fas fa-user" aria-hidden="true"></i>
            {{ training.author }}
          </p>
          
          <p class="meta-item" *ngIf="getPageCount()">
            <i class="fas fa-file" aria-hidden="true"></i>
            {{ getPageCount() }} páginas
          </p>

          <p class="meta-item" *ngIf="getTrainingTypeLabel()">
            <i class="fas fa-tag" aria-hidden="true"></i>
            {{ getTrainingTypeLabel() }}
          </p>
        </div>
      </div>

      <div class="training-actions">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="onDetails()"
          title="Detalhes"
        >
          Detalhes
        </button>
        <button
          type="button"
          class="btn btn-primary"
          (click)="onAccess()"
          title="Acessar"
        >
          Acessar
        </button>
      </div>
    </article>
  `,
  styles: [`
    .training-card {
      background: var(--white);
      max-width: 200px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      height: auto;
      min-height: 220px;
      margin: 0 auto;
    }

    .training-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    }

    .training-image {
      position: relative;
      width: 100%;
      height: 110px;
      background: linear-gradient(135deg, #f0f4f8 0%, #e8f0f8 100%);
      overflow: hidden;
    }

    .training-image .cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-placeholder {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(79, 168, 108, 0.1), rgba(79, 168, 108, 0.05));
      color: var(--verde-escuro);
      font-size: 2.5rem;
    }

    .cover-placeholder i {
      opacity: 0.6;
    }

    .training-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--white);
      color: var(--verde-escuro);
      padding: 4px 8px;
      border-radius: 16px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .training-badge-icon {
      position: absolute;
      top: 8px;
      right: 8px;
      display: inline-grid;
      place-items: center;
      width: 36px;
      height: 36px;
      background: var(--white);
      color: var(--verde-escuro);
      border-radius: 50%;
      font-size: 1rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }

    .training-content {
      padding: 8px;
      flex: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .training-title {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--gray-darker, #1f2a37);
      line-height: 1.15;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .training-meta-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 0.75rem;
    }

    .meta-item {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--gray-medium);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta-item i {
      min-width: 12px;
      color: var(--verde-escuro);
      opacity: 0.7;
      font-size: 0.7rem;
    }

    .training-actions {
      padding: 6px 8px;
      border-top: 1px solid rgba(31, 42, 55, 0.06);
      display: flex;
      gap: 6px;
    }

    .btn {
      flex: 1;
      padding: 0.32rem 0.45rem;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .btn i {
      font-size: 0.8rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--verde-escuro), var(--verde-claro));
      color: var(--white);
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(79, 168, 108, 0.25);
    }

    .btn-secondary {
      background: rgba(31, 42, 55, 0.06);
      color: var(--gray-dark);
    }

    .btn-secondary:hover {
      background: rgba(31, 42, 55, 0.1);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Type-specific styling for visual variety */
    .training-ebook .training-image {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    }

    .training-video .training-image {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    }

    .training-live .training-image {
      background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
    }

    @media (max-width: 640px) {
      .training-card {
        min-height: 180px;
        max-width: 160px;
      }

      .training-image {
        height: 90px;
      }

      .btn {
        padding: 0.28rem 0.36rem;
        font-size: 0.72rem;
      }

      .cover-placeholder {
        font-size: 1.6rem;
      }

      /* hide less important meta on very small thumbnails */
      .training-meta-items .meta-item:nth-child(2) { display: none; }
    }
  `]
})
export class AdminTrainingCardComponent {
  @Input() training: any = null;
  @Input() onDetailsClick?: (training: any) => void;
  @Input() onAccessClick?: (training: any) => void;
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly catalogModal = inject(CatalogModalService);

  getEntityType(): string {
    const entityType = String(this.training?.entityType || this.training?.trainingEntityType || 'UNKNOWN').toUpperCase();
    if (entityType.includes('EBOOK') || entityType.includes('LIVRO')) return 'ebook';
    if (entityType.includes('VIDEO') || entityType.includes('GRAVADO') || entityType.includes('RECORDED') || entityType.includes('COURSE')) return 'video';
    if (entityType.includes('LIVE') || entityType.includes('AO VIVO') || entityType.includes('CALENDAR') || entityType.includes('WEBINAR')) return 'live';
    return 'default';
  }

  getEntityTypeLabel(): string {
    const entityType = String(this.training?.entityType || this.training?.trainingEntityType || '');
    return entityType || 'Conteúdo';
  }

  isEntityEbook(): boolean {
    return this.getEntityType() === 'ebook';
  }

  getPageCount(): number | null {
    const pages = this.training?.ebookDetails?.totalPages || this.training?.totalPages;
    return pages ? Number(pages) : null;
  }

  getTrainingType(): string | null {
    const sectorAssignments = Array.isArray(this.training?.sectorAssignments) ? this.training.sectorAssignments : [];
    const firstAssignment = sectorAssignments[0];
    
    if (!firstAssignment) return null;
    
    const trainingType = String(firstAssignment.trainingType || '').toUpperCase();
    return trainingType;
  }

  getTrainingTypeLabel(): string {
    const type = this.getTrainingType();
    if (!type) return '';
    
    switch (type) {
      case 'ELECTIVE':
        return 'Eletivo';
      case 'COMPULSORY':
        return 'Compulsório';
      default:
        return type;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['training'] && this.training) {
      this.ensureCoverFromAdmin();
    }
  }

  private ensureCoverFromAdmin(): void {
    // If coverImageUrl already present, do nothing
    if (this.training?.coverImageUrl) return;
    const id = String(this.training?.id ?? this.training?.trainingId ?? this.training?.uuid ?? this.training?._id ?? '');
    if (!id) return;
    // Only call admin endpoint if current user is admin (system or org admin).
    const orgId = String(this.training?.organizationId ?? this.training?.orgId ?? '');
    if (!this.auth.isSystemAdmin() && !this.auth.hasOrganizationRole('ORG_ADMIN', orgId)) {
      // not allowed to call admin endpoint — give up silently
      return;
    }

    // fetch detailed training from admin endpoint to try to get original cover
    this.adminService.getTrainingById(id).subscribe({
      next: detailed => {
        const cover = (detailed as any)?.coverImageUrl ?? (detailed as any)?.imageUrl ?? null;
        if (cover) {
          try {
            // assign back to input object so UI updates
            this.training.coverImageUrl = cover;
          } catch {
            // ignore assignment errors
          }
        }
      },
      error: () => {
        // ignore errors silently — fallback will remain placeholder
      }
    });
  }

  getTrainingIcon(): string {
    const entityType = String(this.training?.entityType || this.training?.trainingEntityType || '').toUpperCase();
    
    if (entityType.includes('EBOOK') || entityType.includes('LIVRO')) {
      return 'fas fa-book';
    }
    if (entityType.includes('VIDEO') || entityType.includes('GRAVADO') || entityType.includes('COURSE') || entityType.includes('RECORDED')) {
      return 'fas fa-play-circle';
    }
    if (entityType.includes('CALENDAR') || entityType.includes('LIVE') || entityType.includes('AO VIVO')) {
      return 'fas fa-calendar-alt';
    }
    if (entityType.includes('WEBINAR')) {
      return 'fas fa-webcam';
    }
    return 'fas fa-graduation-cap';
  }

  onDetails(): void {
    // If parent provided a details handler (e.g. to open a modal), prefer it.
    if (this.onDetailsClick) {
      this.onDetailsClick(this.training);
      return;
    }

    // Non-system users without a parent handler should open the public catalog modal
    if (!this.auth.isSystemAdmin()) {
      const id = String(this.training?.id ?? this.training?.trainingId ?? this.training?.uuid ?? this.training?._id ?? '');
      if (id) {
        this.catalogService.loadCatalog().pipe(take(1)).subscribe({
          next: items => {
            const found = (items || []).find(i => i.id === id);
            if (found) {
              this.catalogModal.open(found);
            } else {
              this.router.navigate(['/catalog'], { queryParams: { id } });
            }
          },
          error: () => this.router.navigate(['/catalog'], { queryParams: { id } })
        });
        return;
      }
    }
  }

  onAccess(): void {
    if (this.onAccessClick) {
      this.onAccessClick(this.training);
    }
  }
}
