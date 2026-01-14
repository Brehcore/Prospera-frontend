import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogModalService } from '../../core/services/catalog-modal.service';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem, CatalogService, CatalogSector } from '../../core/services/catalog.service';
import { FormatLabelPipe } from '../../shared/pipes/format-label.pipe';

@Component({
  selector: 'pros-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatLabelPipe],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss']
})
export class CatalogComponent implements OnInit {
  items: CatalogItem[] = [];
  sectors: CatalogSector[] = [];

  isLoading = true;
  hasError = false;

  searchTerm = '';
  selectedFormat = '';
  selectedSector = '';
  // selectedItem handled by global modal service now

  private pendingDetailId: string | null = null;

  constructor(
    private readonly catalogService: CatalogService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly catalogModal: CatalogModalService
  ) {}

  ngOnInit(): void {
    this.loadData();

    // react to query params to open an item directly (e.g. /catalog?id=...)
    this.route.queryParams.subscribe(params => {
      const id = params['id'] || params['itemId'] || params['trainingId'];
      if (id) {
        const sid = String(id);
        if (this.items && this.items.length) {
          const found = this.items.find(i => i.id === sid);
          if (found) {
            this.showDetails(found);
            // remove `id` from query params
            try {
              const qp = { ...this.route.snapshot.queryParams } as any;
              delete qp['id'];
              delete qp['itemId'];
              delete qp['trainingId'];
              this.router.navigate([], { queryParams: qp, replaceUrl: true });
            } catch {}
          } else {
            // if not present, mark pending and try to reload
            this.pendingDetailId = sid;
            this.catalogService.loadCatalog().subscribe(items => {
              this.items = items;
              const f = this.items.find(i => i.id === sid);
              if (f) {
                this.showDetails(f);
                try {
                  const qp2 = { ...this.route.snapshot.queryParams } as any;
                  delete qp2['id'];
                  delete qp2['itemId'];
                  delete qp2['trainingId'];
                  this.router.navigate([], { queryParams: qp2, replaceUrl: true });
                } catch {}
              }
            });
          }
        } else {
          this.pendingDetailId = sid;
        }
      }
    });
  }

  get filteredItems(): CatalogItem[] {
    return this.items.filter(item => {
      if (this.selectedFormat && item.format !== this.selectedFormat) {
        return false;
      }
      if (this.selectedSector) {
        const normalizedSectors = (item.sectors || []).map(sector => sector.toString().toLowerCase());
        const match = normalizedSectors.includes(this.selectedSector.toLowerCase()) ||
          (this.selectedSector === 'global' && !normalizedSectors.length);
        if (!match) {
          return false;
        }
      }
      if (this.searchTerm) {
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        if (!haystack.includes(this.searchTerm.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }

  selectFormat(format: string): void {
    this.selectedFormat = format;
  }

  selectSector(sector: string): void {
    this.selectedSector = sector;
  }

  clearSector(): void {
    this.selectedSector = '';
  }

  private loadData(): void {
    this.isLoading = true;
    this.hasError = false;

    this.catalogService.loadCatalog().subscribe({
      next: items => {
        this.items = items;
        this.isLoading = false;
        // if there was a pending detail request from query params, try to open it
        if (this.pendingDetailId) {
          const found = this.items.find(i => i.id === this.pendingDetailId);
          if (found) {
            this.showDetails(found);
            // remove `id` from query params to avoid reopening on refresh
            try {
              const qp = { ...this.route.snapshot.queryParams } as any;
              delete qp['id'];
              delete qp['itemId'];
              delete qp['trainingId'];
              this.router.navigate([], { queryParams: qp, replaceUrl: true });
            } catch {}
          }
          this.pendingDetailId = null;
        }
      },
      error: error => {
        console.error('[Catalog] Falha ao carregar itens', error);
        this.hasError = true;
        this.isLoading = false;
      }
    });

    this.catalogService.loadSectors().subscribe({
      next: sectors => {
        const unique = this.ensureGlobalSector(sectors || []);
        this.sectors = unique;
      },
      error: () => {
        this.sectors = this.ensureGlobalSector([]);
      }
    });
  }

  private ensureGlobalSector(sectors: CatalogSector[]): CatalogSector[] {
    const list = [...sectors];
    if (!list.some(sector => sector.id === 'global')) {
      list.unshift({ id: 'global', name: 'Global' });
    }
    return list;
  }

  trackById(_: number, item: CatalogItem) {
    return item.id;
  }

  showDetails(item: CatalogItem) {
    this.catalogModal.open(item);
  }

  sectorName(id: string): string {
    if (!id) return id;
    const found = this.sectors.find(s => s.id === id);
    const candidate = found?.name ?? id;
    // Hide raw GUID-like ids to avoid showing noise in the UI
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (guidRegex.test(candidate)) {
      return '';
    }
    return candidate;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    // Close global catalog modal if open
    try { this.catalogModal.close(); } catch (e) { /* no-op */ }
  }
}
