import { CommonModule } from '@angular/common';
import { Component, inject, signal, effect, OnDestroy, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TrainingService } from '../../core/services/training.service';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { PdfSecureViewerComponent } from '../content/pdf-secure-viewer.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-training-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, PdfSecureViewerComponent],
  template: `
  <div class="lesson-layout" *ngIf="!loading() && training() as t">
    <!-- Header -->
    <header class="lesson-header">
      <h1>
        <span *ngIf="t.entityType === 'RECORDED_COURSE'">🎥</span>
        {{ t.title }}
        <button *ngIf="t.entityType === 'EBOOK'" class="fullscreen-btn" (click)="toggleFullscreen()">
          <span *ngIf="!isFullscreen()">⛶ Ver em Tela Cheia</span>
          <span *ngIf="isFullscreen()">✕ Sair</span>
        </button>
      </h1>
    </header>

    <!-- Container principal: Player + Sidebar -->
    <div class="lesson-content">
      <!-- RECORDED_COURSE: Video + Sidebar com aulas -->
      <div *ngIf="t.entityType === 'RECORDED_COURSE'" class="player-section">
        <section>
          <div *ngIf="currentLesson() as lesson; else noLesson" class="video-container">
            <iframe
              *ngIf="sanitizedVideoUrl()"
              [src]="sanitizedVideoUrl()"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen>
            </iframe>
            <video *ngIf="!sanitizedVideoUrl() && lesson.videoUrl" [src]="lesson.videoUrl" controls controlsList="nodownload" (ended)="onVideoEnded()" style="width:100%;height:100%"></video>
            <div *ngIf="!lesson.videoUrl" class="empty">Vídeo não disponível</div>
          </div>
          <ng-template #noLesson>
            <div class="empty">Selecione uma aula para começar</div>
          </ng-template>
        </section>
      </div>

      <!-- EBOOK: Apenas PDF (sem sidebar) -->
      <div *ngIf="t.entityType === 'EBOOK'" id="ebook-container" class="player-section" style="width: 100%; position:relative;">
        <section>
          <div *ngIf="pdfUrl(); else noPdf">
            <app-pdf-secure-viewer #pdfViewer
              [pdfUrl]="pdfUrl()!"
              [initialPage]="currentPage()"
              [trainingId]="t.id"
              [onPageChange]="onPageChange.bind(this)"
              style="height: 100%; display: block;">
            </app-pdf-secure-viewer>

            <!-- Fullscreen overlay controls (visible apenas em fullscreen) -->
            <div class="ebook-fullscreen-controls" *ngIf="isFullscreen()">
              <button class="fs-nav" *ngIf="currentPage() > 1" (click)="pdfPrev()">Anterior</button>
              <div class="fs-spacer"></div>
              <button class="fs-nav" *ngIf="currentPage() < numPages()" (click)="pdfNext()">Próxima</button>
            </div>
          </div>
          <ng-template #noPdf>
            <div class="empty">PDF não disponível</div>
          </ng-template>
        </section>
      </div>

      <!-- Sidebar (apenas RECORDED_COURSE) -->
      <aside class="lessons-sidebar" *ngIf="t.entityType === 'RECORDED_COURSE' && (t.modules || []).length > 0">
        <h2>Aulas</h2>
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="getProgressPercentage()"></div>
        </div>
        <div class="progress-text">{{ getProgressPercentage() }}% assistido</div>
          <div class="lessons-list">
          <div class="module" *ngFor="let mod of t.modules; let modIndex = index">
            <div class="module-title">{{ modIndex + 1 }}. {{ mod.title }}</div>
            <div class="lessons-in-module" *ngIf="mod.lessons && mod.lessons.length > 0">
              <button 
                class="lesson-item"
                *ngFor="let lesson of mod.lessons; let li = index"
                [class.active]="currentLesson()?.id === lesson.id"
                (click)="selectLesson(lesson)">
                <span class="lesson-number">{{ lesson.lessonOrder || (li + 1) }}</span>
                <span class="lesson-title">{{ lesson.title }}</span>
                <span class="lesson-icon" *ngIf="lesson.isCompleted">✓</span>
              </button>
            </div>
          </div>
            </div>
          <!-- Botão para marcar como concluída ao final da sidebar (igual ao admin) -->
          <button class="btn btn--success btn-complete-course" (click)="completeCurrentLesson()" *ngIf="isLastLesson()">✓ Marcar como Concluída</button>
        </aside>
    </div>

    <div *ngIf="error()" class="error">{{ error() }}</div>
  </div>

  <div *ngIf="loading()" class="loading">Carregando...</div>
  `,
  styles: [`
    .error { color:#b91c1c; padding: 1rem; background: #fee; border-radius: 4px; }
    .empty { padding: 2rem; text-align: center; color: #999; }
    .loading { padding: 2rem; text-align: center; color: #007bff; }

    .lesson-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f5f5f5;
    }

    .lesson-header {
      background: white;
      padding: 1.5rem;
      border-bottom: 1px solid #ddd;
    }

    .lesson-header h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .fullscreen-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: 12px;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      background: linear-gradient(180deg,#fff,#f3f6fa);
      border: 1px solid #d0d7e5;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .ebook-fullscreen-controls {
      position: absolute;
      bottom: 12px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      padding: 0 1rem;
      pointer-events: none;
    }

    .ebook-fullscreen-controls .fs-nav {
      pointer-events: auto;
      padding: 0.6rem 1rem;
      border-radius: 6px;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      font-weight: 600;
      cursor: pointer;
    }

    .ebook-fullscreen-controls .fs-nav:hover {
      background: rgba(0,0,0,0.75);
      transform: translateY(-1px);
    }

    .ebook-fullscreen-controls .fs-spacer { flex: 1; }

    .lesson-content {
      display: flex;
      flex: 1;
      gap: 1rem;
      padding: 1rem;
      overflow: hidden;
    }

    .player-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .player-section section {
      flex: 1;
      overflow: auto;
      background: #000;
    }

    .video-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .video-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .lessons-sidebar {
      width: 280px;
      background: white;
      border-radius: 8px;
      overflow-y: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 1rem;
    }

    .lessons-sidebar h2 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      border-bottom: 2px solid #007bff;
      padding-bottom: 0.5rem;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #eee;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #007bff, #0056b3);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.8rem;
      color: #666;
      text-align: center;
      margin-bottom: 1rem;
    }

    .lessons-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .module {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .module-title {
      font-weight: 700;
      font-size: 0.9rem;
      color: #333;
      padding: 0.5rem 0;
    }

    .lessons-in-module {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .lesson-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #f9f9f9;
      border: 1px solid #eee;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;
      text-align: left;
      color: #333;
    }

    .lesson-item:hover {
      background: #f0f7ff;
      border-color: #007bff;
    }

    .lesson-item.active {
      background: #007bff;
      color: white;
      border-color: #007bff;
      font-weight: 600;
    }

    .lesson-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: rgba(0,0,0,0.1);
      border-radius: 50%;
      flex-shrink: 0;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .lesson-item.active .lesson-number {
      background: rgba(255,255,255,0.3);
    }

    .lesson-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lesson-icon {
      color: #007bff;
      font-size: 1rem;
      flex-shrink: 0;
    }

    .lesson-item.active .lesson-icon {
      color: white;
    }

    .btn-complete-course {
      width: 100%;
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      font-weight: 600;
      border: none;
    }

    .btn-complete-course:hover {
      background: #218838;
    }

    @media (max-width: 768px) {
      .lesson-content {
        flex-direction: column;
      }
      .lessons-sidebar {
        width: 100%;
        max-height: 200px;
      }
    }
  `]
})
export class TrainingDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly trainingService = inject(TrainingService);
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly training = signal<any | null>(null);
  readonly currentLesson = signal<any | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pdfUrl = signal<string | null>(null);
  readonly sanitizedVideoUrl = signal<SafeResourceUrl | null>(null);
  readonly currentPage = signal(1);
  readonly isFullscreen = signal(false);
  readonly numPages = signal(0);

  private blobUrl: string | null = null;
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    effect(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) this.loadTraining(id);
    });

    // keep isFullscreen in sync with browser fullscreen changes
    const onFull = () => {
      const container = document.getElementById('ebook-container');
      this.isFullscreen.set(Boolean(container && document.fullscreenElement === container));
    };
    document.addEventListener('fullscreenchange', onFull);
    // store listener removal on destroy
    this._removeFullscreenListener = () => document.removeEventListener('fullscreenchange', onFull);
  }

  private _removeFullscreenListener: (() => void) | null = null;

  @ViewChild('pdfViewer') pdfViewer?: PdfSecureViewerComponent;

  private loadTraining(trainingId: string) {
    this.loading.set(true);
    this.error.set(null);

    const isAdmin = this.authService.hasRole('SYSTEM_ADMIN');

    if (isAdmin) {
      // Admin usa endpoint do admin
      this.adminService.getTrainingById(trainingId).subscribe({
        next: (t: any) => {
          this.training.set(t);
          if (t?.entityType === 'RECORDED_COURSE' && t?.['modules']?.[0]?.['lessons']?.[0]) {
            this.selectLesson(t['modules'][0]['lessons'][0]);
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Erro ao carregar treinamento');
          this.loading.set(false);
        }
      });
    } else {
      // Usuário normal tenta modules primeiro
      this.trainingService.getModules(trainingId).subscribe({
        next: (modules: any) => {
          if (modules && modules.length > 0) {
            // É RECORDED_COURSE
            const training: any = {
              id: trainingId,
              title: 'Treinamento',
              entityType: 'RECORDED_COURSE',
              modules
            };
            this.training.set(training);

            // Tentar extrair título do próprio payload dos módulos (quando disponível).
            // IMPORTANTE: não usar `modules[0].title` pois esse é o título do módulo,
            // não do curso. Preferir campos explícitos como `trainingTitle` ou `courseTitle`.
            const candidateTitle = modules[0]?.trainingTitle || modules[0]?.courseTitle || null;
            if (candidateTitle) {
              this.training.update(t => ({ ...t, title: candidateTitle }));
            } else {
              // Fallback: buscar nos meus enrollments para obter trainingTitle (se matriculado)
              this.trainingService.getMyEnrollments().subscribe({
                next: (enrolls: any[]) => {
                  const found = (enrolls || []).find(e => e.trainingId === trainingId && e.trainingTitle);
                  if (found && found.trainingTitle) this.training.update(t => ({ ...t, title: found.trainingTitle }));
                },
                error: () => {
                  // silencioso - manter título padrão
                }
              });
            }

            if (modules[0]?.['lessons']?.[0]) {
              this.selectLesson(modules[0]['lessons'][0]);
            }
            this.loading.set(false);
          } else {
            this.loadAsEbook(trainingId);
          }
        },
        error: () => this.loadAsEbook(trainingId)
      });
    }
  }

  private loadAsEbook(trainingId: string) {
    // Use TrainingService which builds the correct URL and includes auth headers
    this.trainingService.getEbookBlob(trainingId).subscribe({
      next: (blob) => {
        if (!blob || !blob.size) {
          this.error.set('E-book não disponível');
          this.loading.set(false);
          return;
        }

        // Try to detect PDF header
        try {
          const headerSlice = blob.slice(0, 5);
          headerSlice.text().then(header => {
            if (header && header.startsWith('%PDF')) {
              if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
              this.blobUrl = URL.createObjectURL(blob);
              this.pdfUrl.set(this.blobUrl);
              // set minimal training info and try resolve real title from enrollments
              this.training.set({ id: trainingId, title: 'E-book', entityType: 'EBOOK' });
              this.tryResolveTitleFromEnrollments(trainingId);
              this.loadEbookProgress(trainingId);
              this.loading.set(false);
              return;
            }

            // Not a PDF header — maybe blob contains textual URL
            blob.text().then(text => {
              const parsedUrl = (text || '').trim();
                if (parsedUrl && (parsedUrl.startsWith('http') || parsedUrl.startsWith('file:') || parsedUrl.startsWith('/'))) {
                this.pdfUrl.set(parsedUrl);
                this.training.set({ id: trainingId, title: 'E-book', entityType: 'EBOOK' });
                this.tryResolveTitleFromEnrollments(trainingId);
                this.loadEbookProgress(trainingId);
              } else {
                // fallback to admin-serving URL
                this.useAdminEbookUrl(trainingId);
              }
              this.loading.set(false);
            }).catch(() => {
              this.useAdminEbookUrl(trainingId);
              this.loading.set(false);
            });
          }).catch(() => {
            // fallback to object URL
            if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
            this.blobUrl = URL.createObjectURL(blob);
            this.pdfUrl.set(this.blobUrl);
            this.training.set({ id: trainingId, title: 'E-book', entityType: 'EBOOK' });
            this.loading.set(false);
          });
        } catch (e) {
          this.useAdminEbookUrl(trainingId);
          this.loading.set(false);
        }
      },
      error: () => {
        this.useAdminEbookUrl(trainingId);
        this.loading.set(false);
      }
    });
  }

  private tryResolveTitleFromEnrollments(trainingId: string) {
    // Attempt to find a nicer title from the user's enrollments
    this.trainingService.getMyEnrollments().subscribe({
      next: (enrolls: any[]) => {
        const found = (enrolls || []).find(e => String(e.trainingId) === String(trainingId) && e.trainingTitle);
        if (found && found.trainingTitle) {
          this.training.update(t => ({ ...(t || {}), title: found.trainingTitle }));
        }
      },
      error: () => {
        // silent
      }
    });
  }

  private useAdminEbookUrl(trainingId: string) {
    // For security: only admins may call admin endpoints.
    // Normal users must not call `/admin/*` endpoints — avoid 403 by skipping this.
    const isAdmin = this.authService.hasRole('SYSTEM_ADMIN');
    if (!isAdmin) {
      this.pdfUrl.set(null);
      this.error.set('E-book não disponível');
      return;
    }

    // Admins: try to fetch admin training details to extract file name
    this.adminService.getTrainingById(trainingId).subscribe({
      next: (t: any) => {
        const fileName = this.adminService.extractPdfFileName(t);
        const url = this.adminService.buildEbookFileUrl(fileName) || null;
        if (url) {
          this.pdfUrl.set(url);
          this.training.set(t);
        } else {
          this.pdfUrl.set(null);
          this.error.set('E-book não disponível');
        }
      },
      error: () => {
        this.pdfUrl.set(null);
        this.error.set('E-book não disponível');
      }
    });
  }

  selectLesson(lesson: any) {
    if (!lesson?.id) return;

    this.trainingService.getLesson(lesson.id).subscribe({
      next: (data) => {
        this.currentLesson.set(data);
        this.processLessonVideo(data);
      },
      error: () => {
        this.currentLesson.set(lesson);
        this.processLessonVideo(lesson);
      }
    });
  }

  private processLessonVideo(lesson: any) {
    try {
      const url = lesson?.videoUrl || null;
      if (!url) {
        this.sanitizedVideoUrl.set(null);
        return;
      }

      let videoUrl = String(url);
      // converter para embed quando aplicável
      videoUrl = this.convertToEmbedUrl(videoUrl);

      // se for externa, sanitizar
      if (this.isExternalVideoUrl(videoUrl)) {
        const safe = this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
        this.sanitizedVideoUrl.set(safe as SafeResourceUrl);
      } else {
        this.sanitizedVideoUrl.set(null);
      }
    } catch {
      this.sanitizedVideoUrl.set(null);
    }
  }

  onVideoEnded() {
    const lesson = this.currentLesson();
    if (!lesson || !lesson.id) return;
    // marcar como concluída e ir para próxima aula
    this.completeLessonById(lesson.id, true);
  }

  completeCurrentLesson() {
    const lesson = this.currentLesson();
    if (!lesson || !lesson.id) return;
    this.completeLessonById(lesson.id, false);
  }

  private completeLessonById(lessonId: string, autoNavigate: boolean) {
    this.trainingService.completeLessonFromApi(lessonId).subscribe({
      next: () => {
        // atualizar estado local
        const cur = this.currentLesson();
        if (cur && cur.id === lessonId) {
          cur.isCompleted = true;
          this.currentLesson.set({ ...cur });
        }
        // opcional: avançar para próxima aula
        if (autoNavigate) this.goToNextLessonViaApi();
      },
      error: () => {
        // falha silenciosa — mostrar erro quando necessário
      }
    });
  }

  goToNextLessonViaApi() {
    const lesson = this.currentLesson();
    if (!lesson || !lesson.id) return;

    // Primeiro, tentar endpoint /api/lessons/{id}/next
    this.trainingService.getNextLesson(lesson.id).subscribe({
      next: (next) => {
        if (next) {
          this.selectLesson(next);
          return;
        }
        // se API retornar null/no-content, usar fallback local
        const found = this.findNextLessonLocally(lesson.id);
        if (found) this.selectLesson(found);
      },
      error: () => {
        const found = this.findNextLessonLocally(lesson.id);
        if (found) this.selectLesson(found);
      }
    });
  }

  private findNextLessonLocally(currentLessonId: string): any | null {
    const t = this.training();
    if (!t || !t.modules) return null;
    for (let mi = 0; mi < t.modules.length; mi++) {
      const mod = t.modules[mi];
      if (!mod?.lessons) continue;
      for (let li = 0; li < mod.lessons.length; li++) {
        const l = mod.lessons[li];
        if (String(l.id) === String(currentLessonId)) {
          // próximo na mesma module
          if (li + 1 < mod.lessons.length) return mod.lessons[li + 1];
          // próximo módulo: primeiro da próxima module
          for (let nmi = mi + 1; nmi < t.modules.length; nmi++) {
            const nextMod = t.modules[nmi];
            if (nextMod?.lessons && nextMod.lessons.length > 0) return nextMod.lessons[0];
          }
          return null;
        }
      }
    }
    return null;
  }

  isLastLesson(): boolean {
    const lesson = this.currentLesson();
    const t = this.training();
    if (!lesson || !t || !t.modules) return false;
    // encontrar última lesson do último módulo
    for (let mi = t.modules.length - 1; mi >= 0; mi--) {
      const mod = t.modules[mi];
      if (mod?.lessons && mod.lessons.length) {
        const last = mod.lessons[mod.lessons.length - 1];
        return String(last.id) === String(lesson.id);
      }
    }
    return false;
  }

  private isExternalVideoUrl(url: string): boolean {
    if (!url) return false;
    return /^(https?:)?\/\//.test(url) || url.includes('youtube') || url.includes('vimeo');
  }

  private convertToEmbedUrl(url: string): string {
    if (!url) return url;
    if (url.includes('/embed/') || url.includes('player.vimeo.com')) return url;
    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  }

  canGoToPrevious(): boolean {
    const curr = this.currentLesson();
    if (!curr) return false;
    const modules = this.training()?.modules || [];
    return modules.some((m: any) =>
      m.lessons?.some((l: any) => l.lessonOrder === (curr.lessonOrder || 0) - 1)
    );
  }

  canGoToNext(): boolean {
    const curr = this.currentLesson();
    if (!curr) return false;
    const modules = this.training()?.modules || [];
    return modules.some((m: any) =>
      m.lessons?.some((l: any) => l.lessonOrder === (curr.lessonOrder || 0) + 1)
    );
  }

  getProgressPercentage(): number {
    const modules = this.training()?.modules || [];
    if (modules.length === 0) return 0;

    let totalLessons = 0;
    let completedLessons = 0;

    modules.forEach((m: any) => {
      m.lessons?.forEach((l: any) => {
        totalLessons++;
        if (l.isCompleted) completedLessons++;
      });
    });

    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  }

  // handle page change from viewer (pageNumber, totalPages?)
  onPageChange(pageNumber: number, totalPages?: number) {
    this.currentPage.set(pageNumber);
    if (typeof totalPages === 'number') this.numPages.set(totalPages);

    // Save progress for students
    const t = this.training();
    const trainingId = t?.id;
    if (trainingId) {
      this.trainingService.updateEbookProgress(String(trainingId), pageNumber).subscribe({
        next: () => {},
        error: () => {}
      });
    }
  }

  pdfPrev() {
    try {
      const comp = this.pdfViewer as any;
      if (comp && typeof comp.previousPage === 'function') {
        comp.previousPage();
      } else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      }
    } catch {}
  }

  pdfNext() {
    try {
      const comp = this.pdfViewer as any;
      if (comp && typeof comp.nextPage === 'function') {
        comp.nextPage();
      } else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      }
    } catch {}
  }

  toggleFullscreen() {
    const container = document.getElementById('ebook-container');
    if (!container) return;

    const isNowFullscreen = document.fullscreenElement === container;
    if (!isNowFullscreen) {
      container.requestFullscreen?.().then(() => this.isFullscreen.set(true)).catch(() => {});
    } else {
      // exit only if current fullscreen is our container
      if (document.fullscreenElement) {
        document.exitFullscreen?.().then(() => this.isFullscreen.set(false)).catch(() => {});
      }
    }
  }

  private loadEbookProgress(trainingId: string) {
    this.trainingService.getEbookProgress(trainingId).subscribe({
      next: (p) => {
        if (p && typeof p.lastPageRead === 'number' && p.lastPageRead > 0) {
          this.currentPage.set(p.lastPageRead);
        }
      },
      error: () => {
        // ignore
      }
    });
  }

  ngOnDestroy() {
    if (this.blobUrl) {
      try { URL.revokeObjectURL(this.blobUrl); } catch {}
    }
    if (this._removeFullscreenListener) {
      try { this._removeFullscreenListener(); } catch {}
    }
  }
}
