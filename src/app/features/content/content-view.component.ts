import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { LessonService } from '../../core/services/lesson.service';
import { PdfSecureViewerComponent } from './pdf-secure-viewer.component';

@Component({
  selector: 'app-content-view',
  standalone: true,
  imports: [CommonModule, RouterModule, PdfSecureViewerComponent],
  template: `
  <div class="content-view" *ngIf="loading() && !error(); else loaded">
    <p>Carregando conteúdo…</p>
  </div>
  <ng-template #loaded>
    <div *ngIf="error()" class="error">{{ error() }}</div>
    <div *ngIf="training() as t" class="lesson-layout">
      <!-- Header com título da aula atual -->
      <header class="lesson-header">
        <h1>
          <span *ngIf="t.entityType === 'RECORDED_COURSE'">🎥</span>
          {{ t.title }}
        </h1>
      </header>

      <!-- Container principal: Player + Sidebar -->
      <div class="lesson-content">
        <!-- Main content (Video/PDF) -->
        <div class="player-section">
          <!-- Video player para RECORDED_COURSE -->
          <section *ngIf="t.entityType === 'RECORDED_COURSE'">
            <div *ngIf="videoUrl; else noVideo" class="video-container">
              <!-- Se for YouTube, usar div para YT.Player -->
              <div 
                *ngIf="isExternalVideoUrl(videoUrl) && videoUrl.includes('youtube')"
                #youtubePlayer
                class="video-container-inner">
              </div>
              <!-- Se for URL de iframe (Vimeo, etc) -->
              <iframe 
                *ngIf="isExternalVideoUrl(videoUrl) && !videoUrl.includes('youtube')"
                [src]="sanitizedVideoUrl"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen>
              </iframe>
              <!-- Se for arquivo de vídeo local -->
              <video 
                #videoPlayer
                *ngIf="!isExternalVideoUrl(videoUrl)"
                [src]="videoUrl" 
                controls 
                controlsList="nodownload"
                (ended)="onVideoEnded()">
              </video>
            </div>
            <ng-template #noVideo>
              <div class="empty">Vídeo não disponível para este conteúdo.</div>
            </ng-template>
          </section>

          <!-- PDF viewer para EBOOK -->
          <section *ngIf="t.entityType === 'EBOOK'">
            <div *ngIf="rawPdfUrl; else noPdf">
              <app-pdf-secure-viewer 
                [pdfUrl]="rawPdfUrl" 
                [initialPage]="currentPage()" 
                [trainingId]="trainingId()"
                [onPageChange]="onPageChange.bind(this)"
                style="height: 600px; display: block;"></app-pdf-secure-viewer>
            </div>
            <ng-template #noPdf>
              <div class="empty">PDF não disponível para este conteúdo.</div>
            </ng-template>
          </section>

          <!-- Controles de navegação de aulas -->
          <div class="lesson-controls" *ngIf="currentLesson() as lesson">
            <button class="btn btn--ghost" (click)="previousLesson(lesson)" *ngIf="training()?.entityType === 'EBOOK'">← Anterior</button>
          </div>
        </div>

        <!-- Sidebar com lista de aulas -->
        <aside class="lessons-sidebar" *ngIf="(training()?.modules || []).length">
          <h2>Aulas</h2>
          <!-- Barra de progresso de vídeos assistidos -->
          <div class="progress-bar" *ngIf="training()?.entityType === 'RECORDED_COURSE'">
            <div class="progress-fill" [style.width.%]="getVideoProgress()"></div>
          </div>
          <div class="progress-text" *ngIf="training()?.entityType === 'RECORDED_COURSE'">
            {{ getVideoProgress() }}% assistido
          </div>
          <div class="lessons-list">
            <div class="module" *ngFor="let m of training()?.modules; let mi = index">
              <div class="module-title">{{ mi + 1 }}. {{ m.title }}</div>
              <div class="lessons-in-module">
                <button 
                  *ngFor="let l of m.lessons; let li = index" 
                  class="lesson-item"
                  [class.active]="currentLesson()?.id === l.id"
                  (click)="selectLesson(l)">
                  <span class="lesson-number">{{ li + 1 }}</span>
                  <span class="lesson-title">{{ l.title }}</span>
                  <span class="lesson-icon" *ngIf="l.content">▶</span>
                </button>
              </div>
            </div>
          </div>
          <!-- Botão para marcar como concluído ao final da sidebar -->
          <button class="btn btn--success btn-complete-course" (click)="completeLesson(currentLesson())" *ngIf="isLastLesson()">
            ✓ Marcar como Concluída
          </button>
        </aside>
      </div>
    </div>
  </ng-template>
  `,
  styles: [`
    .error { color:#b91c1c; padding: 1rem; background: #fee; border-radius: 4px; }
    .muted { color:#64748b; font-size:.85rem }
    .small { font-size:.8rem }
    .empty { padding: 2rem; text-align: center; color: #999; }

    .content-view {
      padding: 2rem;
      text-align: center;
      color: #666;
    }

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
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .lesson-header h1 {
      margin: 0;
      font-size: 1.5rem;
      flex: 1;
    }

    .header-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.9rem;
      color: #666;
    }

    .training-id {
      background: #f0f7ff;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 600;
      color: #007bff;
    }

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

    .video-container-inner {
      width: 100%;
      height: 100%;
    }

    .video-container video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .video-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .lesson-controls {
      display: flex;
      gap: 0.75rem;
      padding: 1rem;
      background: #f9f9f9;
      border-top: 1px solid #ddd;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn--primary {
      background: #007bff;
      color: white;
    }

    .btn--primary:hover {
      background: #0056b3;
    }

    .btn--ghost {
      background: transparent;
      color: #007bff;
      border: 1px solid #007bff;
    }

    .btn--ghost:hover {
      background: #f0f7ff;
    }

    .btn--success {
      background: #28a745;
      color: white;
    }

    .btn--success:hover {
      background: #218838;
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

    @media (max-width: 1024px) {
      .lessons-sidebar {
        width: 220px;
        padding: 0.75rem;
      }

      .lesson-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    @media (max-width: 768px) {
      .lesson-content {
        flex-direction: column;
      }

      .lessons-sidebar {
        width: 100%;
        max-height: 200px;
        border-radius: 0;
      }
    }
  `]
})
export class ContentViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly lesson = inject(LessonService);
  private readonly sanitizer = inject(DomSanitizer);

  training = signal<any | null>(null);
  trainingId = signal<string | null>(null);
  currentPage = signal<number>(1);
  currentLesson = signal<any | null>(null);
  watchedLessons = signal<Set<string>>(new Set()); // IDs de vídeos já assistidos
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  isFullscreen = signal<boolean>(false);
  rawPdfUrl: string | null = null;
  videoUrl: string | null = null;
  sanitizedVideoUrl: SafeResourceUrl | null = null;
  private blobUrl: string | null = null;
  @ViewChild('videoPlayer') videoPlayer: ElementRef<HTMLVideoElement> | undefined;
  @ViewChild('youtubePlayer') youtubePlayer: ElementRef<HTMLDivElement> | undefined;
  private youtubePlayer_instance: any = null; // Instância do YT.Player
  private ytApiLoaded = false; // Flag para controlar se a API foi carregada

  ngOnDestroy(): void {
    if (this.blobUrl) {
      try { URL.revokeObjectURL(this.blobUrl); } catch {}
      this.blobUrl = null;
    }
    if (this.youtubePlayer_instance) {
      try { this.youtubePlayer_instance.destroy(); } catch {}
      this.youtubePlayer_instance = null;
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    try { console.debug('[ContentView] init, route id=', id); } catch {}
    if (!id) {
      this.error.set('ID do conteúdo ausente.');
      this.loading.set(false);
      return;
    }
    this.loadTraining(id);
  }

  private loadTraining(id: string) {
    try { console.debug('[ContentView] loadTraining start', { id }); } catch {}
    this.trainingId.set(id); // Armazenar ID para usar nos endpoints de progresso
    this.loading.set(true); this.error.set(null);
    
    // Sempre tentar carregar o training para determinar seu tipo
    const loadTrainingData = (this.auth?.isSystemAdmin && this.auth.isSystemAdmin() || this.auth?.hasOrganizationRole && this.auth.hasOrganizationRole('ORG_ADMIN'))
      ? this.admin.getTrainingById(id)
      : this.admin.getTrainingById(id); // Tentar admin endpoint mesmo para non-admins (vai falhar se não tiver permissão)
    
    loadTrainingData.subscribe({
      next: t => {
        this.training.set(t as any);
        try { console.debug('[ContentView] training loaded', t); } catch {}
        // Carregar progresso apenas se for EBOOK
        const et = (t as any)?.entityType;
        const isRecordedCourse = typeof et === 'string' && String(et).toUpperCase() === 'RECORDED_COURSE';
        if (!isRecordedCourse) {
          this.loadProgress(id);
        }
        this.handleTrainingContent(t);
      },
      error: err => {
        try { console.error('[ContentView] getTrainingById error', err); } catch {}
        // Se falhar (provavelmente 403 para non-admin), trata como EBOOK
        this.training.set({ entityType: 'EBOOK' } as any);
        this.loadProgress(id);
        this.fetchStudentEbookUrl(id, null);
      }
    });
  }

  /**
   * Trata o conteúdo carregado baseado no entityType
   */
  private handleTrainingContent(training: any): void {
    const et = (training as any)?.entityType;
    const isRecordedCourse = typeof et === 'string' && String(et).toUpperCase() === 'RECORDED_COURSE';
    const hasEbookDetails = !!(training as any)?.ebookDetails;
    const isEbookType = typeof et === 'string' && String(et).toUpperCase().includes('EBOOK');
    
    if (isRecordedCourse) {
      // Para RECORDED_COURSE, chamar endpoint de lessons se houver lessons
      const lessons = (training as any)?.modules?.[0]?.lessons || [];
      if (lessons.length > 0) {
        this.selectLesson(lessons[0]); // Selecionar primeira lição
      } else {
        this.loading.set(false);
      }
    } else if (isEbookType || hasEbookDetails || this.admin.trainingHasPdf(training)) {
      // Para EBOOK, buscar o URL do PDF
      this.fetchStudentEbookUrl((training as any)?.id || '', training);
    } else {
      this.loading.set(false);
    }
  }

  /**
   * Seleciona uma lição e carrega seu conteúdo
   */
  selectLesson(lesson: any): void {
    try { console.debug('[ContentView] selectLesson called', { lessonId: lesson?.id, lessonTitle: lesson?.title }); } catch {}
    console.log('[DEBUG] selectLesson:', lesson);
    console.log('[DEBUG] selectLesson completo:', JSON.stringify(lesson, null, 2));
    
    this.currentLesson.set(lesson);
    try { 
      console.debug('[ContentView] currentLesson.set() completed', { currentLesson: this.currentLesson() }); 
      console.debug('[ContentView] Full training data:', {
        trainingId: this.training()?.id,
        trainingTitle: this.training()?.title,
        modules: this.training()?.modules?.map((m: any, idx: number) => ({
          index: idx,
          title: m.title,
          lessonsCount: m.lessons?.length,
          lessons: m.lessons?.map((l: any, lIdx: number) => ({
            lIndex: lIdx,
            id: l.id,
            title: l.title
          }))
        }))
      });
      console.debug('[ContentView] isLastLesson() result:', this.isLastLesson());
    } catch {}
    
    // Se é RECORDED_COURSE, carregar o vídeo
    if (lesson?.id) {
      console.log('[DEBUG] Carregando vídeo da lição');
      this.loadRecordedCourseVideo(lesson.id);
    }
  }

  /**
   * Carrega o vídeo de um RECORDED_COURSE chamando GET /api/lessons/{lessonId}
   */
  private loadRecordedCourseVideo(lessonId: string): void {
    try { console.debug('[ContentView] loadRecordedCourseVideo', { lessonId }); } catch {}
    console.log('[DEBUG] Chamando GET /api/lessons/' + lessonId);
    this.api.get<any>(`/api/lessons/${encodeURIComponent(lessonId)}`).subscribe({
      next: lesson => {
        console.log('[DEBUG] Resposta recebida:', lesson);
        try { console.debug('[ContentView] lesson loaded', lesson); } catch {}
        
        console.log('[DEBUG] lesson object:', JSON.stringify(lesson, null, 2));
        console.log('[DEBUG] lesson.videoUrl:', lesson?.videoUrl);
        
        if (lesson?.videoUrl) {
          let videoUrl = lesson.videoUrl;
          console.log('[DEBUG] URL original:', videoUrl);
          
          // Converter URLs de YouTube para formato embed se necessário
          videoUrl = this.convertToEmbedUrl(videoUrl);
          console.log('[DEBUG] URL convertida:', videoUrl);
          
          this.videoUrl = videoUrl;
          // Sanitizar URL se for externa (YouTube, Vimeo, etc)
          if (this.isExternalVideoUrl(videoUrl)) {
            this.sanitizedVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
            try { console.debug('[ContentView] video URL sanitized for iframe', { url: videoUrl }); } catch {}
            
            // Se for YouTube, carregar a API e criar player
            if (videoUrl.includes('youtube.com/embed') || videoUrl.includes('youtu.be')) {
              console.log('[DEBUG] YouTube detectado, carregando YouTube IFrame API');
              this.loadYouTubeAPI();
            }
          }
          try { console.debug('[ContentView] video URL set', this.videoUrl); } catch {}
        } else {
          console.log('[DEBUG] Aviso: lesson.videoUrl não foi encontrado no response');
          console.log('[DEBUG] Propriedades disponíveis:', Object.keys(lesson || {}));
        }
        this.loading.set(false);
      },
      error: err => {
        console.log('[DEBUG] Erro ao carregar lição:', err);
        try { console.error('[ContentView] failed to load lesson', err); } catch {}
        this.error.set('Falha ao carregar o vídeo');
        this.loading.set(false);
      }
    });
  }

  /**
   * Carrega a YouTube IFrame API dinamicamente
   * Cria um player quando a API fica pronta
   */
  private loadYouTubeAPI(): void {
    if (this.ytApiLoaded) {
      console.log('[DEBUG] YouTube API já estava carregada, criando player');
      this.createYouTubePlayer();
      return;
    }
    
    // Verificar se o script já existe na página
    if (!document.getElementById('youtube-api')) {
      const script = document.createElement('script');
      script.id = 'youtube-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      console.log('[DEBUG] Script YouTube IFrame API adicionado');
    }
    
    // Aguardar a API ficar pronta
    const checkYTReady = () => {
      if (typeof (window as any).YT !== 'undefined' && (window as any).YT.Player) {
        console.log('[DEBUG] YouTube API pronta');
        this.ytApiLoaded = true;
        this.createYouTubePlayer();
      } else {
        // Tentar novamente em 100ms
        setTimeout(checkYTReady, 100);
      }
    };
    
    setTimeout(checkYTReady, 100);
  }

  /**
   * Cria uma instância do YouTube Player no div youtubePlayer
   */
  private createYouTubePlayer(): void {
    if (!this.youtubePlayer?.nativeElement) {
      console.log('[DEBUG] youtubePlayer ref não disponível ainda');
      // Tentar novamente mais tarde
      setTimeout(() => this.createYouTubePlayer(), 200);
      return;
    }

    if (this.youtubePlayer_instance) {
      try { this.youtubePlayer_instance.destroy(); } catch {}
    }

    const videoUrl = this.videoUrl || '';
    // Extrair video ID da URL embed
    const videoIdMatch = videoUrl.match(/embed\/([a-zA-Z0-9_-]+)/);
    if (!videoIdMatch) {
      console.log('[DEBUG] Não foi possível extrair video ID da URL:', videoUrl);
      return;
    }

    const videoId = videoIdMatch[1];
    const container = this.youtubePlayer!.nativeElement;
    
    console.log('[DEBUG] Criando YouTube Player com video ID:', videoId);
    console.log('[DEBUG] Dimensões do container:', { width: container.clientWidth, height: container.clientHeight });

    const YT = (window as any).YT;
    this.youtubePlayer_instance = new YT.Player(container, {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        controls: 1,
        modestbranding: 1
      },
      events: {
        'onStateChange': (event: any) => this.onYouTubeStateChange(event),
        'onError': (event: any) => this.onYouTubeError(event)
      }
    });

    console.log('[DEBUG] YouTube Player criado');
  }

  /**
   * Callback do YouTube Player para mudanças de estado
   * Estados: -1 (não iniciado), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
   */
  private onYouTubeStateChange(event: any): void {
    const YT = (window as any).YT;
    if (event.data === YT.PlayerState.ENDED) {
      console.log('[DEBUG] [YouTube] Video terminado, disparando onVideoEnded');
      this.onVideoEnded();
    }
  }

  /**
   * Callback de erro do YouTube Player
   */
  private onYouTubeError(event: any): void {
    console.log('[DEBUG] [YouTube] Erro no player:', event.data);
  }

  /**
   * Converte URLs de YouTube para formato embed
   * Também suporta Vimeo player URLs
   * 
   * https://www.youtube.com/watch?v=dQw4w9WgXcQ → https://www.youtube.com/embed/dQw4w9WgXcQ
   * https://youtu.be/dQw4w9WgXcQ → https://www.youtube.com/embed/dQw4w9WgXcQ
   * https://vimeo.com/123456 → https://player.vimeo.com/video/123456
   */
  private convertToEmbedUrl(url: string): string {
    if (!url) return url;
    
    // Se já está em formato embed, retorna como está
    if (url.includes('/embed/') || url.includes('player.vimeo.com')) {
      return url;
    }
    
    // Extrair video ID de diferentes formatos de YouTube
    let videoId = '';
    
    // Formato: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
      videoId = watchMatch[1];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // Formato: https://youtu.be/VIDEO_ID
    const shortenedMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortenedMatch) {
      videoId = shortenedMatch[1];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // Formato Vimeo: https://vimeo.com/VIDEO_ID
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      videoId = vimeoMatch[1];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    
    // Se não é uma URL reconhecida, retorna original
    // (pode ser URL pré-assinada, relativa, ou blob)
    return url;
  }

  /**
   * Verifica se a URL é de um vídeo externo que precisa de iframe (YouTube, Vimeo embed, etc)
   * ou se é um arquivo de vídeo direto/blob que deve usar <video>
   * 
   * Para plataformas como Vimeo que bloqueiam acesso externo:
   * - O backend deve retornar a URL de embed já pronta
   * - Ou retornar a URL do arquivo de vídeo hospedado no próprio servidor
   * 
   * Exemplos:
   * - YouTube embed: "https://www.youtube.com/embed/VIDEO_ID" → iframe
   * - Vimeo embed: "https://player.vimeo.com/video/VIDEO_ID" → iframe
   * - URL pré-assinada: "https://s3.amazonaws.com/videos/lesson-1?token=..." → video
   * - URL relativa: "/api/videos/lesson-1.mp4" → video
   * - Blob URL: "blob:http://localhost/..." → video
   */
  isExternalVideoUrl(url: string | null): boolean {
    if (!url) return false;
    
    // Detecta se é URL de iframe de plataformas de vídeo públicas
    const isEmbedUrl = url.includes('youtube.com/embed') || 
                       url.includes('youtu.be') ||
                       url.includes('player.vimeo.com') ||
                       url.includes('vimeo.com/embed');
    
    return isEmbedUrl;
  }

  private fetchStudentEbookUrl(id: string, training: any) {
    // primeiro tenta endpoint de streaming do estudante
    try { console.debug('[ContentView] fetchStudentEbookUrl calling student stream endpoint (blob)', { id }); } catch {}
    const url = this.api.createUrl(`/stream/ebooks/${encodeURIComponent(id)}`);
    // Use HttpClient to request blob so we can pass auth headers the app already manages
    this.http
      .get(url, { responseType: 'blob' })
      .subscribe({
        next: blob => {
          try { console.debug('[ContentView] fetchStudentEbookUrl got blob', blob); } catch {}
          if (!blob || !blob.size) {
            this.useAdminEbookUrl(training);
            this.loading.set(false);
            return;
          }

          // Check the first bytes to detect PDF signature rather than relying on blob.type
          try {
            const headerSlice = blob.slice(0, 5);
            // Blob.text() returns a Promise<string>
            headerSlice.text().then(header => {
              try { console.debug('[ContentView] fetchStudentEbookUrl header', header); } catch {}
              if (header && header.startsWith('%PDF')) {
                // It's a PDF stream — create object URL for the viewer
                if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
                this.blobUrl = URL.createObjectURL(blob);
                this.rawPdfUrl = this.blobUrl;
                try { console.debug('[ContentView] object URL created', { blobUrl: this.blobUrl, rawPdfUrl: this.rawPdfUrl }); } catch {}
                this.loading.set(false);
                return;
              }

              // Not a PDF header — maybe the blob contains a textual URL or JSON. Try to read text.
              blob.text().then(text => {
                try { console.debug('[ContentView] fetchStudentEbookUrl blob->text', (text || '').slice(0,200)); } catch {}
                const parsedUrl = (text || '').trim();
                if (parsedUrl && (parsedUrl.startsWith('http') || parsedUrl.startsWith('file:') || parsedUrl.startsWith('/'))) {
                  this.rawPdfUrl = parsedUrl;
                  try { console.debug('[ContentView] using parsed URL from blob text', { parsedUrl: this.rawPdfUrl }); } catch {}
                } else {
                  this.useAdminEbookUrl(training);
                }
                this.loading.set(false);
              }).catch(() => {
                // reading as text failed — fallback to admin url
                this.useAdminEbookUrl(training);
                this.loading.set(false);
              });
            }).catch(() => {
              // If header reading fails, still try to create an object URL (best-effort)
              if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
              this.blobUrl = URL.createObjectURL(blob);
              this.rawPdfUrl = this.blobUrl;
              try { console.debug('[ContentView] object URL created (fallback)', { blobUrl: this.blobUrl, rawPdfUrl: this.rawPdfUrl }); } catch {}
              this.loading.set(false);
            });
          } catch (e) {
            // Any unexpected error — fallback to admin url
            try { console.warn('[ContentView] fetchStudentEbookUrl header check failed', e); } catch {}
            this.useAdminEbookUrl(training);
            this.loading.set(false);
          }
        },
        error: err => {
          try { console.warn('[ContentView] fetchStudentEbookUrl error (will fallback to admin URL)', err); } catch {}
          this.useAdminEbookUrl(training);
          this.loading.set(false);
        }
      });
  }

  private useAdminEbookUrl(training: any) {
    const fileName = this.admin.extractPdfFileName(training);
    const url = this.admin.buildEbookFileUrl(fileName) || null;
    if (url) {
      this.rawPdfUrl = url;
    } else {
      this.rawPdfUrl = null;
    }
  }

  openLessonAsStudent(lesson: any) {
    if (!lesson || !lesson.id) return;
    // tentar obter recurso da lição (próximo/preview) via endpoint público
    this.api.get<any>(`/api/lessons/${encodeURIComponent(lesson.id)}/next`).subscribe({
      next: res => {
        // abrir conteúdo se houver URL
        const url = res?.url || res?.file || res?.content;
        if (url) window.open(url, '_blank');
        else alert('Conteúdo da aula não disponível para visualização.');
      },
      error: err => {
        console.warn('Falha ao carregar lição', err);
        alert('Falha ao carregar o conteúdo da lição.');
      }
    });
  }

  previousLesson(lesson: any) {
    if (!lesson || !lesson.id) return;
    // navegar para a aula anterior via endpoint público
    this.api.get<any>(`/api/lessons/${encodeURIComponent(lesson.id)}/previous`).subscribe({
      next: res => {
        // abrir conteúdo da aula anterior se houver URL
        const url = res?.url || res?.file || res?.content;
        if (url) window.open(url, '_blank');
        else alert('Aula anterior não disponível.');
      },
      error: err => {
        console.warn('Falha ao carregar aula anterior', err);
        alert('Falha ao navegar para a aula anterior.');
      }
    });
  }

  completeLesson(lesson: any) {
    if (!lesson || !lesson.id) return;
    this.api.post<any>(`/lessons/${encodeURIComponent(lesson.id)}/complete`, {}).subscribe({
      next: () => alert('Aula marcada como concluída.'),
      error: err => alert(err?.message || 'Falha ao marcar aula como concluída.')
    });
  }

  /**
   * Chamado quando um vídeo acaba
   */
  onVideoEnded(): void {
    const lesson = this.currentLesson();
    console.log('[DEBUG] onVideoEnded disparado', { lesson: lesson?.title, lessonId: lesson?.id });
    
    if (!lesson) {
      console.log('[DEBUG] Erro: lesson é null');
      return;
    }
    
    try { console.debug('[ContentView] Video ended:', { lessonId: lesson.id, lessonTitle: lesson.title }); } catch {}
    
    // Marcar vídeo como assistido localmente
    this.watchedLessons.update(watched => {
      console.log('[DEBUG] Adicionando vídeo aos assistidos:', lesson.id);
      watched.add(lesson.id);
      console.log('[DEBUG] Vídeos assistidos:', Array.from(watched));
      return watched;
    });
    
    // Chamar endpoint para persistir a conclusão no backend
    this.markLessonComplete(lesson.id);
    
    // Ir para próximo vídeo usando endpoint /next
    this.goToNextLessonViaApi();
  }

  /**
   * Marca a lição como concluída no backend
   * POST /api/lessons/{lessonId}/complete
   */
  private markLessonComplete(lessonId: string): void {
    console.log('[DEBUG] Chamando markLessonAsCompleted para:', lessonId);
    this.lesson.markLessonAsCompleted(lessonId).subscribe({
      next: response => {
        console.log('[DEBUG] [✓] Lição marcada como concluída no backend:', response);
        try { console.debug('[ContentView] Lesson marked as completed:', { lessonId, response }); } catch {}
      },
      error: err => {
        console.log('[DEBUG] [✗] Erro ao marcar lição como concluída:', err);
        console.log('[DEBUG] Status:', err.status);
        console.log('[DEBUG] Message:', err.message);
        try { console.warn('[ContentView] Erro ao marcar lição como concluída:', err); } catch {}
      }
    });
  }

  /**
   * Navega para o próximo vídeo usando o endpoint /api/lessons/{id}/next
   * Retorna 200 + LessonDTO se houver próxima lição, ou 204 No Content se não houver
   */
  private goToNextLessonViaApi(): void {
    const lesson = this.currentLesson();
    console.log('[DEBUG] goToNextLessonViaApi chamado', { lesson: lesson?.title });
    
    if (!lesson || !lesson.id) {
      console.log('[DEBUG] Erro: lesson ou lesson.id é null');
      return;
    }
    
    const url = this.api.createUrl(`/api/lessons/${encodeURIComponent(lesson.id)}/next`);
    console.log('[DEBUG] Chamando GET', url);
    
    try { console.debug('[ContentView] Buscando próxima aula via API'); } catch {}
    
    // Usar HttpClient diretamente para capturar o status HTTP
    this.http.get<any>(url, { observe: 'response' }).subscribe({
      next: response => {
        console.log('[DEBUG] Response status:', response.status);
        console.log('[DEBUG] Response body:', response.body);
        
        // 204 No Content significa que não há próxima lição
        if (response.status === 204 || !response.body) {
          console.log('[DEBUG] Fim do curso - não há próxima lição');
          try { console.debug('[ContentView] Curso completo!'); } catch {}
          return;
        }
        
        const nextLesson = response.body;
        try { console.debug('[ContentView] Próxima aula encontrada:', nextLesson); } catch {}
        
        if (nextLesson && nextLesson.id) {
          console.log('[DEBUG] Selecionando próxima aula:', nextLesson.title);
          this.selectLesson(nextLesson);
        } else {
          console.log('[DEBUG] Resposta inválida');
        }
      },
      error: err => {
        // 204 No Content pode vir como erro também, dependendo da config do HttpClient
        if (err.status === 204) {
          console.log('[DEBUG] Fim do curso (204 erro)');
          return;
        }
        console.log('[DEBUG] ERRO ao buscar próxima aula:', err);
        console.log('[DEBUG] Status:', err.status);
        try { console.warn('[ContentView] Erro ao buscar próxima aula:', err); } catch {}
      }
    });
  }

  /**
   * Calcula o progresso de vídeos assistidos
   */
  getVideoProgress(): number {
    const training = this.training();
    if (!training) return 0;
    
    let totalLessons = 0;
    for (const module of (training.modules || [])) {
      totalLessons += (module.lessons || []).length;
    }
    
    if (totalLessons === 0) return 0;
    return Math.round((this.watchedLessons().size / totalLessons) * 100);
  }

  /**
   * Verifica se a lição atual é a última do último módulo
   */
  isLastLesson(): boolean {
    const training = this.training();
    const lesson = this.currentLesson();
    
    try { console.debug('[ContentView] isLastLesson check', { trainingId: training?.id, lessonId: lesson?.id, trainingModules: training?.modules?.length, currentLessonTitle: lesson?.title }); } catch {}
    
    if (!training || !lesson) {
      try { console.debug('[ContentView] isLastLesson: training or lesson null', { hasTraining: !!training, hasLesson: !!lesson }); } catch {}
      return false;
    }
    
    const modules = training.modules || [];
    if (modules.length === 0) {
      try { console.debug('[ContentView] isLastLesson: no modules'); } catch {}
      return false;
    }
    
    const lastModule = modules[modules.length - 1];
    const lessons = lastModule.lessons || [];
    if (lessons.length === 0) {
      try { console.debug('[ContentView] isLastLesson: no lessons in last module'); } catch {}
      return false;
    }
    
    const lastLesson = lessons[lessons.length - 1];
    const isLast = lastLesson?.id === lesson.id;
    try { console.debug('[ContentView] isLastLesson result', { lastLessonId: lastLesson?.id, currentLessonId: lesson.id, isLast }); } catch {}
    return isLast;
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(current => !current);
    
    // Aplicar fullscreen do navegador se disponível
    if (!this.isFullscreen()) {
      // Sair do fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  /**
   * Carrega o progresso de leitura do ebook do servidor
   */
  private loadProgress(trainingId: string): void {
    try { console.debug('[ContentView] loadProgress', { trainingId }); } catch {}
    this.api.get<any>(`/progress/ebooks/${encodeURIComponent(trainingId)}`).subscribe({
      next: (progress: any) => {
        if (progress?.lastPageRead && progress.lastPageRead > 0) {
          try { console.debug('[ContentView] progress loaded, setting page to', progress.lastPageRead); } catch {}
          this.currentPage.set(progress.lastPageRead);
        }
      },
      error: (err: any) => {
        try { console.warn('[ContentView] failed to load progress', err); } catch {}
        // Não é erro crítico, apenas começa da página 1
      }
    });
  }

  /**
   * Callback chamado quando o usuário muda de página no PDF
   */
  onPageChange(pageNum: number): void {
    try { console.debug('[ContentView] page changed to', pageNum); } catch {}
    this.currentPage.set(pageNum);
    
    // Salvar progresso no servidor
    const id = this.trainingId();
    if (id) {
      this.api.put(`/progress/ebooks/${encodeURIComponent(id)}`, { lastPageRead: pageNum }).subscribe({
        next: () => {
          try { console.debug('[ContentView] progress saved', { pageNum }); } catch {}
        },
        error: (err: any) => {
          try { console.warn('[ContentView] failed to save progress', err); } catch {}
        }
      });
    }
  }
}
