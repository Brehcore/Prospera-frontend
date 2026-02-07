import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { LessonService } from '../../core/services/lesson.service';
import { TrainingService } from '../../core/services/training.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PublicationStatusPipe } from '../../core/pipes/publication-status.pipe';
import { PdfSecureViewerComponent } from './pdf-secure-viewer.component';

/**
 * Componente unificado para visualização de treinamentos
 * 
 * Combina:
 * - ContentViewComponent (estudante - aulas de RECORDED_COURSE)
 * - TrainingDetailComponent (estudante - catálogo)
 * - AdminTrainingDetailComponent (admin - gerenciamento)
 * 
 * Detecta automaticamente:
 * - Role do usuário (SYSTEM_ADMIN vs estudante)
 * - Tipo de conteúdo (EBOOK, RECORDED_COURSE)
 * - Rota de acesso (/admin/conteudo vs /conteudo/visualizar)
 */
@Component({
  selector: 'app-training-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule, PublicationStatusPipe, PdfSecureViewerComponent],
  template: `
  <div class="training-viewer-container">
    <!-- Admin View (com edição) -->
    <div *ngIf="isAdmin() && !isStudentView()" class="admin-view">
      <div class="training-detail-page" *ngIf="training() as t">
        <div class="header-row" *ngIf="training() as t">
          <div class="title-block">
            <a class="back-link" routerLink="/admin">← Voltar</a>
            <h1 class="title">{{t.title}}</h1>
          </div>
          <div class="action-bar">
            <button type="button" class="btn btn--primary" (click)="publish()" [disabled]="publishing() || (t.publicationStatus||'').toLowerCase()==='published'">
              {{ (t.publicationStatus||'').toLowerCase()==='published' ? 'Publicado' : 'Publicar' }}
            </button>
            <label class="btn btn--outline file-btn">
              <span>Upload PDF</span>
              <input type="file" accept="application/pdf" (change)="onPdfSelected($any($event.target).files[0]); $event.target.value=''; $event.stopPropagation();" hidden />
            </label>
            <label class="btn btn--outline file-btn">
              <span>Upload Capa</span>
              <input type="file" accept="image/*" (change)="onCoverSelected($any($event.target).files[0]); $event.target.value=''; $event.stopPropagation();" hidden />
            </label>
            <button type="button" class="btn btn--subtle" (click)="openEditMetadata()">Atualizar</button>
          </div>
        </div>
        <div *ngIf="loading()" class="loading skeleton">Carregando...</div>
        <div *ngIf="error()" class="error">{{error()}}</div>
        <div class="progress-bar top" *ngIf="uploadProgress() !== null">
          <div class="bar" [style.width.%]="uploadProgress()||0"></div>
        </div>

        <!-- Metadata Card (Admin only) -->
        <div class="cards" *ngIf="!loading() && training() as t">
          <section class="card meta-card">
            <div class="cover-meta">
              <figure class="cover" *ngIf="t.coverImageUrl as cover">
                <img [src]="cover" alt="Capa" title="Capa" (error)="coverBroken.set(true)" *ngIf="!coverBroken()" />
                <div class="cover-fallback" *ngIf="coverBroken()">Sem capa</div>
                <figcaption *ngIf="trainingHasPdf(t)" class="pdf-flag">PDF</figcaption>
              </figure>
              <div class="meta-grid">
                <div class="field"><label>ID</label><div class="value mono">{{t.id}}</div></div>
                <div class="field"><label>Autor</label><div class="value">{{t.author || '—'}}</div></div>
                <div class="field"><label>Tipo</label><div class="value">{{t.entityType || '—'}}</div></div>
                <div class="field"><label>Status</label><div class="value"><span class="badge" [class.badge-active]="(t.publicationStatus||'').toLowerCase()==='published'" [class.badge-inactive]="(t.publicationStatus||'').toLowerCase()!=='published'">{{ (t.publicationStatus || '—') | publicationStatus }}</span></div></div>
                <div class="field"><label>Criado</label><div class="value">{{t.createdAt | date:'dd/MM/yyyy HH:mm'}}</div></div>
                <div class="field"><label>Atualizado</label><div class="value">{{t.updatedAt | date:'dd/MM/yyyy HH:mm'}}</div></div>
              </div>
            </div>
          </section>

          <!-- Modal de editar metadados -->
          <div class="overlay" *ngIf="showEditModal()" (click)="closeEditMetadata()"></div>
          <div class="create-modal" *ngIf="showEditModal()" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" style="max-width:640px;">
            <form (submit)="$event.preventDefault(); submitEditMetadata();">
              <h3 style="margin-top:0">Atualizar informações do treinamento</h3>
              <label style="display:block;margin-bottom:.4rem">Título</label>
              <input type="text" [value]="editForm().title" (input)="setEditField('title',$any($event.target).value)" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem;" />
              <label style="display:block;margin-bottom:.4rem">Descrição</label>
              <textarea [value]="editForm().description" (input)="setEditField('description',$any($event.target).value)" style="width:100%;min-height:120px;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem;"></textarea>
              <label style="display:block;margin-bottom:.4rem">Autor</label>
              <input type="text" [value]="editForm().author" (input)="setEditField('author',$any($event.target).value)" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem;" />
              <div style="display:flex;gap:.5rem;justify-content:flex-end">
                <button type="button" class="btn btn--subtle" (click)="closeEditMetadata()" [disabled]="editing()">Cancelar</button>
                <button type="submit" class="btn btn--primary" [disabled]="editing()">{{ editing() ? 'Salvando...' : 'Salvar' }}</button>
              </div>
              <div *ngIf="editError()" class="error" style="margin-top:.5rem">{{editError()}}</div>
            </form>
          </div>

          <!-- E-book section (Admin) -->
          <section class="card" *ngIf="t.entityType==='EBOOK' && t.ebookDetails as ed">
            <h2 class="card-title">E-book</h2>
            <div class="kv-grid">
              <div class="kv-item"><span class="k">Arquivo</span><span class="v mono">{{ed.filePath || extractPdfFileName(t) || '—'}}</span></div>
              <div class="kv-item"><span class="k">Páginas</span><span class="v">{{ed.totalPages || '—'}}</span></div>
              <div class="kv-item"><span class="k">Upload</span><span class="v">{{ed.fileUploadedAt | date:'short'}}</span></div>
            </div>
            <div class="ebook-actions" *ngIf="trainingHasPdf(t)">
              <a *ngIf="buildEbookFileUrl(extractPdfFileName(t)) as pdfUrl" class="btn btn--ghost btn-xs" [href]="pdfUrl" target="_blank" rel="noopener">Abrir PDF</a>
              <button *ngIf="buildEbookFileUrl(extractPdfFileName(t)) as pdfUrl" class="btn btn--outline btn-xs" (click)="openAdminViewer(pdfUrl)">{{ showAdminViewer() ? 'Fechar Visualizador' : 'Ver Inline' }}</button>
            </div>
          </section>

          <!-- Inline admin viewer -->
          <section *ngIf="showAdminViewer() && adminPdfUrl" class="card" style="padding:0;">
            <div id="admin-inline-ebook" style="position:relative; height:640px;">
              <app-pdf-secure-viewer
                [pdfUrl]="adminPdfUrl"
                [initialPage]="adminCurrentPage()"
                [onPageChange]="adminOnPageChange"
                style="height:100%; display:block;">
              </app-pdf-secure-viewer>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Student View (visualização apenas) -->
    <div *ngIf="!isAdmin() || isStudentView()" class="student-view">
      <div class="content-view" *ngIf="loading() && !error(); else loaded">
        <p>Carregando conteúdo…</p>
      </div>
      <ng-template #loaded>
        <div *ngIf="error()" class="error">{{ error() }}</div>
        <div *ngIf="training() as t" class="lesson-layout">
          <!-- Header com título da aula atual -->
          <header class="lesson-header">
            <button class="btn-back" (click)="goBack()" title="Voltar para Cursos & Treinamentos" aria-label="Voltar">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <h1>
              <span *ngIf="t.entityType === 'RECORDED_COURSE'"></span>
              {{ t.title }}
            </h1>
            <div>
              <button *ngIf="t.entityType === 'EBOOK'" class="fullscreen-btn" (click)="toggleFullscreen()" title="Modo tela cheia">
                <svg *ngIf="!isFullscreen()" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3H5c-1.1 0-2 .9-2 2v3m16-5h3v3M3 16v3c0 1.1.9 2 2 2h3m11 0h3c1.1 0 2-.9 2-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg *ngIf="isFullscreen()" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3v3c0 1.1-.9 2-2 2H3m16-5h-3c-1.1 0-2 .9-2 2v3M3 16v3c0 1.1 .9 2 2 2h3m11 0h3c1.1 0 2-.9 2-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span *ngIf="!isFullscreen()">Tela Cheia</span>
                <span *ngIf="isFullscreen()">Sair</span>
              </button>
              <button *ngIf="t.entityType === 'RECORDED_COURSE'" class="toggle-lessons-btn" (click)="toggleSidebarMobile()" aria-label="Alternar lista de aulas">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 4h18M3 12h18M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Aulas
              </button>
            </div>
          </header>

          <!-- Container principal: Player + Sidebar -->
          <div class="lesson-content">
            <!-- Main content (Video/PDF) -->
            <div class="player-section">
              <!-- Video player para RECORDED_COURSE -->
              <section *ngIf="t.entityType === 'RECORDED_COURSE'">
                <div *ngIf="videoUrl; else noVideo" id="player-container" class="video-container">
                  <div class="video-frame">
                    <div 
                      *ngIf="isExternalVideoUrl(videoUrl) && videoUrl.includes('youtube')"
                      #youtubePlayer
                      class="video-container-inner">
                    </div>
                    <iframe 
                      *ngIf="isExternalVideoUrl(videoUrl) && !videoUrl.includes('youtube')"
                      class="video-embed"
                      [src]="sanitizedVideoUrl"
                      frameborder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen>
                    </iframe>
                    <video 
                      #videoPlayer
                      *ngIf="!isExternalVideoUrl(videoUrl)"
                      class="video-embed"
                      [src]="videoUrl" 
                      controls 
                      controlsList="nodownload"
                      (ended)="onVideoEnded()">
                    </video>
                  </div>
                  <div class="last-lesson-actions" [class.invisible]="!showMarkCompleteOption()">
                    <button class="btn btn--success" (click)="completeCurrentLesson()">Marcar como concluída</button>
                    <button class="btn btn--subtle" (click)="showMarkCompleteOption.set(false)">Fechar</button>
                  </div>
                </div>
                <ng-template #noVideo>
                  <div class="empty">Vídeo não disponível para este conteúdo.</div>
                </ng-template>
              </section>

              <!-- PDF viewer para EBOOK -->
              <section *ngIf="t.entityType === 'EBOOK'">
                <div id="ebook-container" [class.fullscreen-admin]="isFullscreen() && isAdmin()" style="position:relative;">
                  <div *ngIf="rawPdfUrl; else noPdf">
                    <app-pdf-secure-viewer #pdfViewer
                      [pdfUrl]="rawPdfUrl"
                      [initialPage]="currentPage()"
                      [trainingId]="trainingId()"
                      [onPageChange]="onPageChange.bind(this)"
                      style="height: 100%; display: block;"></app-pdf-secure-viewer>
                    
                    <!-- Navegação em fullscreen -->
                    <div class="fullscreen-nav" *ngIf="isFullscreen()">
                        <button class="fs-nav-btn fs-nav-prev" *ngIf="currentPage() > 1" (click)="pdfPrev()" title="Página anterior">
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          <span class="fs-nav-label">Anterior</span>
                        </button>
                      <div class="fs-nav-spacer"></div>
                        <button class="fs-nav-btn fs-nav-next" *ngIf="currentPage() < numPages()" (click)="pdfNext()" title="Próxima página">
                          <span class="fs-nav-label">Próximo</span>
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>
                    </div>
                  </div>
                  <ng-template #noPdf>
                    <div class="empty">PDF não disponível para este conteúdo.</div>
                  </ng-template>
                </div>
              </section>
            </div>

            <!-- Sidebar com lista de aulas -->
            <aside class="lessons-sidebar" [class.hidden-mobile]="!sidebarVisibleMobile()" *ngIf="(training()?.modules || []).length">
              <h2>Aulas</h2>
              <div class="progress-bar" *ngIf="training()?.entityType === 'RECORDED_COURSE'">
                <div class="progress-fill" [style.width.%]="getVideoProgress()"></div>
              </div>
              <div class="progress-text" *ngIf="training()?.entityType === 'RECORDED_COURSE'">
                {{ getVideoProgress() }}% assistido
              </div>
              <div class="lessons-list" [class.hidden-mobile]="!sidebarVisibleMobile()">
                <div class="module" *ngFor="let m of training()?.modules; let mi = index">
                  <div class="module-title">{{ mi + 1 }}. {{ m.title }}</div>
                  <div class="lessons-in-module">
                    <button 
                      *ngFor="let l of m.lessons; let li = index" 
                      class="lesson-item"
                      [class.active]="currentLesson()?.id === l.id"
                      (click)="selectLesson(l)">
                      <span class="lesson-number">{{ li + 1 }}</span>
                      <span class="lesson-title" [attr.title]="l.title" [attr.aria-label]="l.title">{{ l.title }}</span>
                      <span class="lesson-icon" *ngIf="l.content">▶</span>
                    </button>
                  </div>
                </div>
              </div>
              <button class="btn btn--success btn-complete-course" (click)="completeLesson(currentLesson())" *ngIf="isLastLesson()">
                ✓ Marcar como Concluída
              </button>
            </aside>
          </div>
        </div>
      </ng-template>
    </div>
  </div>
  `,
  styles: [`
    .training-viewer-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    /* ===== ADMIN VIEW STYLES ===== */
    .admin-view {
      padding: 1.5rem clamp(0.75rem, 2vw, 1.5rem) 3rem;
    }

    .training-detail-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      gap: 1.25rem;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .title-block {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-width: 260px;
    }

    .back-link {
      text-decoration: none;
      font-size: 0.7rem;
      color: #4f46e5;
      font-weight: 600;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .title {
      margin: 0;
      font-size: 1.4rem;
      line-height: 1.1;
      font-weight: 600;
      letter-spacing: -0.5px;
      color: #1e293b;
    }

    .action-bar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .toggle-lessons-btn { display: none; }

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

    .btn--outline {
      background: transparent;
      color: #007bff;
      border: 1px solid #007bff;
    }

    .btn--outline:hover {
      background: #f0f7ff;
    }

    .btn--subtle {
      background: transparent;
      color: #666;
      border: none;
    }

    .btn--subtle:hover {
      color: #333;
    }

    .file-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      background: linear-gradient(180deg, #fff, #f3f6fa);
      border: 1px solid #d0d7e5;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .progress-bar.top {
      position: relative;
      height: 5px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: -0.5rem;
    }

    .progress-bar .bar {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, #6366f1, #818cf8);
      transition: width 0.25s;
    }

    .cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .meta-card {
      grid-column: 1 / -1;
    }

    .cover-meta {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
    }

    .cover {
      width: 180px;
      height: 240px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0f0f0;
      color: #999;
    }

    .pdf-flag {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: #28a745;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .meta-grid {
      display: grid;
      flex: 1;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      align-content: start;
    }

    .meta-grid .field {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.55rem 0.65rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      position: relative;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .meta-grid label {
      font-size: 0.55rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
    }

    .value {
      font-size: 0.72rem;
      font-weight: 500;
      color: #1e293b;
      word-break: break-word;
    }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.62rem;
    }

    .badge {
      display: inline-block;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 600;
    }

    .badge-active {
      background: linear-gradient(90deg, #22c55e, #16a34a);
      color: #fff;
    }

    .badge-inactive {
      background: linear-gradient(90deg, #f87171, #dc2626);
      color: #fff;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.45);
      z-index: 60;
    }

    .create-modal {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 70;
      background: #ffffff;
      border-radius: 12px;
      padding: 1rem;
      box-shadow: 0 10px 40px rgba(2, 6, 23, 0.24);
      width: clamp(320px, 90%, 640px);
      max-height: 90vh;
      overflow: auto;
    }

    .kv-grid {
      display: grid;
      gap: 0.6rem;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .kv-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      font-size: 0.6rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .kv-item .k {
      font-size: 0.55rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }

    .kv-item .v {
      font-size: 0.7rem;
      font-weight: 500;
      color: #1e293b;
    }

    .ebook-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .btn-xs {
      padding: 0.3rem 0.6rem;
      font-size: 0.75rem;
    }

    #admin-inline-ebook {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #admin-inline-ebook app-pdf-secure-viewer {
      flex: 1;
      min-height: 0;
    }

    /* ===== STUDENT VIEW STYLES ===== */
    .student-view {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .content-view {
      padding: 2rem;
      text-align: center;
      color: #666;
    }

    .lesson-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
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
      overflow-x: hidden;
    }

    .lesson-header h1 {
      margin: 0;
      font-size: 1.5rem;
      flex: 1;
      word-break: break-word;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 0.8rem;
      border-radius: 6px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #333;
      transition: all 0.2s ease;
      gap: 0.4rem;
      white-space: nowrap;
    }

    .btn-back:hover {
      background: #007bff;
      color: white;
      border-color: #007bff;
      transform: translateX(-2px);
    }

    .btn-back:active {
      transform: translateX(-1px);
    }

    .btn-back svg {
      width: 20px;
      height: 20px;
      display: inline-block;
      vertical-align: middle;
    }

    .fullscreen-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.4rem;
      border-radius: 6px;
      background: linear-gradient(180deg, #fff, #f3f6fa);
      border: 1px solid #d0d7e5;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s ease;
    }

    .fullscreen-btn:hover {
      background: linear-gradient(180deg, #f0f7ff, #e6f2ff);
      border-color: #007bff;
    }

    .fullscreen-btn svg {
      width: 14px;
      height: 14px;
    }

    .lesson-content {
      display: flex;
      flex: 1;
      gap: 1rem;
      padding: 1rem;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .player-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .player-section section {
      flex: 1;
      overflow: hidden;
      background: #000;
    }

    /* Fullscreen: permitir scroll da seção PDF */
    .player-section section:fullscreen,
    .player-section section:-webkit-full-screen {
      overflow-y: auto;
      overflow-x: hidden;
    }

    .video-container {
      width: 100%;
      display: block;
    }

    /* Responsive frame that maintains 16:9 and allows the iframe/video to fill it */
    .video-frame {
      position: relative;
      width: 100%;
      padding-top: 56.25%; /* 16:9 */
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }

    .video-embed, .video-container-inner {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
    }

    .video-embed {
      display: block;
      object-fit: cover;
    }

    .last-lesson-actions {
      width: 100%;
      min-height: 56px;
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.75rem;
      transition: opacity 0.18s ease;
    }

    .last-lesson-actions.invisible {
      visibility: hidden;
      opacity: 0;
    }

    /* Layout: keep player visible while allowing lessons sidebar to scroll independently */
    .lesson-content {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      width: 100%;
    }

    .player-section {
      flex: 1 1 auto;
      min-width: 0; /* allow proper flex shrinking */
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      /* Ensure player has a sensible minimum height to avoid visual compression */
      min-height: 420px;
      max-height: calc(100vh - 120px);
      overflow: hidden;
    }

    .lessons-sidebar {
      width: 320px;
      flex: 0 0 320px;
      max-height: calc(100vh - 160px);
      overflow-y: auto;
      padding: 1rem;
      box-sizing: border-box;
      position: relative;
    }

    @media (max-width: 1024px) {
      .video-container, .player-section {
        min-height: 260px;
        max-height: none;
      }
      .lessons-sidebar {
        width: 100%;
        flex: 0 0 auto;
        max-height: none;
        overflow: visible;
      }
    }

    /* Ensure lists inside the sidebar don't collapse spacing */
    .lessons-sidebar .lesson-item-list {
      display: block;
    }

    .empty {
      padding: 2rem;
      text-align: center;
      color: #999;
    }

    /* Navegação em fullscreen */
    .fullscreen-nav {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 9999;
      pointer-events: auto;
    }

    .fs-nav-btn {
      padding: 10px 16px;
      border-radius: 24px;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .fs-nav-btn svg {
      width: 18px;
      height: 18px;
      display: inline-block;
      vertical-align: middle;
    }

    .fs-nav-label { display: inline-block; }

    .fs-nav-btn:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.8);
      transform: scale(1.05);
    }

    .fs-nav-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .fs-nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .fs-nav-spacer {
      width: 1px;
      height: 20px;
      background: rgba(255, 255, 255, 0.2);
    }

    #ebook-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    /* Fullscreen: permitir scroll quando PDF está em tela cheia */
    #ebook-container:fullscreen,
    #ebook-container:-webkit-full-screen {
      overflow-y: auto;
      overflow-x: hidden;
      height: 100vh;
    }

    #ebook-container:fullscreen app-pdf-secure-viewer,
    #ebook-container:-webkit-full-screen app-pdf-secure-viewer {
      height: 100% !important;
    }

    #ebook-container:fullscreen app-pdf-secure-viewer ::ng-deep .pdf-canvas-wrapper,
    #ebook-container:-webkit-full-screen app-pdf-secure-viewer ::ng-deep .pdf-canvas-wrapper {
      overflow-y: auto !important;
    }

    .lessons-sidebar {
      width: 280px;
      background: white;
      border-radius: 8px;
      overflow-y: auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
      background: rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      flex-shrink: 0;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .lesson-item.active .lesson-number {
      background: rgba(255, 255, 255, 0.3);
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

    .btn--success {
      background: #28a745;
      color: white;
    }

    .btn--success:hover {
      background: #218838;
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

    .error {
      color: #b91c1c;
      padding: 1rem;
      background: #fee;
      border-radius: 4px;
      margin: 1rem 0;
    }

    @media (max-width: 1024px) {
      .lessons-sidebar {
        width: 220px;
        padding: 0.75rem;
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
      .lessons-sidebar.hidden-mobile { display: none; }

      .admin-view {
        padding: 1rem;
      }
      .toggle-lessons-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.25rem 0.4rem;
        border-radius: 6px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s ease;
      }
      .toggle-lessons-btn:hover {
        background: #e5e7eb;
        border-color: #d1d5db;
      }
      .toggle-lessons-btn svg {
        width: 14px;
        height: 14px;
      }
      .lessons-list.hidden-mobile { display: none; }
      .lessons-list { transition: max-height 0.2s ease; }
      /* Center the video frame on small screens and constrain max width for nicer layout */
      .video-frame {
        margin: 0 auto;
        max-width: 960px;
      }

      .lesson-header {
        padding: 1rem;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
      }

      .lesson-header h1 {
        font-size: 1.2rem;
        flex: 1 1 100%;
        width: 100%;
        word-break: break-word;
      }

      .lesson-header div {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: center;
        width: 100%;
      }

      .btn-back {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
        white-space: nowrap;
      }

      .btn-back svg {
        width: 16px;
        height: 16px;
      }

      .fullscreen-btn {
        padding: 0.25rem 0.4rem;
        font-size: 0.7rem;
      }

      .toggle-lessons-btn {
        padding: 0.25rem 0.4rem;
        font-size: 0.7rem;
      }
    }

    @media (max-width: 480px) {
      .lesson-header {
        padding: 0.75rem;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.5rem;
      }

      .lesson-header h1 {
        font-size: 1rem;
        flex: 1 1 100%;
        margin: 0;
        width: 100%;
        word-break: break-word;
      }

      .lesson-header div {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
        justify-content: center;
        width: 100%;
      }

      .btn-back {
        padding: 0.35rem 0.5rem;
        font-size: 0.7rem;
        min-width: 32px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .btn-back svg {
        width: 14px;
        height: 14px;
      }

      .fullscreen-btn {
        padding: 0.2rem 0.35rem;
        font-size: 0.65rem;
        white-space: nowrap;
      }

      .toggle-lessons-btn {
        padding: 0.2rem 0.35rem;
        font-size: 0.65rem;
        white-space: nowrap;
      }

      .player-section {
        min-height: 280px;
        border-radius: 4px;
      }

      .video-frame {
        border-radius: 4px;
      }

      .lessons-sidebar {
        max-height: 150px;
        padding: 0.5rem;
      }

      .lessons-sidebar h2 {
        font-size: 0.9rem;
        margin: 0 0 0.5rem 0;
      }

      .lesson-item {
        padding: 0.5rem;
        font-size: 0.8rem;
      }

      .lesson-number {
        width: 24px;
        height: 24px;
        font-size: 0.75rem;
      }

      .last-lesson-actions {
        flex-direction: column;
        gap: 0.35rem;
      }

      .last-lesson-actions .btn {
        padding: 0.4rem 0.8rem;
        font-size: 0.75rem;
        width: 100%;
      }

      .progress-text {
        font-size: 0.7rem;
      }
    }
  `]
})
export class TrainingViewerComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly lesson = inject(LessonService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly trainingService = inject(TrainingService);
  private readonly catalogService = inject(CatalogService);

  // Controle de visualização
  private isAdminUser = this.auth?.isSystemAdmin?.() || this.auth?.hasOrganizationRole?.('ORG_ADMIN');
  private isAdminRoute = () => this.route.snapshot.url?.[0]?.path === 'admin';

  isAdmin = () => this.isAdminUser && this.isAdminRoute();
  isStudentView = () => !this.isAdminRoute();

  // Training data
  training = signal<any | null>(null);
  trainingId = signal<string | null>(null);
  currentPage = signal<number>(1);
  numPages = signal<number>(0);
  currentLesson = signal<any | null>(null);
  watchedLessons = signal<Set<string>>(new Set());
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  showMarkCompleteOption = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);
  isSystemAdmin = signal<boolean>(false);
  sidebarVisibleMobile = signal<boolean>(true);
  rawPdfUrl: string | null = null;
  videoUrl: string | null = null;
  sanitizedVideoUrl: SafeResourceUrl | null = null;
  private blobUrl: string | null = null;

  // Admin data
  publishing = signal<boolean>(false);
  uploadProgress = signal<number | null>(null);
  coverBroken = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  editing = signal<boolean>(false);
  editError = signal<string | null>(null);
  editForm = signal<{ title: string; description: string; author: string }>({ title: '', description: '', author: '' });
  showAdminViewer = signal<boolean>(false);
  adminPdfUrl: string | null = null;
  adminCurrentPage = signal<number>(1);
  adminNumPages = signal<number>(0);
  adminIsFullscreen = signal<boolean>(false);

  @ViewChild('videoPlayer') videoPlayer: ElementRef<HTMLVideoElement> | undefined;
  @ViewChild('youtubePlayer') youtubePlayer: ElementRef<HTMLDivElement> | undefined;
  @ViewChild('pdfViewer') pdfViewer?: any;

  private youtubePlayer_instance: any = null;
  private ytApiLoaded = false;
  private pendingAutoplay = false;
  private onFullscreenChangeHandler: (() => void) | null = null;
  private _removeFullscreenListener: (() => void) | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('ID do conteúdo ausente.');
      this.loading.set(false);
      return;
    }

    // Setup fullscreen listener
    const onFullscreenChange = () => {
      const fsEl = document.fullscreenElement;
      const ebookContainer = document.getElementById('ebook-container');
      const adminInline = document.getElementById('admin-inline-ebook');
      const playerContainer = document.getElementById('player-container');

      const isPlayerFs = !!(fsEl && (playerContainer && (playerContainer === fsEl || playerContainer.contains(fsEl))));
      const isEbookFs = !!(fsEl && (ebookContainer && (ebookContainer === fsEl || ebookContainer.contains(fsEl))));
      const isAdminFs = !!(fsEl && (adminInline && (adminInline === fsEl || adminInline.contains(fsEl))));

      this.isFullscreen.set(Boolean(isPlayerFs || isEbookFs));
      this.adminIsFullscreen.set(Boolean(isAdminFs));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    this._removeFullscreenListener = () => document.removeEventListener('fullscreenchange', onFullscreenChange);

    this.isSystemAdmin.set(this.isAdminUser);
    this.loadTraining(id);
  }

  toggleSidebarMobile(): void {
    this.sidebarVisibleMobile.set(!this.sidebarVisibleMobile());
  }

  goBack(): void {
    // Verifica se vem de /admin/conteudo/:id e volta para /admin
    // Caso contrário volta para /conta com a seção "Cursos & Treinamentos"
    const currentUrl = this.route.snapshot.url;
    if (currentUrl && currentUrl.length > 0 && currentUrl[0].path === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      // Usa query param para navegar até a seção "learning" (Cursos & Treinamentos)
      this.router.navigate(['/conta'], { queryParams: { section: 'learning' } });
    }
  }

  ngOnDestroy(): void {
    if (this.blobUrl) {
      try { URL.revokeObjectURL(this.blobUrl); } catch {}
    }
    if (this.youtubePlayer_instance) {
      try { this.youtubePlayer_instance.destroy(); } catch {}
    }
    if (this._removeFullscreenListener) {
      try { this._removeFullscreenListener(); } catch {}
    }
  }

  private loadTraining(id: string): void {
    this.trainingId.set(id);
    this.loading.set(true);
    this.error.set(null);

    // Use admin API only when viewing as admin; otherwise use public/student routes
    if (this.isAdmin()) {
      this.admin.getTrainingById(id).subscribe({
        next: t => {
          this.training.set(t as any);
          this.handleTrainingContent(t);
        },
        error: err => {
          try { console.error('[TrainingViewer] getTrainingById error', err); } catch {}
          this.training.set({ entityType: 'EBOOK' } as any);
          this.loadProgress(id);
          this.fetchStudentEbookUrl(id, null);
        }
      });
    } else {
      // Student view: fetch modules via public trainings endpoints and try to enrich
      this.trainingService.getModules(id).subscribe({
        next: (modules: any[]) => {
            const tObj: any = { id, modules, entityType: null };
            // Seed watchedLessons from server-side completion flags, if present
            try {
              const completed = new Set<string>();
              for (const mod of (modules || [])) {
                for (const les of (mod.lessons || [])) {
                  if (les && (les.isCompleted === true || les.isCompleted === 'true')) completed.add(String(les.id));
                }
              }
              if (completed.size > 0) {
                this.watchedLessons.update(_ => completed);
              }
            } catch (e) {
              // ignore
            }
          // Try to get metadata from public catalog (if available)
          this.catalogService.loadCatalog().subscribe({
            next: (items: any[]) => {
              try {
                const found = (items || []).find((it: any) => String(it.id) === String(id));
                if (found) {
                  tObj.entityType = found.entityType ?? (found.format as any) ?? null;
                  tObj.title = found.title ?? tObj.title;
                  tObj.coverImageUrl = found.coverImageUrl ?? tObj.coverImageUrl;
                  tObj.data = found.data ?? tObj.data;
                }
              } catch (e) {}
              this.training.set(tObj);
              this.handleTrainingContent(tObj);
            },
            error: () => {
              this.training.set(tObj);
              this.handleTrainingContent(tObj);
            }
          });
        },
        error: err => {
          try { console.error('[TrainingViewer] getModules error', err); } catch {}
          // Fallback to ebook flow
          this.training.set({ entityType: 'EBOOK' } as any);
          this.loadProgress(id);
          this.fetchStudentEbookUrl(id, null);
        }
      });
    }
  }

  private handleTrainingContent(training: any): void {
    const et = (training as any)?.entityType;
    const isRecordedCourse = typeof et === 'string' && String(et).toUpperCase() === 'RECORDED_COURSE';
    const isEbook = typeof et === 'string' && String(et).toUpperCase().includes('EBOOK');

    if (isRecordedCourse) {
      const lessons = (training as any)?.modules?.[0]?.lessons || [];
      if (lessons.length > 0) {
        this.selectLesson(lessons[0]);
      } else {
        this.loading.set(false);
      }
    } else if (isEbook) {
      const trainingId = (training as any)?.id;
      this.loadProgress(trainingId);
      this.fetchStudentEbookUrl(trainingId || '', training);
    } else {
      this.loading.set(false);
    }
  }

  selectLesson(lesson: any): void {
    this.currentLesson.set(lesson);
    this.showMarkCompleteOption.set(false);
    if (lesson?.id) {
      // Request autoplay when user deliberately selects a lesson
      this.pendingAutoplay = true;
      this.loadRecordedCourseVideo(lesson.id);
    }
  }

  private loadRecordedCourseVideo(lessonId: string): void {
    this.api.get<any>(`/api/lessons/${encodeURIComponent(lessonId)}`).subscribe({
      next: lesson => {
        if (lesson?.videoUrl) {
          let videoUrl = lesson.videoUrl;
          videoUrl = this.convertToEmbedUrl(videoUrl);
          this.videoUrl = videoUrl;
          if (this.isExternalVideoUrl(videoUrl)) {
            // For external embeds use sanitized URL; if autoplay requested, try to append autoplay param
            let embedUrl = videoUrl;
            if (this.pendingAutoplay && typeof embedUrl === 'string' && embedUrl.indexOf('autoplay=1') === -1) {
              const sep = embedUrl.indexOf('?') === -1 ? '?' : '&';
              embedUrl = embedUrl + sep + 'autoplay=1&rel=0';
            }
            this.sanitizedVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
            if (videoUrl.includes('youtube.com/embed') || videoUrl.includes('youtu.be')) {
              this.loadYouTubeAPI();
            }
          } else {
            // native video file: try to autoplay after it is bound in the view
            setTimeout(() => {
              try {
                const v: HTMLVideoElement | undefined = (this.videoPlayer && (this.videoPlayer as any).nativeElement) || undefined;
                if (v && this.pendingAutoplay) {
                  v.play().catch(() => {});
                  this.pendingAutoplay = false;
                }
              } catch (e) {}
            }, 150);
          }
        }
        // If backend indicates this lesson was already completed, reflect that in watchedLessons
        try {
          if (lesson?.isCompleted === true || lesson?.isCompleted === 'true') {
            this.watchedLessons.update(w => {
              const s = new Set<string>(w ? Array.from(w) : []);
              s.add(String(lesson.id));
              return s;
            });
          }
        } catch (e) {}
        this.loading.set(false);
      },
      error: err => {
        try { console.error('[TrainingViewer] failed to load lesson', err); } catch {}
        this.error.set('Falha ao carregar o vídeo');
        this.loading.set(false);
      }
    });
  }

  private loadYouTubeAPI(): void {
    if (this.ytApiLoaded) {
      this.createYouTubePlayer();
      return;
    }

    if (!document.getElementById('youtube-api')) {
      const script = document.createElement('script');
      script.id = 'youtube-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkYTReady = () => {
      if (typeof (window as any).YT !== 'undefined' && (window as any).YT.Player) {
        this.ytApiLoaded = true;
        this.createYouTubePlayer();
      } else {
        setTimeout(checkYTReady, 100);
      }
    };

    setTimeout(checkYTReady, 100);
  }

  private createYouTubePlayer(): void {
    if (!this.youtubePlayer?.nativeElement) {
      setTimeout(() => this.createYouTubePlayer(), 200);
      return;
    }

    if (this.youtubePlayer_instance) {
      try { this.youtubePlayer_instance.destroy(); } catch {}
    }

    const videoUrl = this.videoUrl || '';
    const videoIdMatch = videoUrl.match(/embed\/([a-zA-Z0-9_-]+)/);
    if (!videoIdMatch) return;

    const videoId = videoIdMatch[1];
    const container = this.youtubePlayer!.nativeElement;

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
      }
    });
    // If autoplay was requested by user interaction, try to play immediately
    try {
      if (this.pendingAutoplay && this.youtubePlayer_instance && typeof this.youtubePlayer_instance.playVideo === 'function') {
        try { this.youtubePlayer_instance.playVideo(); } catch {}
        this.pendingAutoplay = false;
      }
    } catch (e) {}
  }

  private onYouTubeStateChange(event: any): void {
    const YT = (window as any).YT;
    if (event.data === YT.PlayerState.ENDED) {
      this.onVideoEnded();
    }
  }

  private convertToEmbedUrl(url: string): string {
    if (!url) return url;
    if (url.includes('/embed/') || url.includes('player.vimeo.com')) return url;

    let videoId = '';
    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
      videoId = watchMatch[1];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    const shortenedMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortenedMatch) {
      videoId = shortenedMatch[1];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      videoId = vimeoMatch[1];
      return `https://player.vimeo.com/video/${videoId}`;
    }

    return url;
  }

  isExternalVideoUrl(url: string | null): boolean {
    if (!url) return false;
    return url.includes('youtube.com/embed') || 
           url.includes('youtu.be') ||
           url.includes('player.vimeo.com') ||
           url.includes('vimeo.com/embed');
  }

  private fetchStudentEbookUrl(id: string, training: any): void {
    const url = this.api.createUrl(`/stream/ebooks/${encodeURIComponent(id)}`);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        if (!blob || !blob.size) {
          this.useAdminEbookUrl(training);
          this.loading.set(false);
          return;
        }

        try {
          const headerSlice = blob.slice(0, 5);
          headerSlice.text().then(header => {
            if (header && header.startsWith('%PDF')) {
              if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
              this.blobUrl = URL.createObjectURL(blob);
              this.rawPdfUrl = this.blobUrl;
              this.loading.set(false);
              return;
            }

            blob.text().then(text => {
              const parsedUrl = (text || '').trim();
              if (parsedUrl && (parsedUrl.startsWith('http') || parsedUrl.startsWith('file:') || parsedUrl.startsWith('/'))) {
                this.rawPdfUrl = parsedUrl;
              } else {
                this.useAdminEbookUrl(training);
              }
              this.loading.set(false);
            }).catch(() => {
              this.useAdminEbookUrl(training);
              this.loading.set(false);
            });
          }).catch(() => {
            if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
            this.blobUrl = URL.createObjectURL(blob);
            this.rawPdfUrl = this.blobUrl;
            this.loading.set(false);
          });
        } catch (e) {
          this.useAdminEbookUrl(training);
          this.loading.set(false);
        }
      },
      error: err => {
        this.useAdminEbookUrl(training);
        this.loading.set(false);
      }
    });
  }

  private useAdminEbookUrl(training: any): void {
    const fileName = this.admin.extractPdfFileName(training);
    const url = this.admin.buildEbookFileUrl(fileName) || null;
    this.rawPdfUrl = url;
  }

  onVideoEnded(): void {
    const lesson = this.currentLesson();
    if (!lesson) return;

    this.watchedLessons.update(watched => {
      watched.add(lesson.id);
      return watched;
    });

    // Se for a última lição do módulo, não marcar automaticamente.
    // Exibir opção para o usuário confirmar marcação.
    if (this.isLastLesson()) {
      this.showMarkCompleteOption.set(true);
      return;
    }

    // Caso não seja a última, comportamento antigo: marcar e ir para próxima.
    this.markLessonComplete(lesson.id);
    this.goToNextLessonViaApi();
  }

  private markLessonComplete(lessonId: string): void {
    this.lesson.markLessonAsCompleted(lessonId).subscribe({
      next: response => {
        try { console.debug('[TrainingViewer] Lesson marked as completed:', response); } catch {}
      },
      error: err => {
        const serverMsg = err?.error?.message || err?.message || '';
        if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('já foi marcada')) {
          console.debug('[TrainingViewer] Lesson already marked on server, ignoring.', serverMsg);
          return;
        }
        try { console.warn('[TrainingViewer] Error marking lesson as completed:', err); } catch {}
      }
    });
  }

  private goToNextLessonViaApi(): void {
    const lesson = this.currentLesson();
    if (!lesson || !lesson.id) return;

    const url = this.api.createUrl(`/api/lessons/${encodeURIComponent(lesson.id)}/next`);
    this.http.get<any>(url, { observe: 'response' }).subscribe({
      next: response => {
        if (response.status === 204 || !response.body) {
          return;
        }
        const nextLesson = response.body;
        if (nextLesson && nextLesson.id) {
          this.selectLesson(nextLesson);
        }
      },
      error: err => {
        if (err.status === 204) return;
      }
    });
  }

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

  isLastLesson(): boolean {
    const training = this.training();
    const lesson = this.currentLesson();

    if (!training || !lesson) return false;

    const modules = training.modules || [];
    if (modules.length === 0) return false;

    const lastModule = modules[modules.length - 1];
    const lessons = lastModule.lessons || [];
    if (lessons.length === 0) return false;

    const lastLesson = lessons[lessons.length - 1];
    return lastLesson?.id === lesson.id;
  }

  private loadProgress(trainingId: string): void {
    this.api.get<any>(`/progress/ebooks/${encodeURIComponent(trainingId)}`).subscribe({
      next: (progress: any) => {
        if (progress?.lastPageRead && progress.lastPageRead > 0) {
          this.currentPage.set(progress.lastPageRead);
        }
      },
      error: (err: any) => {}
    });
  }

  onPageChange(pageNum: number, totalPages?: number): void {
    this.currentPage.set(pageNum);
    if (typeof totalPages === 'number') this.numPages.set(totalPages);

    const id = this.trainingId();
    if (id) {
      this.api.put(`/progress/ebooks/${encodeURIComponent(id)}`, { lastPageRead: pageNum }).subscribe({
        next: () => {},
        error: (err: any) => {}
      });
    }
  }

  toggleFullscreen(): void {
    const container = document.getElementById('ebook-container');
    if (!container) return;
    const isNow = document.fullscreenElement === container;
    if (!isNow) {
      container.requestFullscreen?.().then(() => this.isFullscreen.set(true)).catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().then(() => this.isFullscreen.set(false)).catch(() => {});
    }
  }

  pdfPrev(): void {
    try {
      const comp = this.pdfViewer as any;
      if (comp && typeof comp.previousPage === 'function') comp.previousPage();
    } catch {}
  }

  pdfNext(): void {
    try {
      const comp = this.pdfViewer as any;
      if (comp && typeof comp.nextPage === 'function') comp.nextPage();
    } catch {}
  }

  completeLesson(lesson: any): void {
    if (!lesson || !lesson.id) return;
    this.lesson.markLessonAsCompleted(lesson.id).subscribe({
      next: () => alert('Aula marcada como concluída.'),
      error: err => {
        const serverMsg = err?.error?.message || err?.message || '';
        if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('já foi marcada')) {
          alert('Aula já estava marcada como concluída.');
          return;
        }
        alert(serverMsg || 'Falha ao marcar aula como concluída.');
      }
    });
  }

  completeCurrentLesson(): void {
    const lesson = this.currentLesson();
    if (!lesson || !lesson.id) return;
    this.lesson.markLessonAsCompleted(lesson.id).subscribe({
      next: () => {
        try { alert('Aula marcada como concluída.'); } catch {}
        this.showMarkCompleteOption.set(false);
        this.goToNextLessonViaApi();
      },
      error: err => {
        const serverMsg = err?.error?.message || err?.message || '';
        if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('já foi marcada')) {
          alert('Aula já estava marcada como concluída.');
          this.showMarkCompleteOption.set(false);
          return;
        }
        alert(serverMsg || 'Falha ao marcar aula como concluída.');
      }
    });
  }

  // Admin methods
  publish(): void {
    const t = this.training();
    if (!t || !t.id) return;

    this.publishing.set(true);
    this.admin.publishTraining(t.id).subscribe({
      next: () => {
        this.publishing.set(false);
        this.training.set({ ...t, publicationStatus: 'PUBLISHED' });
      },
      error: err => {
        this.publishing.set(false);
        this.error.set(err?.message || 'Falha ao publicar');
      }
    });
  }

  onPdfSelected(file: File): void {
    const t = this.training();
    if (!t || !file) return;

    this.uploadProgress.set(0);
    this.admin.uploadEbookFileWithProgress(t.id, file).subscribe({
      next: ev => { if (ev.type === 'progress') this.uploadProgress.set(ev.progress ?? 0); },
      error: err => { this.error.set(err?.message || 'Falha upload PDF'); this.uploadProgress.set(null); },
      complete: () => {
        this.uploadProgress.set(100);
        const id = t.id;
        setTimeout(() => { this.uploadProgress.set(null); this.loadTraining(id); }, 1200);
      }
    });
  }

  onCoverSelected(file: File): void {
    const t = this.training();
    if (!t || !file) return;

    this.uploadProgress.set(0);
    this.admin.uploadTrainingCoverImage(t.id, file).subscribe({
      next: ev => { if (ev.type === 'progress') this.uploadProgress.set(ev.progress ?? 0); },
      error: err => { this.error.set(err?.message || 'Falha upload capa'); this.uploadProgress.set(null); },
      complete: () => {
        this.uploadProgress.set(100);
        const id = t.id;
        setTimeout(() => { this.uploadProgress.set(null); this.loadTraining(id); }, 1000);
      }
    });
  }

  trainingHasPdf(t: any): boolean {
    return this.admin.trainingHasPdf(t);
  }

  extractPdfFileName(t: any): string {
    return this.admin.extractPdfFileName(t);
  }

  buildEbookFileUrl(fileName: string): string | null {
    return this.admin.buildEbookFileUrl(fileName);
  }

  openAdminViewer(pdfUrl: string | null): void {
    if (!pdfUrl) return;
    this.adminPdfUrl = pdfUrl;
    this.showAdminViewer.set(!this.showAdminViewer());
  }

  adminOnPageChange = (page: number, num?: number) => {
    this.adminCurrentPage.set(page);
    if (typeof num === 'number') this.adminNumPages.set(num);
  };

  openEditMetadata(): void {
    const t = this.training();
    if (!t) return;
    this.editForm.set({ 
      title: String(t.title ?? ''), 
      description: String(t.description ?? ''), 
      author: String(t.author ?? '') 
    });
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditMetadata(): void {
    this.showEditModal.set(false);
  }

  setEditField(key: 'title' | 'description' | 'author', value: any): void {
    this.editForm.update(f => ({ ...f, [key]: value }));
  }

  submitEditMetadata(): void {
    const t = this.training();
    if (!t) return;

    const form = this.editForm();
    this.editError.set(null);
    const payload: any = {};
    if (form.title !== undefined) payload.title = String(form.title).trim();
    if (form.description !== undefined) payload.description = String(form.description).trim();
    if (form.author !== undefined) payload.author = String(form.author).trim();

    this.editing.set(true);
    this.admin.updateTraining(t.id, payload).subscribe({
      next: updated => {
        this.editing.set(false);
        this.training.set(updated);
        this.closeEditMetadata();
      },
      error: err => {
        this.editing.set(false);
        this.editError.set(err?.message || 'Erro ao atualizar');
      }
    });
  }
}
