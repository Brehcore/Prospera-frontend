import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'pros-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagination-container" role="region" aria-label="Paginação">
      <!-- Page Size Selector -->
      <div class="pagination-page-size">
        <label for="pageSize" class="page-size-label">Itens por página:</label>
        <select
          id="pageSize"
          class="page-size-select"
          [value]="pageSize"
          (change)="onPageSizeChange($event)"
          [attr.aria-label]="'Escolher quantidade de itens por página'"
        >
          <option value="10">10</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      <!-- Pagination Controls -->
      <div class="pagination-controls">
        <!-- Previous Button -->
        <button
          type="button"
          class="pagination-btn pagination-btn-prev"
          (click)="onPreviousPage()"
          [disabled]="currentPage <= 1"
          aria-label="Página anterior"
        >
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
          Anterior
        </button>

        <!-- Page Numbers -->
        <div class="pagination-numbers">
          <button
            type="button"
            *ngFor="let page of pageNumbers"
            class="pagination-number"
            [class.active]="page === currentPage"
            (click)="onPageChange(page)"
            [attr.aria-label]="'Ir para página ' + page"
            [attr.aria-current]="page === currentPage ? 'page' : null"
          >
            {{ page }}
          </button>
        </div>

        <!-- Next Button -->
        <button
          type="button"
          class="pagination-btn pagination-btn-next"
          (click)="onNextPage()"
          [disabled]="currentPage >= totalPages"
          aria-label="Próxima página"
        >
          Próxima
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Page Info -->
      <div class="pagination-info">
        <span class="info-text">
          Página <strong>{{ currentPage }}</strong> de <strong>{{ totalPages }}</strong>
          (Total: <strong>{{ totalItems }}</strong> itens)
        </span>
      </div>
    </div>
  `,
  styles: [`
    .pagination-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      margin-top: 3rem;
      border: 1px solid rgba(76, 175, 80, 0.1);
    }

    .pagination-page-size {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
    }

    .page-size-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-primary, #1a1a1a); 
      white-space: nowrap;
    }

    .page-size-select {
      padding: 0.35rem 0.5rem;
      border: 2px solid var(--border-color, #e0e0e0);
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.3s ease;
      background-color: white;

      &:hover {
        border-color: var(--verde-claro, #4CAF50);
      }

      &:focus {
        outline: none;
        border-color: var(--verde-claro, #4CAF50);
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
      }
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .pagination-btn {
      padding: 0.4rem 0.8rem;
      border: 2px solid var(--verde-claro, #4CAF50);
      background-color: white;
      color: var(--verde-claro, #4CAF50);
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.7rem;

      &:hover:not(:disabled) {
        background-color: var(--verde-claro, #4CAF50);
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(76, 175, 80, 0.2);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        border-color: var(--text-tertiary, #999);
        color: var(--text-tertiary, #999);
      }

      i {
        font-size: 0.85rem;
      }
    }

    .pagination-numbers {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .pagination-number {
      padding: 0.35rem 0.6rem;
      border: 2px solid var(--border-color, #e0e0e0);
      background-color: white;
      color: var(--text-primary, #1a1a1a);
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 36px;
      text-align: center;

      &:hover:not(.active) {
        border-color: var(--verde-claro, #4CAF50);
        color: var(--verde-claro, #4CAF50);
        background-color: rgba(76, 175, 80, 0.05);
      }

      &.active {
        background-color: var(--verde-claro, #4CAF50);
        color: white;
        border-color: var(--verde-claro, #4CAF50);
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
      }
    }

    .pagination-info {
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-secondary, #666);

      .info-text {
        display: inline-block;
      }

      strong {
        color: var(--text-primary, #1a1a1a);
        font-weight: 600;
      }
    }

    @media (max-width: 768px) {
      .pagination-container {
        padding: 1.5rem;
      }

      .pagination-controls {
        flex-direction: column;
        width: 100%;
      }

      .pagination-btn {
        width: 100%;
        justify-content: center;
      }

      .pagination-numbers {
        max-width: 100%;
      }

      .pagination-page-size {
        flex-direction: column;
        width: 100%;
      }

      .page-size-select {
        width: 100%;
      }
    }
  `]
})
export class PaginationComponent {
  @Input() currentPage = 1;
  @Input() pageSize = 10;
  @Input() totalItems = 0;

  @Output() pageChanged = new EventEmitter<number>();
  @Output() pageSizeChanged = new EventEmitter<number>();

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = Math.min(5, this.totalPages);
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxPages - 1);

    startPage = Math.max(1, endPage - maxPages + 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChanged.emit(page);
    }
  }

  onNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.pageChanged.emit(this.currentPage + 1);
    }
  }

  onPreviousPage(): void {
    if (this.currentPage > 1) {
      this.pageChanged.emit(this.currentPage - 1);
    }
  }

  onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newSize = parseInt(target.value, 10);
    if (newSize > 0 && newSize !== this.pageSize) {
      this.pageSizeChanged.emit(newSize);
    }
  }
}
