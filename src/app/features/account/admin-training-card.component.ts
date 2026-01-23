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
  styles: [],
  styleUrls: ['../../shared/styles/training-card.scss']
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
