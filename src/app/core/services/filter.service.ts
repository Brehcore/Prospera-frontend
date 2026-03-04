import { Injectable, signal, computed, effect } from '@angular/core';

export interface FilterState {
  searchTerm: string;
  courseTypes: string[];
  sectors: string[];
  currentPage: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class FilterService {
  // Estado reativo para filtros
  private readonly searchTermSignal = signal<string>('');
  private readonly courseTypesSignal = signal<string[]>([]);
  private readonly sectorsSignal = signal<string[]>([]);
  private readonly currentPageSignal = signal<number>(1);
  private readonly pageSizeSignal = signal<number>(10);

  // Sinais computados para acesso público
  readonly searchTerm = this.searchTermSignal.asReadonly();
  readonly courseTypes = this.courseTypesSignal.asReadonly();
  readonly sectors = this.sectorsSignal.asReadonly();
  readonly currentPage = this.currentPageSignal.asReadonly();
  readonly pageSize = this.pageSizeSignal.asReadonly();

  constructor() {
    // Reset page when filters change
    effect(() => {
      this.searchTermSignal();
      this.courseTypesSignal();
      this.sectorsSignal();
      this.currentPageSignal.set(1);
    });
  }

  // Métodos para atualizar filtros
  setSearchTerm(term: string): void {
    this.searchTermSignal.set(term.trim());
  }

  toggleCourseType(courseType: string): void {
    const current = this.courseTypesSignal();
    if (current.includes(courseType)) {
      this.courseTypesSignal.set(current.filter(ct => ct !== courseType));
    } else {
      this.courseTypesSignal.set([...current, courseType]);
    }
  }

  setCourseTypes(courseTypes: string[]): void {
    this.courseTypesSignal.set(courseTypes);
  }

  toggleSector(sector: string): void {
    const current = this.sectorsSignal();
    if (current.includes(sector)) {
      this.sectorsSignal.set(current.filter(s => s !== sector));
    } else {
      this.sectorsSignal.set([...current, sector]);
    }
  }

  setSectors(sectors: string[]): void {
    this.sectorsSignal.set(sectors);
  }

  setCurrentPage(page: number): void {
    this.currentPageSignal.set(Math.max(1, page));
  }

  setPageSize(size: number): void {
    this.pageSizeSignal.set(size);
    this.currentPageSignal.set(1);
  }

  // Clear all filters
  reset(): void {
    this.searchTermSignal.set('');
    this.courseTypesSignal.set([]);
    this.sectorsSignal.set([]);
    this.currentPageSignal.set(1);
    this.pageSizeSignal.set(10);
  }

  // Get current filter state
  getFilterState(): FilterState {
    return {
      searchTerm: this.searchTermSignal(),
      courseTypes: this.courseTypesSignal(),
      sectors: this.sectorsSignal(),
      currentPage: this.currentPageSignal(),
      pageSize: this.pageSizeSignal()
    };
  }

  // Aplicar múltiplos filtros de uma vez
  applyFilters(state: Partial<FilterState>): void {
    if (state.searchTerm !== undefined) {
      this.searchTermSignal.set(state.searchTerm);
    }
    if (state.courseTypes !== undefined) {
      this.courseTypesSignal.set(state.courseTypes);
    }
    if (state.sectors !== undefined) {
      this.sectorsSignal.set(state.sectors);
    }
    if (state.currentPage !== undefined) {
      this.currentPageSignal.set(state.currentPage);
    }
    if (state.pageSize !== undefined) {
      this.pageSizeSignal.set(state.pageSize);
    }
  }
}
