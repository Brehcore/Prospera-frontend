import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { TrainingService } from '../../core/services/training.service';

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
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="btn-label">Página anterior</span>
        </button>
        <div class="page-info">
          Página <input type="number" [(ngModel)]="pageNum" min="1" [max]="numPages" 
            (change)="goToPage($event)" class="page-input"> de {{ numPages }}
        </div>
        <button class="btn btn-sm" (click)="nextPage()" [disabled]="pageNum >= numPages">
          <span class="btn-label">Próxima página</span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="spacer"></div>
        <button class="btn btn-sm" (click)="zoomIn()" title="Aumentar zoom">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/>
            <path d="M14 14L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M10 7v6M7 10h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="btn btn-sm" (click)="zoomOut()" title="Diminuir zoom">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/>
            <path d="M14 14L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M7 10h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="btn btn-sm" (click)="resetZoom()" title="Zoom padrão">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 3v4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- Canvas para renderização -->
      <div class="pdf-canvas-wrapper" (contextmenu)="$event.preventDefault()" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)">
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



    .btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      opacity: 0.5;
    }

    .btn-sm {
      padding: 0.3rem 0.5rem;
      font-size: 0.75rem;
    }

    .pdf-toolbar .btn svg {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      display: inline-block;
    }

    .pdf-toolbar .btn .btn-label { margin: 0 0.5rem; }

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
      /* Allow pinch to zoom and vertical pan gestures on modern browsers */
      touch-action: pan-y pinch-zoom;
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

    /* Responsive design para tablets e mobile */
    @media (max-width: 768px) {
      .pdf-toolbar {
        padding: 0.5rem;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .btn-sm {
        padding: 0.35rem 0.6rem;
        font-size: 0.75rem;
      }

      .pdf-toolbar .btn-label {
        display: none;
      }

      .pdf-toolbar .btn svg {
        width: 16px;
        height: 16px;
      }

      .page-input {
        width: 40px;
        padding: 0.3rem;
        font-size: 0.75rem;
      }

      .page-info {
        font-size: 0.75rem;
        gap: 0.3rem;
      }

      .pdf-canvas-wrapper {
        padding: 0.75rem;
      }
    }

    @media (max-width: 480px) {
      .pdf-toolbar {
        padding: 0.4rem;
        gap: 0.4rem;
      }

      .btn-sm {
        padding: 0.3rem 0.5rem;
        font-size: 0.7rem;
      }

      .pdf-toolbar .btn svg {
        width: 14px;
        height: 14px;
      }

      .page-input {
        width: 35px;
        padding: 0.25rem;
        font-size: 0.7rem;
      }

      .page-info {
        font-size: 0.7rem;
        gap: 0.25rem;
      }

      .pdf-canvas-wrapper {
        padding: 0.5rem;
      }

      .spacer {
        flex: 0.5;
      }

      /* Floating compact toolbar to avoid covering content on very small screens */
      .pdf-toolbar {
        position: absolute;
        left: 8px;
        right: 8px;
        top: 8px;
        z-index: 60;
        padding: 0.4rem;
        background: rgba(255,255,255,0.95);
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        gap: 0.4rem;
        align-items: center;
      }

      .pdf-canvas-wrapper {
        padding-top: 56px; /* make room for the floating toolbar */
      }

      .spacer { display: none; }
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
  private readonly trainingService = inject(TrainingService);
  private canvas: HTMLCanvasElement | null = null;
  private pdfDoc: any = null;
  private renderingPageNum = 0;
  private blobUrl: string | null = null; // URL blob para limpeza posterior

  // Touch/pinch state
  private touchInitialDistance: number | null = null;
  private touchInitialZoom = 1.0;
  private touchLastTap = 0;
  private pinchRaf: number | null = null;
  private initialZoom = 1.0; // Store calculated initial zoom

  pageNum = 1;
  numPages = 0;
  loading = false;
  error: string | null = null;
  zoom = 1.0; // Will be overridden by calculateInitialZoom() in ngOnInit

  constructor() {
    // Configurar worker do PDF.js para usar o arquivo local do pdfjs-dist
    // Este arquivo está em node_modules/pdfjs-dist/build/pdf.worker.min.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';

    // Bloquear shortcuts perigosos
    this.blockDangerousShortcuts();
  }

  ngOnInit(): void {
    // Se trainingId foi fornecido, fazer download seguro do blob primeiro
    if (this.trainingId) {
      this.downloadAndLoadPdfBlob();
      return;
    }

    // Fallback para pdfUrl direto
    if (!this.pdfUrl) {
      this.error = 'URL do PDF ou ID do treinamento não fornecido';
      return;
    }
    
    // Calculate initial zoom based on screen size for better mobile/tablet experience
    const calculatedZoom = this.calculateInitialZoom();
    this.zoom = calculatedZoom;
    this.initialZoom = calculatedZoom;
    this.loadPdf(this.pdfUrl);
  }

  /**
   * Download do PDF via HTTP (com autenticação via interceptor)
   * Converte o blob em URL local e carrega no PDF.js
   */
  private downloadAndLoadPdfBlob(): void {
    if (!this.trainingId) return;

    this.loading = true;
    this.error = null;

    this.trainingService.getEbookBlob(this.trainingId).subscribe({
      next: (blob: Blob) => {
        // Criar URL blob local (não requer requisição HTTP)
        this.blobUrl = URL.createObjectURL(blob);
        
        // Calculate initial zoom based on screen size
        const calculatedZoom = this.calculateInitialZoom();
        this.zoom = calculatedZoom;
        this.initialZoom = calculatedZoom;
        
        // Carregar PDF usando a URL blob segura
        this.loadPdf(this.blobUrl);
      },
      error: (err: any) => {
        this.error = `Erro ao fazer download do PDF: ${err?.message || 'Erro desconhecido'}`;
        this.loading = false;
        this.cdr.markForCheck();
        console.error('[PdfSecureViewer] Download error:', err);
      }
    });
  }

  private calculateInitialZoom(): number {
    const width = window.innerWidth;
    // Mobile: very small screens
    if (width <= 375) {
      return 0.55;
    }
    // Mobile: small screens
    if (width <= 480) {
      return 0.65;
    }
    // Tablet: medium screens
    if (width <= 768) {
      return 0.85;
    }
    // Desktop: full size
    return 1.0;
  }

  ngOnDestroy(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
    }
    // Limpar URL blob para liberar memória
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
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
          console.log('[PdfSecureViewer] Página renderizada:', pageNum, 'Callback disponível:', !!this.onPageChange);
          // Chamar callback quando página muda (inclui total de páginas)
          if (this.onPageChange) {
            console.log('[PdfSecureViewer] Chamando onPageChange callback com página:', pageNum, 'total:', this.numPages);
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

  // Touch handlers to enable pinch-to-zoom and double-tap to zoom
  onTouchStart(e: TouchEvent): void {
    try {
      if (e.touches && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchInitialDistance = Math.hypot(dx, dy);
        this.touchInitialZoom = this.zoom;
      }
    } catch (err) { }
  }

  onTouchMove(e: TouchEvent): void {
    try {
      if (e.touches && e.touches.length === 2 && this.touchInitialDistance) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / this.touchInitialDistance;
        let newZoom = this.touchInitialZoom * scale;
        newZoom = Math.max(0.5, Math.min(3.0, newZoom));
        this.zoom = newZoom;
        if (this.pinchRaf) cancelAnimationFrame(this.pinchRaf);
        this.pinchRaf = requestAnimationFrame(() => {
          this.renderPage(this.pageNum);
        });
        // Prevent page from zooming (native) while handling gesture
        e.preventDefault();
      }
    } catch (err) { }
  }

  onTouchEnd(e: TouchEvent): void {
    try {
      // Double-tap detection for quick zoom (within 300ms)
      const now = Date.now();
      if (e.changedTouches && e.changedTouches.length === 1) {
        if (now - this.touchLastTap < 300) {
          // double tap
          if (this.zoom > 1.1) {
            this.zoom = 1.0;
          } else {
            this.zoom = Math.min(2.0, this.zoom * 1.5);
          }
          this.renderPage(this.pageNum);
        }
        this.touchLastTap = now;
      }

      if (!e.touches || e.touches.length < 2) {
        this.touchInitialDistance = null;
        if (this.pinchRaf) { cancelAnimationFrame(this.pinchRaf); this.pinchRaf = null; }
      }
    } catch (err) { }
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
    this.zoom = this.initialZoom;
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
