import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogModalService } from '../../core/services/catalog-modal.service';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem, CatalogService, CatalogSector } from '../../core/services/catalog.service';
import { FormatLabelPipe } from '../../shared/pipes/format-label.pipe';
import { FilterService } from '../../core/services/filter.service';
import { FiltersSidebarComponent } from '../../shared/components/filters-sidebar.component';
import { PaginationComponent } from '../../shared/components/pagination.component';

@Component({
  selector: 'pros-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatLabelPipe, FiltersSidebarComponent, PaginationComponent],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss']
})
export class CatalogComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogModal = inject(CatalogModalService);
  public readonly filterService = inject(FilterService);

  readonly items = signal<CatalogItem[]>([]);
  readonly sectors = signal<CatalogSector[]>([]);
  readonly uniqueSectorNames = computed(() => {
    const allSectors = new Set<string>();
    this.items().forEach(item => {
      (item.sectors || []).forEach(sector => {
        const sectorName = this.sectorName(sector);
        if (sectorName) {
          allSectors.add(sectorName);
        }
      });
    });
    return Array.from(allSectors).sort();
  });

  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  private pendingDetailId: string | null = null;

  // Computed filtered items
  readonly filteredItems = computed(() => {
    const filterState = this.filterService.getFilterState();
    let result = [...this.items()];

    // Apply search filter
    if (filterState.searchTerm) {
      const term = filterState.searchTerm.toLowerCase();
      result = result.filter(item =>
        `${item.title} ${item.description}`.toLowerCase().includes(term)
      );
    }

    // Apply format filter (course types)
    if (filterState.courseTypes.length > 0) {
      result = result.filter(item => filterState.courseTypes.includes(item.format));
    }

    // Apply sector filter
    if (filterState.sectors.length > 0) {
      result = result.filter(item => {
        const itemSectors = (item.sectors || []).map(s => this.sectorName(s));
        return filterState.sectors.some(s => itemSectors.includes(s));
      });
    }

    return result;
  });

  // Computed paginated items
  readonly paginatedItems = computed(() => {
    const filterState = this.filterService.getFilterState();
    const filtered = this.filteredItems();
    const start = (filterState.currentPage - 1) * filterState.pageSize;
    const end = start + filterState.pageSize;
    return filtered.slice(start, end);
  });

  readonly totalItems = computed(() => this.filteredItems().length);

  readonly courseTypeOptions = [
    { label: 'Cursos gravados', value: 'RECORDED_COURSE' },
    { label: 'E-Books', value: 'EBOOK' }
  ];

  constructor() {}

  ngOnInit(): void {
    this.loadData();

    // react to query params to open an item directly (e.g. /catalog?id=...)
    this.route.queryParams.subscribe(params => {
      const id = params['id'] || params['itemId'] || params['trainingId'];
      if (id) {
        const sid = String(id);
        if (this.items().length) {
          const found = this.items().find(i => i.id === sid);
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
              this.items.set(items);
              const f = this.items().find(i => i.id === sid);
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

  // legacy controls removed: filtering now handled by FilterService and the sidebar component

  private loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.catalogService.loadCatalog().subscribe({
      next: items => {
        this.items.set(items);
        this.isLoading.set(false);
        // if there was a pending detail request from query params, try to open it
        if (this.pendingDetailId) {
          const found = this.items().find(i => i.id === this.pendingDetailId);
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
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });

    this.catalogService.loadSectors().subscribe({
      next: sectors => {
        const unique = this.ensureGlobalSector(sectors || []);
        this.sectors.set(unique);
      },
      error: () => {
        this.sectors.set(this.ensureGlobalSector([]));
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
    const found = this.sectors().find(s => s.id === id);
    const candidate = found?.name ?? id;
    // Hide raw GUID-like ids to avoid showing noise in the UI
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (guidRegex.test(candidate)) {
      return '';
    }
    return candidate;
  }

  onPageChange(page: number): void {
    this.filterService.setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onPageSizeChange(size: number): void {
    this.filterService.setPageSize(size);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    // Close global catalog modal if open
    try { this.catalogModal.close(); } catch (e) { /* no-op */ }
  }
}

