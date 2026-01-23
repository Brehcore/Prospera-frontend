import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Componente de visualização segura de PDF usando PDF.js puro.
 * Impede download, cópia, impressão via devtools e context menu.
 * Renderiza em canvas para máximo controle e segurança.
 */
@Component({
  selector: 'app-pdf-secure-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pdf-viewer-container">
      <!-- Controles -->
      <div class="pdf-toolbar">
        <button class="btn btn-sm" (click)="previousPage()" [disabled]="pageNum <= 1">
          ← Página anterior
        </button>
        <div class="page-info">
          Página <input type="number" [(ngModel)]="pageNum" min="1" [max]="numPages" 
            (change)="goToPage($event)" class="page-input"> de {{ numPages }}
        </div>
        <button class="btn btn-sm" (click)="nextPage()" [disabled]="pageNum >= numPages">
          Próxima página →
        </button>
        <div class="spacer"></div>
        <button class="btn btn-sm" (click)="zoomIn()" title="Aumentar zoom">🔍+</button>
        <button class="btn btn-sm" (click)="zoomOut()" title="Diminuir zoom">🔍−</button>
        <button class="btn btn-sm" (click)="resetZoom()" title="Zoom padrão">Reset</button>
      </div>

      <!-- Canvas para renderização -->
      <div class="pdf-canvas-wrapper" (contextmenu)="$event.preventDefault()">
        <canvas 
          #pdfCanvas 
          class="pdf-canvas"
          [style.cursor]="'default'"
          (mousedown)="$event.preventDefault()"
          (selectstart)="$event.preventDefault()">
        </canvas>
      </div>

      <!-- Erro -->
      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .pdf-viewer-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    .pdf-toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: #fff;
      border-bottom: 1px solid #ddd;
      flex-wrap: wrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .btn {
      padding: 0.5rem 1rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.2s;
    }

    .btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      opacity: 0.5;
    }

    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
    }

    .page-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .page-input {
      width: 50px;
      padding: 0.4rem;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 0.875rem;
    }

    .spacer {
      flex: 1;
    }

    .pdf-canvas-wrapper {
      flex: 1;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 1rem;
      background: #e8e8e8;
      user-select: none;
      -webkit-user-select: none;
    }

    .pdf-canvas {
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      background: white;
      user-select: none;
      -webkit-user-select: none;
      user-drag: none;
      -webkit-user-drag: none;
    }

    .loading, .error {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      font-size: 1rem;
    }

    .error {
      color: #b91c1c;
      background: #fee;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PdfSecureViewerComponent implements OnInit, OnDestroy {
  @Input() pdfUrl: string | null = null;
  @Input() initialPage: number = 1; // Página inicial para restaurar progresso
  @Input() trainingId: string | null = null; // ID do treinamento para salvar progresso
  @Input() onPageChange: ((page: number, numPages?: number) => void) | null = null; // Callback quando página muda

  private readonly cdr = inject(ChangeDetectorRef);
  private canvas: HTMLCanvasElement | null = null;
  private pdfDoc: any = null;
  private renderingPageNum = 0;

  pageNum = 1;
  numPages = 0;
  loading = false;
  error: string | null = null;
  zoom = 1.0;

  constructor() {
    // Configurar worker do PDF.js para usar o arquivo local do pdfjs-dist
    // Este arquivo está em node_modules/pdfjs-dist/build/pdf.worker.min.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';

    // Bloquear shortcuts perigosos
    this.blockDangerousShortcuts();
  }

  ngOnInit(): void {
    if (!this.pdfUrl) {
      this.error = 'URL do PDF não fornecida';
      return;
    }
    this.loadPdf(this.pdfUrl);
  }

  ngOnDestroy(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
    }
  }

  private loadPdf(url: string): void {
    this.loading = true;
    this.error = null;

    pdfjsLib.getDocument(url).promise
      .then((doc: any) => {
        this.pdfDoc = doc;
        this.numPages = doc.numPages;
        // Use initialPage se fornecido, caso contrário página 1
        const startPage = Math.max(1, Math.min(this.initialPage || 1, doc.numPages));
        this.renderPage(startPage);
        this.loading = false;
        this.cdr.markForCheck();
      })
      .catch((err: any) => {
        this.error = `Erro ao carregar PDF: ${err.message}`;
        this.loading = false;
        this.cdr.markForCheck();
        console.error('[PdfSecureViewer] Load error:', err);
      });
  }

  private renderPage(pageNum: number): void {
    if (!this.pdfDoc || pageNum < 1 || pageNum > this.numPages) return;

    this.renderingPageNum = pageNum;
    this.pdfDoc.getPage(pageNum).then((page: any) => {
      if (this.renderingPageNum !== pageNum) return; // Render foi cancelado

      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const viewport = page.getViewport({ scale: this.zoom });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise
        .then(() => {
          this.pageNum = pageNum;
          // Chamar callback quando página muda (inclui total de páginas)
          if (this.onPageChange) {
            this.onPageChange(pageNum, this.numPages);
          }
          this.cdr.markForCheck();
        })
        .catch((err: any) => {
          console.error('[PdfSecureViewer] Render error:', err);
        });
    });
  }

  previousPage(): void {
    if (this.pageNum > 1) {
      this.renderPage(this.pageNum - 1);
    }
  }

  nextPage(): void {
    if (this.pageNum < this.numPages) {
      this.renderPage(this.pageNum + 1);
    }
  }

  goToPage(event: any): void {
    let page = parseInt(event?.target?.value || this.pageNum, 10);
    page = Math.max(1, Math.min(page, this.numPages));
    this.renderPage(page);
  }

  zoomIn(): void {
    this.zoom = Math.min(this.zoom + 0.2, 3.0);
    this.renderPage(this.pageNum);
  }

  zoomOut(): void {
    this.zoom = Math.max(this.zoom - 0.2, 0.5);
    this.renderPage(this.pageNum);
  }

  resetZoom(): void {
    this.zoom = 1.0;
    this.renderPage(this.pageNum);
  }

  /**
   * Bloqueia shortcuts que poderiam ser usados para baixar/copiar
   * - Ctrl+S (Save)
   * - Ctrl+P (Print)
   * - F12, Ctrl+Shift+I (DevTools)
   * - Ctrl+C (Copy) - opcional, pode ser restritivo
   */
  private blockDangerousShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ctrl+S ou Cmd+S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.warn('Download impedido por segurança');
        return;
      }

      // Ctrl+P ou Cmd+P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        console.warn('Impressão impedida por segurança');
        return;
      }

      // F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        console.warn('DevTools bloqueado por segurança');
        return;
      }

      // Ctrl+Shift+I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        console.warn('DevTools bloqueado por segurança');
        return;
      }
    });
  }
}
