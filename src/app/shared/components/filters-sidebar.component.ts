import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterService } from '../../core/services/filter.service';

@Component({
  selector: 'pros-filters-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="filters-sidebar" role="region" aria-label="Filtros de busca">
      <!-- Search Input -->
      <div class="filter-section">
        <h3 class="filter-section-title">Pesquisar</h3>
        <div class="search-input-wrapper">
          <i class="fas fa-search" aria-hidden="true"></i>
          <input
            type="search"
            class="search-input"
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Pesquisar por nome"
            aria-label="Pesquisar por nome"
          />
        </div>
      </div>

      <!-- Course Types -->
      <div class="filter-section" *ngIf="courseTypeOptions && courseTypeOptions.length">
        <h3 class="filter-section-title">Tipo de Curso</h3>
        <div class="checkbox-group">
          <label class="checkbox-label" *ngFor="let type of courseTypeOptions">
            <input
              type="checkbox"
              class="checkbox-input"
              [checked]="isCoursTypeSelected(type.value)"
              (change)="toggleCourseType(type.value)"
              [attr.aria-label]="'Filtrar por ' + type.label"
            />
            <span class="checkbox-text">{{ type.label }}</span>
          </label>
        </div>
      </div>

      <!-- Sectors -->
      <div class="filter-section" *ngIf="sectors && sectors.length">
        <h3 class="filter-section-title">Setores</h3>
        <div class="checkbox-group">
          <label class="checkbox-label" *ngFor="let sector of sectors">
            <input
              type="checkbox"
              class="checkbox-input"
              [checked]="isSectorSelected(sector)"
              (change)="toggleSector(sector)"
              [attr.aria-label]="'Filtrar por setor ' + sector"
            />
            <span class="checkbox-text">{{ sector }}</span>
          </label>
        </div>
      </div>

      <!-- Reset Filters Button -->
      <button
        class="btn-reset-filters"
        (click)="resetFilters()"
        *ngIf="hasActiveFilters()"
        type="button"
        aria-label="Limpar todos os filtros"
      >
        <i class="fas fa-redo" aria-hidden="true"></i>Limpar Filtros
      </button>
    </aside>
  `,
  styles: [`
    .filters-sidebar {
      background: white;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      min-width: 220px;
      flex-shrink: 0;
      overflow-y: auto;
      border: 1px solid rgba(76, 175, 80, 0.15);
      position: sticky;
      top: 80px;
      max-height: fit-content;
    }

    .filter-section {
      margin-bottom: 1.5rem;

      &:last-of-type {
        margin-bottom: 1rem;
      }
    }

    .filter-section-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary, #1a1a1a);
      margin: 0 0 1rem 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 0.875rem;
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      i {
        position: absolute;
        left: 12px;
        color: var(--text-secondary, #666);
        font-size: 0.875rem;
        pointer-events: none;
      }
    }

    .search-input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border: 2px solid var(--border-color, #e0e0e0);
      border-radius: 8px;
      font-size: 0.95rem;
      transition: all 0.3s ease;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: var(--verde-claro, #4CAF50);
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
      }

      &::placeholder {
        color: var(--text-tertiary, #999);
      }
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 6px;
      transition: background-color 0.2s ease;

      &:hover {
        background-color: var(--bg-hover, #f5f5f5);
      }
    }

    .checkbox-input {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--verde-claro, #4CAF50);
      flex-shrink: 0;
    }

    .checkbox-text {
      font-size: 0.95rem;
      color: var(--text-primary, #1a1a1a);
      user-select: none;
      word-break: break-word;
    }

    .btn-reset-filters {
      width: 100%;
      padding: 0.75rem 1rem;
      margin-top: 1.5rem;
      background-color: var(--border-color, #e0e0e0);
      color: var(--text-primary, #1a1a1a);
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;

      &:hover {
        background-color: var(--text-tertiary, #999);
        color: white;
      }

      i {
        font-size: 0.875rem;
      }
    }

    @media (max-width: 768px) {
      .filters-sidebar {
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        max-width: 320px;
        height: 100vh;
        z-index: 1000;
        border-radius: 0;
        max-height: 100vh;
      }

      .filter-section-title {
        font-size: 0.875rem;
      }

      .search-input {
        font-size: 1rem;
      }
    }
  `]
})
export class FiltersSidebarComponent {
  private readonly filterService = inject(FilterService);

  @Input() courseTypeOptions: Array<{ label: string; value: string }> = [
    { label: 'Cursos gravados', value: 'RECORDED_COURSE' },
    { label: 'E-Books', value: 'EBOOK' }
  ];

  @Input() sectors: string[] = [];

  get searchTerm(): string {
    return this.filterService.searchTerm();
  }

  set searchTerm(value: string) {
    this.filterService.setSearchTerm(value);
  }

  onSearchChange(term: string): void {
    this.filterService.setSearchTerm(term);
  }

  isCoursTypeSelected(courseType: string): boolean {
    return this.filterService.courseTypes().includes(courseType);
  }

  toggleCourseType(courseType: string): void {
    this.filterService.toggleCourseType(courseType);
  }

  isSectorSelected(sector: string): boolean {
    return this.filterService.sectors().includes(sector);
  }

  toggleSector(sector: string): void {
    this.filterService.toggleSector(sector);
  }

  hasActiveFilters(): boolean {
    const state = this.filterService.getFilterState();
    return !!(
      state.searchTerm ||
      state.courseTypes.length > 0 ||
      state.sectors.length > 0
    );
  }

  resetFilters(): void {
    this.filterService.reset();
  }
}
