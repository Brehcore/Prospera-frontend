import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CatalogModalService } from '../../../core/services/catalog-modal.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { FormatLabelPipe } from '../../pipes/format-label.pipe';

@Component({
  selector: 'pros-catalog-details-modal',
  standalone: true,
  imports: [CommonModule, FormatLabelPipe],
  template: `
  <div class="catalog-details-modal" *ngIf="item" (click)="close()" role="dialog" aria-modal="true">
    <article class="catalog-details-card" (click)="$event.stopPropagation()">
      <button class="catalog-details-close" type="button" (click)="close()" aria-label="Fechar detalhes">×</button>

      <div class="catalog-details-cover" [ngClass]="{ 'no-cover': !item.coverImageUrl }">
        <img *ngIf="item.coverImageUrl" [src]="item.coverImageUrl" alt="{{ item.title }}" loading="lazy" />
      </div>

      <div class="catalog-details-info">
        <h2>{{ item.title }}</h2>
        <p class="catalog-details-format">{{ (item.entityType || item.format) | formatLabel }}</p>
        <p>{{ item.description || 'Conteúdo atualizado e em breve disponível.' }}</p>

        <div class="catalog-details-sectors" *ngIf="item.sectors?.length">
          <ng-container *ngFor="let s of item.sectors">
            <span *ngIf="sectorLabel(s)" class="sector">{{ sectorLabel(s) | uppercase }}</span>
          </ng-container>
        </div>

        <!-- action buttons removed per UX request -->
      </div>
    </article>
  </div>
  `,
  styles: [`
    .catalog-details-modal { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:grid; place-items:center; z-index:1200; }
    .catalog-details-card { width:min(820px,96%); background:#fff; border-radius:10px; padding:1rem; position:relative; display:flex; gap:1rem; }
    .catalog-details-close { position:absolute; top:8px; right:8px; background:transparent; border:none; font-size:1.4rem; }
    .catalog-details-cover img { width:220px; height:140px; object-fit:cover; border-radius:6px; }
    .catalog-details-info { flex:1; }
    .catalog-details-actions { margin-top:1rem; display:flex; gap:0.5rem; }
  `]
})
export class CatalogDetailsModalComponent implements OnDestroy {
  private readonly service = inject(CatalogModalService);
  private readonly catalog = inject(CatalogService);
  item: any = null;
  private sub: Subscription;
  sectors: any[] = [];

  constructor() {
    this.sub = this.service.changes.subscribe(i => (this.item = i));
    // preload sectors for label lookup
    try {
      this.catalog.loadSectors().subscribe({ next: s => (this.sectors = s || []), error: () => (this.sectors = []) });
    } catch {
      this.sectors = [];
    }
  }

  close() {
    this.service.close();
  }

  sectorLabel(id: string): string {
    if (!id) return '';
    const found = (this.sectors || []).find((x: any) => String(x.id) === String(id));
    const candidate = found?.name ?? id;
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (guidRegex.test(String(candidate))) return '';
    return candidate;
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
