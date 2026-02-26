import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import { AppDragDropModule } from '../../shared/drag-drop.module';
import { QuillModule } from 'ngx-quill';

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
  imports: [CommonModule, RouterModule, FormsModule, PublicationStatusPipe, PdfSecureViewerComponent, AppDragDropModule, QuillModule],
  
  template: `
  <div class="training-viewer-container">
    <!-- Admin View (com edição) -->
    <div *ngIf="isAdmin() && !isStudentView()" class="admin-view">
      <div class="training-detail-page" *ngIf="training() as t">
        <div class="header-row" *ngIf="training() as t">
          <div class="title-block">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <a class="back-link" routerLink="/admin" title="Voltar para administração" aria-label="Voltar para administração">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </a>
              <h1 class="title">{{t.title}}</h1>
            </div>
          </div>
          <div class="action-bar">
            <button type="button" class="btn btn--primary btn-sm" (click)="publish()" [disabled]="publishing() || (t.publicationStatus||'').toLowerCase()==='published'">
              {{ (t.publicationStatus||'').toLowerCase()==='published' ? 'Publicado' : 'Publicar' }}
            </button>
            <label class="btn btn--outline file-btn" *ngIf="t.entityType !== 'RECORDED_COURSE'">
              <span>Upload PDF</span>
              <input type="file" accept="application/pdf" (change)="onPdfSelected($any($event.target).files[0]); $event.target.value=''; $event.stopPropagation();" hidden />
            </label>
            <label class="btn btn--outline file-btn">
              <span>Upload Capa</span>
              <input type="file" accept="image/*" (change)="onCoverSelected($any($event.target).files[0]); $event.target.value=''; $event.stopPropagation();" hidden />
            </label>
            <button type="button" class="btn btn--subtle btn-sm" (click)="openEditMetadata()">Atualizar</button>
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
            <button class="btn btn--primary btn-sm" (click)="openAdminViewer(t.id)">{{ showAdminViewer() ? 'Fechar' : 'Ver PDF' }}</button>
            </div>
          </section>

          <!-- Inline admin viewer -->
          <section *ngIf="showAdminViewer() && adminTrainingId" class="card" style="padding:0;">
            <div id="admin-inline-ebook" style="position:relative; height:640px;">
              <app-pdf-secure-viewer
                [trainingId]="adminTrainingId"
                [initialPage]="adminCurrentPage()"
                [onPageChange]="adminOnPageChange"
                style="height:100%; display:block;">
              </app-pdf-secure-viewer>
            </div>
          </section>

          <!-- Edit Module Modal -->
          <div class="overlay" *ngIf="showEditModuleModal()" (click)="closeEditModule()"></div>
          <div class="create-modal" *ngIf="showEditModuleModal()" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
            <form (submit)="$event.preventDefault(); submitEditModule();">
              <h3 style="margin: 0 0 1rem 0; font-size: 1.15rem; color: #0f172a; font-weight: 600;">{{ moduleEditForm().id ? 'Editar Módulo' : 'Novo Módulo' }}</h3>
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                  <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.85rem; color: #475569;">Título</label>
                  <input type="text" class="create-input" [value]="moduleEditForm().title" (input)="setModuleField('title', $any($event.target).value)" placeholder="Título do módulo" />
                </div>
                <div>
                  <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.85rem; color: #475569;">Ordem</label>
                  <input type="number" class="create-input" [value]="moduleEditForm().moduleOrder" (input)="setModuleField('moduleOrder', $any($event.target).value)" min="1" />
                </div>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
                  <button type="button" class="btn btn--subtle" (click)="closeEditModule()" [disabled]="editingModule()">Cancelar</button>
                  <button type="submit" class="btn btn--primary" [disabled]="editingModule()">{{ editingModule() ? 'Salvando...' : 'Salvar' }}</button>
                </div>
              </div>
            </form>
          </div>

          <!-- Edit Lesson Modal -->
          <div class="overlay" *ngIf="showEditLessonModal()" (click)="closeEditLesson()"></div>
          <div class="create-modal" *ngIf="showEditLessonModal()" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
            <form (submit)="$event.preventDefault(); submitEditLesson();">
              <h3 style="margin: 0 0 1rem 0; font-size: 1.15rem; color: #0f172a; font-weight: 600;">{{ lessonEditForm().id ? 'Editar Aula' : 'Nova Aula' }}</h3>
              <div style="display: flex; flex-direction: column; gap: 1rem; flex: 1;">
                <div>
                  <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.85rem; color: #475569;">Título</label>
                  <input type="text" class="create-input" [value]="lessonEditForm().title" (input)="setLessonField('title', $any($event.target).value)" placeholder="Título da aula" />
                </div>

                <div style="display: flex; flex-direction: column; flex: 1; min-height: 300px;">
                  <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.85rem; color: #475569;">Conteúdo</label>
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex: 1;">
                    <quill-editor 
                      [modules]="quillModules"
                      [(ngModel)]="lessonEditForm().content"
                      [ngModelOptions]="{standalone: true}"
                      (onContentChanged)="setLessonField('content', $event.html)"
                      theme="snow"
                      placeholder="Escreva a descrição e materiais de apoio..."
                      style="display: flex; flex-direction: column; height: 100%;">
                    </quill-editor>
                  </div>
                </div>

                <div>
                  <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.85rem; color: #475569;">Vídeo (URL)</label>
                  <input type="url" class="create-input" [value]="lessonEditForm().videoUrl" (input)="setLessonField('videoUrl', $any($event.target).value)" placeholder="https://exemplo.com/video" />
                </div>

                <div>
                  <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.85rem; color: #475569;">Ordem</label>
                  <input type="number" class="create-input" [value]="lessonEditForm().lessonOrder" (input)="setLessonField('lessonOrder', $any($event.target).value)" min="1" />
                </div>

                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
                  <button type="button" class="btn btn--subtle" (click)="closeEditLesson()" [disabled]="editingLesson()">Cancelar</button>
                  <button type="submit" class="btn btn--primary" [disabled]="editingLesson()">{{ editingLesson() ? 'Salvando...' : 'Salvar' }}</button>
                </div>
              </div>
            </form>
          </div>

          <!-- RECORDED_COURSE section (Admin) -->
          <section class="card" *ngIf="t.entityType==='RECORDED_COURSE'">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h2 class="card-title" style="margin: 0;">Módulos & Aulas</h2>
              <button class="btn btn--primary" (click)="openCreateModule()" type="button" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem;">
                <span style="font-size: 1.1rem;">+</span> Módulo
              </button>
            </div>
            <div *ngIf="saveIndicatorMessage()" class="save-indicator" style="margin-bottom:.5rem;font-size:.9rem;color:#0f5132;background:#d1e7dd;padding:.3rem .6rem;border-radius:6px;display:inline-block">{{ saveIndicatorMessage() }}</div>
            
            <div cdkDropList (cdkDropListDropped)="onModulesDropped($event)" [cdkDropListData]="t.modules" [cdkDropListDisabled]="false" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #f8fafc;">
              <div class="module" *ngFor="let m of t.modules; let mi = index" cdkDrag style="margin-bottom: 1.5rem; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.75rem; background: white;">
                <!-- Module Header -->
                <div class="module-title" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
                  <span cdkDragHandle class="drag-handle" title="Arrastar módulo" style="cursor: grab; opacity: 0.7; user-select: none; font-size: 1.2rem;">☰</span>
                  <span style="font-weight: 600; color: #1e293b;">{{ mi + 1 }}. {{ m.title }}</span>
                  <span style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
                    <button 
                      class="icon-btn" 
                      (click)="openCreateLesson(m)" 
                      type="button"
                      title="Adicionar aula"
                      style="display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.6rem; border: 1px solid #0ea5e9; background: white; border-radius: 4px; color: #0ea5e9; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: currentColor; stroke-width: 2;">
                        <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      Aula
                    </button>
                    <button 
                      class="icon-btn" 
                      (click)="openEditModule(m, $event)" 
                      type="button"
                      title="Editar módulo"
                      style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 1px solid #cbd5e1; background: white; border-radius: 4px; color: #475569; cursor: pointer; transition: all 0.2s;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: currentColor; stroke-width: 2;">
                        <path d="M3 17.25V21h3.75L17.81 9.94M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <button 
                      class="icon-btn" 
                      (click)="deleteModule(m, $event)" 
                      type="button"
                      title="Excluir módulo"
                      style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 1px solid #fca5a5; background: white; border-radius: 4px; color: #dc2626; cursor: pointer; transition: all 0.2s;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: currentColor; stroke-width: 2;">
                        <path d="M19 6.4L5 20.4M5 6.4l14 14" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </span>
                </div>

                <!-- Lessons in Module -->
                <div class="lessons-in-module" cdkDropList (cdkDropListDropped)="onLessonsDropped($event, m)" [cdkDropListData]="m.lessons || []" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <div 
                    *ngFor="let l of m.lessons; let li = index" 
                    cdkDrag
                    style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #f1f5f9; border-radius: 4px; border-left: 3px solid #0ea5e9;">
                    <span cdkDragHandle class="lesson-drag-handle" title="Arrastar aula" style="cursor: grab; opacity: 0.6; user-select: none; font-size: 1rem;">⋮</span>
                    <span style="min-width: 25px; color: #64748b;">{{ li + 1 }}.</span>
                    <span style="flex: 1; color: #1e293b;">{{ l.title }}</span>
                    <span style="display: flex; align-items: center; gap: 0.25rem;">
                      <button 
                        type="button" 
                        (click)="openEditLesson(l, m)"
                        title="Editar aula"
                        style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 1px solid #cbd5e1; background: white; border-radius: 3px; color: #475569; cursor: pointer; transition: all 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: currentColor; stroke-width: 2;">
                          <path d="M3 17.25V21h3.75L17.81 9.94M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        (click)="deleteLesson(l, m)"
                        title="Excluir aula"
                        style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 1px solid #fca5a5; background: white; border-radius: 3px; color: #dc2626; cursor: pointer; transition: all 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: currentColor; stroke-width: 2;">
                          <path d="M19 6.4L5 20.4M5 6.4l14 14" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                    </span>
                  </div>
                  <div *ngIf="!m.lessons || m.lessons.length === 0" style="padding: 1rem; text-align: center; color: #94a3b8; background: #f1f5f9; border-radius: 4px;">
                    Nenhuma aula neste módulo
                  </div>
                </div>
              </div>
              <div *ngIf="!t.modules || t.modules.length === 0" style="padding: 2rem; text-align: center; color: #94a3b8;">
                Nenhum módulo adicionado
              </div>
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
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <div *ngIf="shouldShowCompletionPanel()" class="completion-badge-compact" title="Curso concluído" (click)="toggleCompletionPanel()">
                <span style="cursor:pointer;font-weight:600;color:#22c55e;display:flex;align-items:center;gap:0.3rem;">
                  ✅ Concluído
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9l6 6 12-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>
              <button *ngIf="t.entityType === 'EBOOK'" class="fullscreen-btn" (click)="toggleFullscreen()" title="Modo tela cheia" aria-label="Tela cheia">
                <svg *ngIf="!isFullscreen()" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3H5c-1.1 0-2 .9-2 2v3m16-5h3v3M3 16v3c0 1.1.9 2 2 2h3m11 0h3c1.1 0 2-.9 2-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg *ngIf="isFullscreen()" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3v3c0 1.1-.9 2-2 2H3m16-5h-3c-1.1 0-2 .9-2 2v3M3 16v3c0 1.1 .9 2 2 2h3m11 0h3c1.1 0 2-.9 2-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button *ngIf="t.entityType === 'RECORDED_COURSE'" class="toggle-lessons-btn" (click)="toggleSidebarMobile()" aria-label="Alternar lista de aulas">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 4h18M3 12h18M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Aulas
              </button>
            </div>
          </header>

          <!-- Painel de Conclusão (Dropdown) -->
          <div class="completion-dropdown-container" *ngIf="shouldShowCompletionPanel() && showCompletionDropdown()">
            <div class="completion-dropdown-overlay" (click)="showCompletionDropdown.set(false)"></div>
            <div class="completion-dropdown">
              <div class="completion-header">
                <span class="completion-badge">✅ Curso Completo!</span>
                <button class="close-btn" (click)="showCompletionDropdown.set(false)" aria-label="Fechar">✕</button>
              </div>
              
              <!-- Certificado Section -->
              <div class="completion-section">
                <h4>Certificado</h4>
                <div class="cert-actions">
                  <button 
                    *ngIf="!enrollmentHasCertificate()"
                    class="btn btn--certificate" 
                    (click)="issueCertificateFromPanel()"
                    [disabled]="issuingCertificate()">
                    {{ issuingCertificate() ? 'Emitindo...' : '📜 Emitir Certificado' }}
                  </button>
                  <button 
                    *ngIf="enrollmentHasCertificate()"
                    class="btn btn--certificate" 
                    (click)="downloadCertificateFromPanel()"
                    title="Baixar seu certificado">
                    📥 Baixar Certificado
                  </button>
                  <div *ngIf="certificateError()" class="error-message">{{ certificateError() }}</div>
                </div>
              </div>

              <!-- Rating Section -->
              <div class="completion-section">
                <h4>Sua Avaliação</h4>
                <div class="rating-section-panel">
                  <div *ngIf="enrollmentRating() === null" class="rating-prompt">
                    <div *ngIf="!showPanelRatingForm()">
                      <button class="btn btn--subtle" (click)="showPanelRatingForm.set(true)">Avalie este treinamento</button>
                    </div>
                    <div *ngIf="showPanelRatingForm()">
                      <p>O que você achou deste treinamento?</p>
                      <div class="rating-stars">
                        <button 
                          *ngFor="let star of [1,2,3,4,5]"
                          class="star"
                          [class.active]="panelRating() >= star"
                          (click)="setPanelRating(star)"
                          title="Clique para avaliar">
                          ⭐
                        </button>
                      </div>
                      <textarea 
                        class="rating-comment"
                        placeholder="Deixe um comentário (opcional)"
                        [(ngModel)]="panelCommentValue"
                        [disabled]="isSubmittingRatingFromPanel()">
                      </textarea>
                      <div style="display:flex;gap:.5rem;align-items:center">
                        <button 
                          class="btn btn--primary" 
                          (click)="submitPanelRating()"
                          [disabled]="panelRating() === 0 || isSubmittingRatingFromPanel()">
                          {{ isSubmittingRatingFromPanel() ? 'Enviando...' : 'Enviar Avaliação' }}
                        </button>
                        <button class="btn btn--subtle" (click)="showPanelRatingForm.set(false)" [disabled]="isSubmittingRatingFromPanel()">Cancelar</button>
                      </div>
                      <div *ngIf="ratingError()" class="error-message">{{ ratingError() }}</div>
                    </div>
                  </div>
                  <div *ngIf="enrollmentRating() !== null" class="rating-display">
                    <p class="rating-text">Você avaliou:</p>
                    <div class="rating-stars-display">
                      <span *ngFor="let i of [1,2,3,4,5]" class="star-display" [class.filled]="i <= (enrollmentRating() || 0)">⭐</span>
                    </div>
                    <p *ngIf="enrollmentComment()" class="comment-display">{{ enrollmentComment() }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Container principal: Player + Sidebar -->
          <div class="lesson-content">
            <!-- Main content (Video/PDF) -->
            <div class="player-section">
              <!-- Video player para RECORDED_COURSE -->
              <section *ngIf="t.entityType === 'RECORDED_COURSE'">
                <div *ngIf="videoUrl; else noVideo" id="player-container" class="video-container">
                  <div class="video-frame">
                    <iframe 
                      *ngIf="isExternalVideoUrl(videoUrl)"
                      class="video-embed"
                      [src]="sanitizedVideoUrl"
                      frameborder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                      title="Vídeo do curso">
                    </iframe>
                    <video 
                      #videoPlayer
                      *ngIf="!isExternalVideoUrl(videoUrl)"
                      class="video-embed"
                      [src]="videoUrl" 
                      controls 
                      controlsList="nodownload"
                      (ended)="onVideoEnded()"
                      (timeupdate)="onVideoTimeUpdate($any($event.target))"
                      title="Vídeo do curso">
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

              <!-- PDF Viewer para EBOOK -->
              <section *ngIf="t.entityType === 'EBOOK'">
                <div *ngIf="!loading() && rawPdfUrl; else ebookLoading" id="ebook-container" class="ebook-viewer-container">
                  <app-pdf-secure-viewer [pdfUrl]="rawPdfUrl" [initialPage]="currentPage()" [onPageChange]="onPageChange.bind(this)"></app-pdf-secure-viewer>
                </div>
                <ng-template #ebookLoading>
                  <div class="empty">
                    <p *ngIf="loading()">Carregando ebook…</p>
                    <p *ngIf="!loading() && !rawPdfUrl">Nenhum ebook disponível para este conteúdo.</p>
                  </div>
                </ng-template>
              </section>

              <!-- Lesson Description Section removed (duplicate iframe caused broken frame) -->
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
                <div *ngIf="saveIndicatorMessage()" class="save-indicator" style="margin-bottom:.5rem;font-size:.9rem;color:#0f5132;background:#d1e7dd;padding:.3rem .6rem;border-radius:6px;display:inline-block">{{ saveIndicatorMessage() }}</div>

                <div cdkDropList (cdkDropListDropped)="onModulesDropped($event)" [cdkDropListData]="training()?.modules" [cdkDropListDisabled]="!isAdmin() || training()?.entityType !== 'RECORDED_COURSE'">
                  <div class="module" *ngFor="let m of training()?.modules; let mi = index" cdkDrag [cdkDragDisabled]="!isAdmin() || training()?.entityType !== 'RECORDED_COURSE'">
                    <div class="module-title">
                      <span style="display:flex;gap:.5rem;align-items:center;">
                        <span *ngIf="isAdmin() && training()?.entityType === 'RECORDED_COURSE'" cdkDragHandle class="drag-handle" title="Arrastar" style="cursor:grab;opacity:.7;user-select:none;">☰</span>
                        <span>{{ mi + 1 }}. {{ m.title }}</span>
                      </span>
                      <span style="margin-left:auto;display:flex;gap:.4rem;align-items:center;">
                        <button *ngIf="isAdmin() && training()?.entityType === 'RECORDED_COURSE'" class="btn btn--xs btn--outline" (click)="openEditModule(m,$event)" type="button">Editar</button>
                        <button *ngIf="isAdmin() && training()?.entityType === 'RECORDED_COURSE'" class="btn btn--xs btn--danger" (click)="deleteModule(m,$event)" type="button">Excluir</button>
                      </span>
                    </div>
                    <div class="lessons-in-module" cdkDropList (cdkDropListDropped)="onLessonsDropped($event, m)" [cdkDropListData]="m.lessons" [cdkDropListDisabled]="!isAdmin() || training()?.entityType !== 'RECORDED_COURSE'">
                      <button 
                        *ngFor="let l of m.lessons; let li = index" 
                        class="lesson-item" cdkDrag [cdkDragDisabled]="!isAdmin() || training()?.entityType !== 'RECORDED_COURSE'"
                        [class.active]="currentLesson()?.id === l.id"
                        [class.completed]="watchedLessons().has(l.id + '')"
                        (click)="selectLesson(l)"
                        type="button">
                        <span *ngIf="isAdmin() && training()?.entityType === 'RECORDED_COURSE'" cdkDragHandle class="lesson-drag-handle" title="Arrastar aula" style="cursor:grab;margin-right:.5rem;opacity:.6;user-select:none;">⋮</span>
                        <span class="lesson-checkbox" 
                          (click)="toggleLessonCompletion(l, $event)"
                          [class.checked]="watchedLessons().has(l.id + '')"
                          role="checkbox" 
                          [attr.aria-checked]="watchedLessons().has(l.id + '')"
                          title="Marcar como concluido">
                          <span *ngIf="watchedLessons().has(l.id + '')">✓</span>
                        </span>
                        <span class="lesson-number">{{ li + 1 }}</span>
                        <span class="lesson-title" [attr.title]="l.title" [attr.aria-label]="l.title">{{ l.title }}</span>
                        <button *ngIf="l.content" type="button" class="lesson-content-icon" (click)="$event.stopPropagation(); openLessonContent(l)" title="Visualizar recursos da aula" aria-label="Visualizar recursos da aula">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
                          </svg>
                        </button>
                        <span style="margin-left:auto;display:flex;gap:.25rem;">
                          <button *ngIf="isAdmin() && training()?.entityType === 'RECORDED_COURSE'" type="button" class="btn btn--xs btn--outline" (click)="$event.stopPropagation(); openEditLesson(l,m)">Editar</button>
                          <button *ngIf="isAdmin() && training()?.entityType === 'RECORDED_COURSE'" type="button" class="btn btn--xs btn--danger" (click)="$event.stopPropagation(); deleteLesson(l,m)">Excluir</button>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <button class="btn btn--success btn-complete-course" (click)="completeLesson(currentLesson())" *ngIf="isLastLesson()">
                ✓ Marcar como Concluída
              </button>
            </aside>
          </div>

          <!-- Lesson Content Preview Modal -->
          <div class="overlay" *ngIf="showLessonContentModal()" (click)="closeLessonContent()"></div>
          <div class="content-preview-modal" *ngIf="showLessonContentModal() && selectedLessonContent()">
            <div class="modal-header">
              <h3>{{ selectedLessonContent()?.title }}</h3>
              <button type="button" class="modal-close-btn" (click)="closeLessonContent()" aria-label="Fechar modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-content" [innerHTML]="selectedLessonContent()?.content"></div>
          </div>

          <!-- Celebration Modal -->
          <div class="celebration-modal" *ngIf="showCelebration()">
            <div class="confetti-container" id="confetti">
              <span class="confetti" *ngFor="let i of [0,1,2,3,4,5,6,7,8,9]"></span>
              <span class="confetti" *ngFor="let i of [0,1,2,3,4,5,6,7,8,9]"></span>
            </div>
            <div class="celebration-content">
              <div class="celebration-icon">🎉</div>
              <h2>Parabéns!</h2>
              <p>Você completou essa aula com sucesso!</p>

              <!-- Rating Stars -->
              <div class="rating-section">
                <p class="rating-label">Como foi essa aula?</p>
                <div class="rating-stars">
                  <button 
                    *ngFor="let star of [1,2,3,4,5]"
                    class="star"
                    [class.active]="userRating() >= star"
                    (click)="setRating(star)"
                    title="Clique para avaliar">
                    ⭐
                  </button>
                </div>
              </div>

              <!-- Comment Input -->
              <textarea 
                class="rating-comment"
                placeholder="Deixe um comentário (opcional)"
                [(ngModel)]="commentValue"
                [disabled]="isSubmittingRating()">
              </textarea>

              <div class="celebration-actions">
                <button 
                  class="btn btn--success" 
                  (click)="issueCertificate()"
                  [disabled]="issuingCertificate()">
                  {{ issuingCertificate() ? 'Emitindo certificado...' : '📜 Emitir Certificado' }}
                </button>
                <button 
                  class="btn btn--subtle" 
                  (click)="closeCelebration()"
                  [disabled]="issuingCertificate()">
                  Fechar
                </button>
              </div>
              <div *ngIf="certificateError()" class="error-message">
                {{ certificateError() }}
              </div>
            </div>
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
      gap: 1.5rem;
      flex-wrap: wrap;
      align-items: flex-start;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .title-block {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-width: 260px;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #e8ecf1;
      border: 1px solid #d0d7e5;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #64748b;
      flex-shrink: 0;
    }

    .back-link:hover {
      background: #d8dfe8;
      border-color: #bcc7d4;
      color: #334155;
    }

    .back-link svg {
      width: 24px;
      height: 24px;
    }

    .title {
      margin: 0;
      font-size: 1.5rem;
      line-height: 1.1;
      font-weight: 600;
      letter-spacing: -0.5px;
      color: #1e293b;
    }

    .action-bar {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .toggle-lessons-btn { display: none; }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 38px;
    }

    .btn--primary {
      background: #60a5fa;
      color: white;
      border: 1.5px solid #60a5fa;
      box-shadow: 0 2px 6px rgba(96, 165, 250, 0.3);
    }

    .btn--primary:hover:not(:disabled) {
      background: #3b82f6;
      border-color: #3b82f6;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }

    .btn--primary:disabled {
      background: #cbd5e1;
      border-color: #cbd5e1;
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn--outline {
      background: white;
      color: #3b82f6;
      border: 1.5px solid #60a5fa;
      font-weight: 500;
    }

    .btn--outline:hover {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }

    .btn--subtle {
      background: white;
      color: #3b82f6;
      border: 1.5px solid #60a5fa;
      font-weight: 500;
    }

    .btn--subtle:hover {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }

    .file-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: white;
      border: 1.5px solid #60a5fa;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #3b82f6;
      transition: all 0.2s ease;
      height: 38px;
    }

    .file-btn:hover {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }

    .btn-sm {
      padding: 0.5rem 1rem !important;
      font-size: 0.9rem !important;
      height: 38px !important;
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
      padding: 2rem;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: box-shadow 0.2s ease;
    }

    .card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
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
      padding: 1.5rem;
      box-shadow: 0 10px 40px rgba(2, 6, 23, 0.24);
      width: clamp(320px, 90vw, 600px);
      max-height: 90vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }

    .create-input {
      display: block;
      width: 100%;
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      font-family: inherit;
      font-size: 0.95rem;
      box-sizing: border-box;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      transition: all 0.2s ease;
    }

    .create-input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
      border-color: #6366f1;
    }

    .create-input::placeholder {
      color: #cbd5e1;
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
      gap: 1.2rem;
      flex-wrap: wrap;
      margin-top: 1rem;
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
      font-size: 1.2rem;
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
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background: #f0f7ff;
      border: 1px solid #bae6fd;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .fullscreen-btn:hover {
      background: #e0f2fe;
      border-color: #0ea5e9;
    }

    .fullscreen-btn:active {
      transform: scale(0.95);
    }

    .fullscreen-btn svg {
      width: 18px;
      height: 18px;
      color: #0284c7;
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
      overflow: auto;
      background: #000;
    }

    .ebook-viewer-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #f5f5f5;
      overflow: auto;
    }

    .ebook-viewer-container app-pdf-secure-viewer {
      flex: 1;
      width: 100%;
      height: 100%;
    }

    .ebook-viewer-container:fullscreen {
      width: 100vw;
      height: 100vh;
      background: #000;
    }

    .ebook-viewer-container:fullscreen app-pdf-secure-viewer {
      width: 100%;
      height: 100%;
    }

    .lesson-description {
      background: white;
      padding: 1.5rem;
      border-top: 1px solid #e5e7eb;
      overflow-y: auto;
      max-height: 500px;
    }

    .lesson-video-section {
      margin-bottom: 1.5rem;
    }

    .lesson-video-frame {
      position: relative;
      width: 100%;
      padding-top: 56.25%; /* 16:9 aspect ratio */
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .lesson-video-frame iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .lesson-content-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e5e7eb;
    }

    .lesson-content-section h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .lesson-html-content {
      color: #374151;
      line-height: 1.6;
      font-size: 0.95rem;
    }

    .lesson-html-content h1,
    .lesson-html-content h2,
    .lesson-html-content h3,
    .lesson-html-content h4,
    .lesson-html-content h5,
    .lesson-html-content h6 {
      margin: 1rem 0 0.5rem 0;
      font-weight: 600;
      color: #1f2937;
    }

    .lesson-html-content p {
      margin: 0.5rem 0;
    }

    .lesson-html-content ul,
    .lesson-html-content ol {
      margin: 0.5rem 0;
      padding-left: 2rem;
    }

    .lesson-html-content li {
      margin: 0.25rem 0;
    }

    .lesson-html-content a {
      color: #3b82f6;
      text-decoration: underline;
    }

    .lesson-html-content a:hover {
      color: #1d4ed8;
    }

    .lesson-html-content code {
      background: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.85rem;
      color: #dc2626;
    }

    .lesson-html-content blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 1rem;
      margin-left: 0;
      color: #6b7280;
      font-style: italic;
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

    .lesson-content-icon {
      margin-left: 0.5rem;
      background: none;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .lesson-content-icon:hover {
      background-color: rgba(255, 255, 255, 0.2);
      color: #f0f0f0;
    }

    .lesson-item.active .lesson-icon {
      color: white;
    }

    .lesson-checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: #fff;
      border: 2px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.2s;
      font-size: 0.75rem;
      font-weight: 800;
      color: transparent;
    }

    .lesson-checkbox:hover {
      border-color: #007bff;
      background: #f0f7ff;
    }

    .lesson-checkbox.checked {
      background: #28a745;
      border-color: #28a745;
      color: white;
    }

    .lesson-item.active .lesson-checkbox {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .lesson-item.active .lesson-checkbox.checked {
      background: rgba(40, 167, 69, 0.8);
      border-color: rgba(255, 255, 255, 0.8);
      color: white;
    }

    .lesson-item.completed {
      opacity: 0.7;
    }

    .lesson-item.completed .lesson-title {
      text-decoration: line-through;
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
        width: 36px;
        height: 36px;
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
        width: 36px;
        height: 36px;
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

    /* Content Preview Modal Styles */
    .content-preview-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 1001;
      width: 90%;
      max-width: 700px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .content-preview-modal .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .content-preview-modal .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
    }

    .content-preview-modal .modal-close-btn {
      background: none;
      border: none;
      padding: 0.5rem;
      cursor: pointer;
      color: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .content-preview-modal .modal-close-btn:hover {
      background-color: #f3f4f6;
      color: #1f2937;
    }

    .content-preview-modal .modal-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      color: #374151;
      font-size: 0.95rem;
      line-height: 1.6;
    }

    .content-preview-modal .modal-content h1,
    .content-preview-modal .modal-content h2,
    .content-preview-modal .modal-content h3,
    .content-preview-modal .modal-content h4,
    .content-preview-modal .modal-content h5,
    .content-preview-modal .modal-content h6 {
      margin: 1.5rem 0 0.75rem 0;
      color: #1f2937;
      font-weight: 600;
    }

    .content-preview-modal .modal-content h1 {
      font-size: 1.875rem;
    }

    .content-preview-modal .modal-content h2 {
      font-size: 1.5rem;
    }

    .content-preview-modal .modal-content h3 {
      font-size: 1.25rem;
    }

    .content-preview-modal .modal-content p {
      margin: 0.75rem 0;
    }

    .content-preview-modal .modal-content pre {
      background-color: #f3f4f6;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
      margin: 1rem 0;
    }

    .content-preview-modal .modal-content code {
      background-color: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
    }

    .content-preview-modal .modal-content ul,
    .content-preview-modal .modal-content ol {
      margin: 1rem 0;
      padding-left: 2rem;
    }

    .content-preview-modal .modal-content li {
      margin: 0.5rem 0;
    }

    .content-preview-modal .modal-content blockquote {
      border-left: 4px solid #6366f1;
      padding-left: 1rem;
      color: #6b7280;
      margin: 1rem 0;
      font-style: italic;
    }

    .content-preview-modal .modal-content a {
      color: #6366f1;
      text-decoration: underline;
      cursor: pointer;
    }

    .content-preview-modal .modal-content a:hover {
      color: #4f46e5;
    }

    /* Celebration Modal Styles */
    .celebration-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .confetti-container {
      position: absolute;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      background: linear-gradient(45deg, #ff6b6b, #ffd93d, #6bcf7f, #4d96ff);
      animation: confetti-fall 3s ease-in forwards;
      pointer-events: none;
      opacity: 0.8;
    }

    @keyframes confetti-fall {
      to {
        transform: translateY(100vh) rotateZ(360deg);
        opacity: 0;
      }
    }

    .confetti:nth-child(1) {
      left: 10%;
      animation-delay: 0s;
      background-color: #ff6b6b;
    }
    .confetti:nth-child(2) {
      left: 20%;
      animation-delay: 0.1s;
      background-color: #ffd93d;
    }
    .confetti:nth-child(3) {
      left: 30%;
      animation-delay: 0.2s;
      background-color: #6bcf7f;
    }
    .confetti:nth-child(4) {
      left: 40%;
      animation-delay: 0.3s;
      background-color: #4d96ff;
    }
    .confetti:nth-child(5) {
      left: 50%;
      animation-delay: 0.4s;
      background-color: #ff6b6b;
    }
    .confetti:nth-child(6) {
      left: 60%;
      animation-delay: 0.5s;
      background-color: #ffd93d;
    }
    .confetti:nth-child(7) {
      left: 70%;
      animation-delay: 0.6s;
      background-color: #6bcf7f;
    }
    .confetti:nth-child(8) {
      left: 80%;
      animation-delay: 0.7s;
      background-color: #4d96ff;
    }
    .confetti:nth-child(9) {
      left: 90%;
      animation-delay: 0.8s;
      background-color: #ff6b6b;
    }
    .confetti:nth-child(10) {
      left: 5%;
      animation-delay: 0.9s;
      background-color: #ffd93d;
    }

    .celebration-content {
      background: white;
      padding: 3rem 2rem;
      border-radius: 16px;
      text-align: center;
      max-width: 500px;
      z-index: 10000;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.5s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(50px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .celebration-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      animation: bounce 0.6s ease-in-out infinite;
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-20px);
      }
    }

    .celebration-content h2 {
      margin: 0.5rem 0 0.5rem 0;
      font-size: 2rem;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .celebration-content p {
      margin: 0.5rem 0 2rem 0;
      color: #666;
      font-size: 1rem;
    }

    .celebration-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .celebration-actions .btn {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .celebration-actions .btn--success {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .celebration-actions .btn--success:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }

    .celebration-actions .btn--success:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .celebration-actions .btn--subtle {
      background: #f0f0f0;
      color: #333;
    }

    .celebration-actions .btn--subtle:hover {
      background: #e0e0e0;
    }

    .error-message {
      margin-top: 1rem;
      padding: 1rem;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      color: #856404;
      font-size: 0.9rem;
    }

    /* Rating Section Styles */
    .rating-section {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .rating-label {
      margin: 0 0 1rem 0;
      font-size: 0.95rem;
      color: #333;
      font-weight: 500;
    }

    .rating-stars {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .rating-stars .star {
      font-size: 2.5rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      opacity: 0.4;
      transition: all 0.2s ease;
      transform: scale(1);
    }

    .rating-stars .star:hover {
      opacity: 0.7;
      transform: scale(1.1);
    }

    .rating-stars .star.active {
      opacity: 1;
      filter: drop-shadow(0 2px 5px rgba(255, 215, 0, 0.5));
    }

    .rating-comment {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.9rem;
      resize: vertical;
      min-height: 60px;
      max-height: 100px;
      margin-bottom: 1rem;
      transition: border-color 0.2s ease;
    }

    .rating-comment:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .rating-comment:disabled {
      background: #f0f0f0;
      cursor: not-allowed;
    }

    /* Completion Dropdown */
    .completion-dropdown-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      padding-top: 70px;
    }

    .completion-dropdown-overlay {
      position: absolute;
      inset: 0;
      background: transparent;
      z-index: -1;
    }

    .completion-dropdown {
      position: relative;
      width: 100%;
      max-width: 420px;
      max-height: 80vh;
      overflow-y: auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      margin-right: 1rem;
      margin-top: 0.5rem;
      padding: 1.5rem;
      animation: slideInDown 0.25s ease-out;
    }

    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .completion-dropdown .completion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .completion-dropdown .completion-badge {
      font-weight: 600;
      font-size: 0.95rem;
      color: #22c55e;
    }

    .completion-dropdown .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #64748b;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }

    .completion-dropdown .close-btn:hover {
      color: #333;
    }

    .completion-dropdown .completion-section {
      margin-bottom: 1.5rem;
    }

    .completion-dropdown .completion-section h4 {
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #1e293b;
    }

    .completion-dropdown .cert-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .completion-dropdown .btn--certificate {
      padding: 0.6rem 1rem;
      border-radius: 6px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .completion-dropdown .btn--certificate:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .completion-dropdown .btn--certificate:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .completion-dropdown .rating-section-panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .completion-dropdown .rating-prompt {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .completion-dropdown .rating-stars {
      display: flex;
      gap: 0.3rem;
    }

    .completion-dropdown .star {
      font-size: 1.5rem;
      cursor: pointer;
      border: none;
      background: none;
      padding: 0.2rem;
      transition: transform 0.1s;
    }

    .completion-dropdown .star:hover {
      transform: scale(1.15);
    }

    .completion-dropdown .star.active {
      filter: drop-shadow(0 0 2px rgba(250, 204, 21, 0.5));
    }

    .completion-dropdown .btn--subtle {
      background: none;
      border: none;
      color: #667eea;
      cursor: pointer;
      padding: 0.4rem 0.8rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .completion-dropdown .btn--subtle:hover {
      color: #764ba2;
    }

    .completion-dropdown .btn--primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .completion-dropdown .btn--primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .completion-dropdown .btn--primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .completion-dropdown .error-message {
      color: #dc2626;
      font-size: 0.85rem;
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: #fee2e2;
      border-radius: 4px;
    }

    .completion-dropdown .rating-display {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .completion-dropdown .rating-text {
      font-weight: 500;
      color: #475569;
      margin: 0;
    }

    .completion-dropdown .rating-stars-display {
      display: flex;
      gap: 0.3rem;
    }

    .completion-dropdown .star-display {
      font-size: 1.25rem;
    }

    .completion-dropdown .star-display.filled {
      filter: drop-shadow(0 0 2px rgba(250, 204, 21, 0.5));
    }

    .completion-dropdown .comment-display {
      font-size: 0.9rem;
      color: #64748b;
      font-style: italic;
      margin: 0;
      padding: 0.5rem;
      background: #f8fafc;
      border-radius: 4px;
    }

    .completion-badge-compact {
      padding: 0.4rem 0.8rem;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      font-size: 0.85rem;
    }

    /* Quill Editor Styles */
    ::ng-deep .ql-container {
      border: none;
      font-family: inherit;
      font-size: 0.95rem;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    ::ng-deep .ql-editor {
      padding: 0.75rem;
      min-height: 250px;
      max-height: none;
      flex: 1;
      overflow-y: auto;
    }

    ::ng-deep .ql-toolbar {
      border: none;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      font-family: inherit;
    }

    ::ng-deep .ql-toolbar.ql-snow {
      padding: 0.5rem 0.5rem;
    }

    ::ng-deep .ql-toolbar.ql-snow .ql-formats {
      margin-right: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    ::ng-deep .ql-toolbar.ql-snow .ql-stroke {
      stroke: #64748b;
    }

    ::ng-deep .ql-toolbar.ql-snow .ql-fill,
    ::ng-deep .ql-toolbar.ql-snow .ql-stroke.ql-fill {
      fill: #64748b;
    }

    ::ng-deep .ql-toolbar.ql-snow button {
      padding: 0.25rem;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      transition: all 0.2s ease;
    }

    ::ng-deep .ql-toolbar.ql-snow button svg {
      width: 16px;
      height: 16px;
    }

    ::ng-deep .ql-toolbar.ql-snow button:hover,
    ::ng-deep .ql-toolbar.ql-snow button:focus,
    ::ng-deep .ql-toolbar.ql-snow button.ql-active,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-label:hover,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-item:hover,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-item.ql-selected {
      color: #6366f1;
      background-color: rgba(99, 102, 241, 0.1);
      border-color: #e2e8f0;
    }

    /* Quill Toolbar Tooltips */
    ::ng-deep .ql-toolbar.ql-snow button[title]:hover::before,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-label[title]:hover::before {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background-color: #1f2937;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      white-space: nowrap;
      z-index: 10;
      margin-bottom: 0.5rem;
      pointer-events: none;
    }

    ::ng-deep .ql-toolbar.ql-snow button[title]:hover::after,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-label[title]:hover::after {
      content: '';
      position: absolute;
      bottom: calc(100% - 4px);
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: #1f2937;
      z-index: 10;
      pointer-events: none;
    }

    ::ng-deep .ql-toolbar.ql-snow button,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-label {
      position: relative;
    }

    ::ng-deep .ql-toolbar.ql-snow button:hover .ql-stroke,
    ::ng-deep .ql-toolbar.ql-snow button:focus .ql-stroke,
    ::ng-deep .ql-toolbar.ql-snow button.ql-active .ql-stroke,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-label:hover .ql-stroke,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-item:hover .ql-stroke,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-item.ql-selected .ql-stroke {
      stroke: #6366f1;
    }

    ::ng-deep .ql-toolbar.ql-snow button:hover .ql-fill,
    ::ng-deep .ql-toolbar.ql-snow button:focus .ql-fill,
    ::ng-deep .ql-toolbar.ql-snow button.ql-active .ql-fill,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-label:hover .ql-fill,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-item:hover .ql-fill,
    ::ng-deep .ql-toolbar.ql-snow .ql-picker-item.ql-selected .ql-fill {
      fill: #6366f1;
    }

    ::ng-deep .ql-container {
      border: none;
      font-family: inherit;
      font-size: 0.95rem;
    }

    ::ng-deep .ql-editor {
      padding: 1rem;
      min-height: 250px;
      font-family: inherit;
    }

    ::ng-deep .ql-editor.ql-blank::before {
      color: #cbd5e1;
      font-style: italic;
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
  readonly sanitizer = inject(DomSanitizer);
  private readonly trainingService = inject(TrainingService);
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  // Controle de visualização
  private isAdminUser = this.auth?.isSystemAdmin?.() || this.auth?.hasOrganizationRole?.('ORG_ADMIN');
  private isAdminRoute = () => this.route.snapshot.url?.[0]?.path === 'admin';

  isAdmin = () => this.isAdminUser && this.isAdminRoute();
  isStudentView = () => !this.isAdminRoute();

  // Training data
  training = signal<any | null>(null);
  trainingId = signal<string | null>(null);
  enrollmentId = signal<string | null>(null);
  enrollmentInfo = signal<any | null>(null);
  currentPage = signal<number>(1);
  numPages = signal<number>(0);
  currentLesson = signal<any | null>(null);
  watchedLessons = signal<Set<string>>(new Set());
  videoProgress = signal<number>(0); // 0-100: porcentagem do vídeo assistido
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
  adminTrainingId: string | null = null; // ID do treinamento para acesso seguro ao PDF
  adminCurrentPage = signal<number>(1);
  adminNumPages = signal<number>(0);
  adminIsFullscreen = signal<boolean>(false);

  // Module / Lesson edit (admin)
  showEditModuleModal = signal<boolean>(false);
  editingModule = signal<boolean>(false);
  moduleEditForm = signal<{ id?: string; title: string; moduleOrder?: number }>({ id: undefined, title: '', moduleOrder: 0 });

  showEditLessonModal = signal<boolean>(false);
  editingLesson = signal<boolean>(false);
  lessonEditForm = signal<{ id?: string; title: string; content?: string; lessonOrder?: number; moduleId?: string; videoUrl?: string }>({ id: undefined, title: '', content: '', lessonOrder: 0, moduleId: undefined, videoUrl: '' });
  lessonEditFormOriginal = signal<{ id?: string; title: string; content?: string; lessonOrder?: number; moduleId?: string; videoUrl?: string }>({ id: undefined, title: '', content: '', lessonOrder: 0, moduleId: undefined, videoUrl: '' });

  // Lesson content preview modal
  showLessonContentModal = signal<boolean>(false);
  selectedLessonContent = signal<{ title: string; content: string } | null>(null);

  // Reorder / save indicator
  reorderSaving = signal<boolean>(false);
  saveIndicatorMessage = signal<string | null>(null);

  // Celebration & Certificate
  showCelebration = signal<boolean>(false);
  issuingCertificate = signal<boolean>(false);
  certificateError = signal<string | null>(null);

  // Rating
  userRating = signal<number>(0); // 0-5
  ratingComment = signal<string>('');
  isSubmittingRating = signal<boolean>(false);
  ratingError = signal<string | null>(null);

  // Panel Rating (para avaliação no painel de conclusão)
  panelRating = signal<number>(0);
  panelCommentValue: string = '';
  isSubmittingRatingFromPanel = signal<boolean>(false);
  enrollmentRating = signal<number | null>(null);
  enrollmentComment = signal<string | null>(null);
  // controla exibição do formulário no painel de conclusão
  showPanelRatingForm = signal<boolean>(false);
  // controla exibição do painel dropdown no header
  showCompletionDropdown = signal<boolean>(false);

  @ViewChild('videoPlayer') videoPlayer: ElementRef<HTMLVideoElement> | undefined;
  @ViewChild('pdfViewer') pdfViewer?: any;

  private pendingAutoplay = false;
  private onFullscreenChangeHandler: (() => void) | null = null;
  private _removeFullscreenListener: (() => void) | null = null;
  private saveMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  // Quill editor configuration
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  };

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
      let isPlayerFs = false;
      let isEbookFs = false;
      let isAdminFs = false;

      if (fsEl) {
        const ebookContainer = document.getElementById('ebook-container');
        const adminInline = document.getElementById('admin-inline-ebook');
        const playerContainer = document.getElementById('player-container');

        if (playerContainer) {
          isPlayerFs = playerContainer === fsEl || playerContainer.contains(fsEl as Node);
        }
        if (ebookContainer) {
          isEbookFs = ebookContainer === fsEl || ebookContainer.contains(fsEl as Node);
        }
        if (adminInline) {
          isAdminFs = adminInline === fsEl || adminInline.contains(fsEl as Node);
        }
      }

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
    if (this._removeFullscreenListener) {
      try { this._removeFullscreenListener(); } catch {}
    }
    if (this.saveMessageTimeout) {
      clearTimeout(this.saveMessageTimeout);
    }
  }

  private loadTraining(id: string): void {
    this.trainingId.set(id);
    this.loading.set(true);
    this.error.set(null);
    this.currentPage.set(1); // Reset página para novo treinamento

    // Try to get enrollmentId from user enrollments
    this.trainingService.getMyEnrollments().subscribe({
      next: (enrollments: any[]) => {
        const enrollment = enrollments.find(e => String(e.trainingId) === String(id));
        if (enrollment && enrollment.enrollmentId) {
          this.enrollmentId.set(enrollment.enrollmentId);
          // guarda objeto de matrícula para uso do painel (certificateId, userRating, comment)
          try {
            console.log('[TrainingViewer] Enrollment found:', enrollment);
            this.enrollmentInfo.set(enrollment);
            if (typeof enrollment.userRating === 'number') this.enrollmentRating.set(enrollment.userRating);
            if (typeof enrollment.ratingComment === 'string') this.enrollmentComment.set(enrollment.ratingComment);
          } catch (e) {}
        } else if (enrollment) {
          console.log('[TrainingViewer] Enrollment found but no enrollmentId:', enrollment);
        }
      },
      error: () => {
        // Ignore error, proceed without enrollmentId
      }
    });

    // SYSTEM_ADMIN tries admin API first, ORG_ADMIN tries public API
    // Regular students always use public/student routes
    const isSuperAdmin = this.isAdmin() || (this.isAdminUser && this.auth?.isSystemAdmin?.());
    const isOrgAdmin = this.isAdminUser && this.auth?.hasOrganizationRole?.('ORG_ADMIN');

    if (isSuperAdmin) {
      // SYSTEM_ADMIN uses admin API
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
    } else if (isOrgAdmin) {
      // ORG_ADMIN tries public API (may not have admin permissions)
      this.loadTrainingAsStudent(id);
    } else {
      // Regular student: fetch modules via public trainings endpoints
      this.loadTrainingAsStudent(id);
    }
  }

  private loadTrainingAsStudent(id: string): void {
    // Regular student or ORG_ADMIN: fetch modules via public trainings endpoints and try to enrich
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
    console.log('[TrainingViewer] Buscando ebook de estudante - URL:', url, 'ID:', id);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        console.log('[TrainingViewer] Blob recebido:', { size: blob?.size, type: blob?.type });
        
        if (!blob || !blob.size) {
          console.warn('[TrainingViewer] Blob vazio ou inválido');
          this.useAdminEbookUrl(training);
          this.loading.set(false);
          return;
        }

        try {
          const headerSlice = blob.slice(0, 5);
          headerSlice.text().then(header => {
            console.log('[TrainingViewer] Header do blob:', header);
            
            if (header && header.startsWith('%PDF')) {
              console.log('[TrainingViewer] É um PDF válido, criando blob URL');
              if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
              this.blobUrl = URL.createObjectURL(blob);
              this.rawPdfUrl = this.blobUrl;
              console.log('[TrainingViewer] PDF blob URL criada:', this.rawPdfUrl);
              this.loading.set(false);
              return;
            }

            console.log('[TrainingViewer] Não é um PDF, tentando ler como URL');
            blob.text().then(text => {
              const parsedUrl = (text || '').trim();
              console.log('[TrainingViewer] Texto do blob:', parsedUrl);
              
              if (parsedUrl && (parsedUrl.startsWith('http') || parsedUrl.startsWith('file:') || parsedUrl.startsWith('/'))) {
                this.rawPdfUrl = parsedUrl;
              } else {
                console.warn('[TrainingViewer] Blob não é PDF nem URL válida, usando fallback admin');
                this.useAdminEbookUrl(training);
              }
              this.loading.set(false);
            }).catch(() => {
              console.error('[TrainingViewer] Erro ao ler blob como texto');
              this.useAdminEbookUrl(training);
              this.loading.set(false);
            });
          }).catch(() => {
            console.log('[TrainingViewer] Erro ao ler header, tratando como PDF puro');
            if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} }
            this.blobUrl = URL.createObjectURL(blob);
            this.rawPdfUrl = this.blobUrl;
            console.log('[TrainingViewer] Blob URL criada (fallback):', this.rawPdfUrl);
            this.loading.set(false);
          });
        } catch (e) {
          console.error('[TrainingViewer] Exception ao processar blob:', e);
          this.useAdminEbookUrl(training);
          this.loading.set(false);
        }
      },
      error: err => {
        console.warn('[TrainingViewer] Erro ao buscar ebook para estudante:', {
          status: err.status,
          statusText: err.statusText,
          message: err.error instanceof ProgressEvent ? 'Network error' : err.error?.message || err.error,
          url: err.url
        });
        this.useAdminEbookUrl(training);
        this.loading.set(false);
      }
    });
  }

  private useAdminEbookUrl(training: any): void {
    const url = this.admin.buildEbookFileUrl(null, training?.id) || null;
    this.rawPdfUrl = url;
  }

  onVideoTimeUpdate(videoElement: HTMLVideoElement): void {
    if (!videoElement || videoElement.duration === 0) return;
    
    const progress = Math.round((videoElement.currentTime / videoElement.duration) * 100);
    this.videoProgress.set(progress);
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

    const completedLessons = this.watchedLessons().size;
    const currentVideoProgress = this.videoProgress();
    
    // Calcula progresso ponderado:
    // - Aulas completadas contam como 100%
    // - Aula atual contribui com seu progresso parcial
    const fractionPerLesson = 100 / totalLessons;
    const completedProgress = completedLessons * fractionPerLesson;
    const currentProgress = (currentVideoProgress / 100) * fractionPerLesson;
    
    return Math.round(completedProgress + currentProgress);
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

  isAllLessonsCompleted(): boolean {
    const training = this.training();
    if (!training) return false;

    const modules = training.modules || [];
    if (modules.length === 0) return false;

    // Count total lessons
    let totalLessons = 0;
    for (const module of modules) {
      totalLessons += (module.lessons || []).length;
    }

    // Count completed lessons
    const completedCount = this.watchedLessons().size;

    // Check if all lessons are completed
    return totalLessons > 0 && completedCount === totalLessons;
  }

  shouldShowCompletionPanel(): boolean {
    // Mostrar painel se:
    // 1. Todas as aulas foram marcadas localmente como concluídas
    if (this.isAllLessonsCompleted()) return true;

    // 2. Matrícula indica status COMPLETED
    const ei = this.enrollmentInfo();
    if (ei?.status === 'COMPLETED') return true;

    // 3. Progresso é 100%
    if (ei?.progressPercentage === 100) return true;

    // 4. Certifiquei-me também de cobrir variações de nomes
    if (ei?.progress === 100 || ei?.progressPct === 100) return true;

    // 5. Se tem certificado ou avaliação, também mostra (usuário pode ter recebido ambos offline)
    if (ei?.certificateId || (ei?.userRating !== undefined && ei?.userRating !== null)) return true;

    return false;
  }

  toggleCompletionPanel(): void {
    this.showCompletionDropdown.set(!this.showCompletionDropdown());
  }

  private loadProgress(trainingId: string): void {
    console.log('[TrainingViewer] Carregando progresso do ebook:', trainingId);
    this.api.get<any>(`/progress/ebooks/${encodeURIComponent(trainingId)}`).subscribe({
      next: (progress: any) => {
        console.log('[TrainingViewer] Progresso carregado:', progress);
        if (progress?.lastPageRead && progress.lastPageRead > 0) {
          console.log('[TrainingViewer] Restaurando página:', progress.lastPageRead);
          this.currentPage.set(progress.lastPageRead);
        }
      },
      error: (err: any) => {
        console.error('[TrainingViewer] Erro ao carregar progresso:', err);
      }
    });
  }

  onPageChange(pageNum: number, totalPages?: number): void {
    console.log('[TrainingViewer] Página alterada:', pageNum, 'de', totalPages);
    this.currentPage.set(pageNum);
    if (typeof totalPages === 'number') this.numPages.set(totalPages);

    const id = this.trainingId();
    if (id) {
      console.log('[TrainingViewer] Salvando progresso do ebook:', { trainingId: id, lastPageRead: pageNum });
      this.api.put(`/progress/ebooks/${encodeURIComponent(id)}`, { lastPageRead: pageNum }).subscribe({
        next: () => console.log('[TrainingViewer] Progresso salvo com sucesso'),
        error: (err: any) => console.error('[TrainingViewer] Erro ao salvar progresso:', err)
      });
    }
  }

  toggleFullscreen(): void {
    const container = document.getElementById('ebook-container');
    console.log('[TrainingViewer] toggleFullscreen - container found:', !!container, container?.id);
    if (!container) {
      console.warn('[TrainingViewer] ebook-container não encontrado');
      return;
    }
    
    const isNow = document.fullscreenElement === container;
    console.log('[TrainingViewer] isFullscreenNow:', isNow);
    
    if (!isNow) {
      console.log('[TrainingViewer] Solicitando fullscreen...');
      container.requestFullscreen?.().then(() => {
        console.log('[TrainingViewer] Fullscreen ativado');
        this.isFullscreen.set(true);
      }).catch((err: any) => {
        console.error('[TrainingViewer] Erro ao ativar fullscreen:', err);
      });
    } else {
      console.log('[TrainingViewer] Saindo do fullscreen...');
      if (document.fullscreenElement) {
        document.exitFullscreen?.().then(() => {
          console.log('[TrainingViewer] Fullscreen desativado');
          this.isFullscreen.set(false);
        }).catch((err: any) => {
          console.error('[TrainingViewer] Erro ao sair do fullscreen:', err);
        });
      }
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
    this.toggleLessonCompletion(lesson, new Event('click'));
  }

  toggleLessonCompletion(lesson: any, event: Event): void {
    event?.stopPropagation();
    const lessonId = String(lesson?.id);
    const isCurrentlyCompleted = this.watchedLessons().has(lessonId);

    if (isCurrentlyCompleted) {
      // Already completed - could allow unchecking if needed
      return;
    }

    // Mark as completed
    this.lesson.markLessonAsCompleted(lessonId).subscribe({
      next: () => {
        this.watchedLessons.update(w => {
          const s = new Set<string>(w ? Array.from(w) : []);
          s.add(lessonId);
          return s;
        });
        
        // Only show celebration modal if ALL lessons are now completed
        if (this.isAllLessonsCompleted()) {
          this.showCelebration.set(true);
        }
      },
      error: err => {
        const serverMsg = err?.error?.message || err?.message || '';
        if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('já foi marcada')) {
          // Already marked on server, update local state
          this.watchedLessons.update(w => {
            const s = new Set<string>(w ? Array.from(w) : []);
            s.add(lessonId);
            return s;
          });
          if (this.isAllLessonsCompleted()) {
            this.showCelebration.set(true);
          }
          return;
        }
        console.warn('Erro ao marcar aula:', serverMsg);
      }
    });
  }

  issueCertificate(): void {
    const enrollmentId = this.enrollmentId();
    if (!enrollmentId) {
      this.certificateError.set('ID da matrícula não disponível.');
      return;
    }

    this.issuingCertificate.set(true);
    this.certificateError.set(null);

    // Call API to issue certificate using enrollmentId
    // Backend retorna um código de validação (string simples, não JSON)
    this.api.post<string>(`/api/certificates/issue/${encodeURIComponent(enrollmentId)}`, {}, { responseType: 'text' as any }).subscribe({
      next: (validationCode) => {
        this.issuingCertificate.set(false);
        this.showSaveMessage('Certificado gerado com sucesso! Uma cópia em PDF também foi enviada para o seu e-mail.');
        this.closeCelebration();
      },
      error: (err) => {
        this.issuingCertificate.set(false);
        const errMsg = err?.error?.message || err?.message || 'Erro ao emitir certificado';
        this.certificateError.set(errMsg);
      }
    });
  }

  closeCelebration(): void {
    this.showCelebration.set(false);
  }

  closeCelebrationAndContinue(): void {
    this.showCelebration.set(false);
    this.goToNextLessonViaApi();
  }

  // Painel: verifica se matrícula possui certificado emitido
  enrollmentHasCertificate(): boolean {
    const ei = this.enrollmentInfo();
    return Boolean(ei && (ei.certificateId || ei.certificateId === 0));
  }

  // Emite certificado a partir do painel de conclusão (usa mesmo endpoint que issueCertificate)
  issueCertificateFromPanel(): void {
    const enrollmentId = this.enrollmentId();
    if (!enrollmentId) {
      this.certificateError.set('ID da matrícula não disponível.');
      return;
    }

    this.issuingCertificate.set(true);
    this.certificateError.set(null);

    // Backend retorna um código de validação (string simples, não JSON)
    this.api.post<string>(`/api/certificates/issue/${encodeURIComponent(enrollmentId)}`, {}, { responseType: 'text' as any }).subscribe({
      next: (validationCode) => {
        this.issuingCertificate.set(false);
        this.showSaveMessage('Certificado gerado com sucesso! Uma cópia em PDF também foi enviada para o seu e-mail.');
        // Atualiza matrícula localmente reconsultando enrollments para obter certificateId
        this.trainingService.getMyEnrollments().subscribe({
          next: (enrollments: any[]) => {
            const updated = enrollments.find(e => String(e.trainingId) === String(this.trainingId()));
            if (updated) this.enrollmentInfo.set(updated);
          },
          error: () => {}
        });
      },
      error: (err) => {
        this.issuingCertificate.set(false);
        const errMsg = err?.error?.message || err?.message || 'Erro ao emitir certificado';
        this.certificateError.set(errMsg);
      }
    });
  }

  // Baixa certificado a partir do painel (download de blob)
  downloadCertificateFromPanel(): void {
    const ei = this.enrollmentInfo();
    const certId = ei?.certificateId;
    if (!certId) {
      this.certificateError.set('Certificado não encontrado.');
      return;
    }

    const url = this.api.createUrl(`/api/certificates/download/${encodeURIComponent(certId)}`)
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        try {
          const bUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = bUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          a.click();
          try { URL.revokeObjectURL(bUrl); } catch {}
        } catch (e) {
          window.open(url, '_blank');
        }
      },
      error: (err) => {
        const errMsg = err?.error?.message || err?.message || 'Erro ao baixar certificado';
        this.certificateError.set(errMsg);
      }
    });
  }

  commentValue: string = ''; // for ngModel binding

  setRating(star: number): void {
    this.userRating.set(star);
  }

  submitRatingAndContinue(): void {
    const trainingId = this.trainingId();
    if (!trainingId) {
      this.closeCelebrationAndContinue();
      return;
    }

    this.isSubmittingRating.set(true);
    this.ratingError.set(null);

    const ratingPayload = {
      score: this.userRating(),
      comment: this.commentValue.trim()
    };

    this.api.post<void>(`/trainings/${encodeURIComponent(trainingId)}/rate`, ratingPayload).subscribe({
      next: () => {
        this.isSubmittingRating.set(false);
        // Reset rating
        this.userRating.set(0);
        this.commentValue = '';
        this.closeCelebrationAndContinue();
      },
      error: (err) => {
        this.isSubmittingRating.set(false);
        const errMsg = err?.error?.message || 'Erro ao enviar avaliação';
        this.ratingError.set(errMsg);
        // Ainda assim continua
        setTimeout(() => this.closeCelebrationAndContinue(), 1000);
      }
    });
  }

  setPanelRating(star: number): void {
    this.panelRating.set(star);
  }

  submitPanelRating(): void {
    const trainingId = this.trainingId();
    if (!trainingId) return;

    this.isSubmittingRatingFromPanel.set(true);
    this.ratingError.set(null);

    const payload = {
      score: this.panelRating(),
      comment: this.panelCommentValue?.trim()
    };

    this.api.post<void>(`/trainings/${encodeURIComponent(trainingId)}/rate`, payload).subscribe({
      next: () => {
        this.isSubmittingRatingFromPanel.set(false);
        this.enrollmentRating.set(this.panelRating());
        this.enrollmentComment.set(payload.comment || null);
        this.panelRating.set(0);
        this.panelCommentValue = '';
        this.showPanelRatingForm.set(false);
      },
      error: (err) => {
        this.isSubmittingRatingFromPanel.set(false);
        const errMsg = err?.error?.message || 'Erro ao enviar avaliação';
        this.ratingError.set(errMsg);
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

  buildEbookFileUrl(fileName: string | null = null, trainingId?: string): string | null {
    return this.admin.buildEbookFileUrl(fileName, trainingId);
  }

  openAdminViewer(trainingId: string | null): void {
    if (!trainingId) return;
    this.adminTrainingId = trainingId;
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

  // ----- Helper methods for module/lesson IDs -----
  getModuleId(module: any): string {
    return String(module?.id || module?.moduleId || '');
  }

  getLessonId(lesson: any): string {
    return String(lesson?.id || '');
  }

  // ----- Module & Lesson admin actions -----
  openCreateModule(): void {
    const training = this.training();
    if (!training) return;
    
    const maxOrder = training.modules ? Math.max(...training.modules.map((m: any) => m.moduleOrder || m.order || 0), 0) : 0;
    this.moduleEditForm.set({ id: undefined, title: '', moduleOrder: maxOrder + 1 });
    this.showEditModuleModal.set(true);
  }

  openCreateLesson(module: any): void {
    if (!module) return;
    const moduleId = this.getModuleId(module);
    const maxOrder = module.lessons ? Math.max(...module.lessons.map((l: any) => l.lessonOrder || l.order || 0), 0) : 0;
    this.lessonEditForm.set({ id: undefined, title: '', content: '', lessonOrder: maxOrder + 1, moduleId, videoUrl: '' });
    this.showEditLessonModal.set(true);
  }

  openEditModule(module: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!module) return;
    const moduleId = this.getModuleId(module);
    this.moduleEditForm.set({ id: moduleId, title: String(module.title || ''), moduleOrder: module.moduleOrder ?? module.order ?? 0 });
    this.showEditModuleModal.set(true);
  }

  closeEditModule(): void {
    this.showEditModuleModal.set(false);
  }

  setModuleField(key: 'title' | 'moduleOrder', value: any): void {
    this.moduleEditForm.update(f => ({ ...f, [key]: value }));
  }

  submitEditModule(): void {
    const form = this.moduleEditForm();
    if (!form || !form.title) return;
    this.editingModule.set(true);

    const isCreating = !form.id;
    const request$ = isCreating
      ? this.admin.createCourseModule(this.trainingId() || '', { title: form.title, moduleOrder: Number(form.moduleOrder) || 0 })
      : this.admin.updateCourseModule(form.id!, { title: form.title, moduleOrder: Number(form.moduleOrder) || 0 });

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.editingModule.set(false);
          this.showEditModuleModal.set(false);
          const tid = this.trainingId(); if (tid) this.loadTraining(tid);
        },
        error: err => {
          this.editingModule.set(false);
          const msg = isCreating ? 'Erro ao criar módulo' : 'Erro ao atualizar módulo';
          try { alert(err?.message || msg); } catch {}
        }
      });
  }

  deleteModule(module: any, event?: Event): void {
    if (event) try { event.stopPropagation(); } catch {}
    const moduleId = this.getModuleId(module);
    if (!moduleId) return;
    const ok = confirm('Excluir este módulo e todas as suas aulas?');
    if (!ok) return;
    this.admin.deleteCourseModule(moduleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { const tid = this.trainingId(); if (tid) this.loadTraining(tid); },
        error: err => { try { alert(err?.message || 'Erro ao excluir módulo'); } catch {} }
      });
  }

  openEditLesson(lesson: any, module?: any): void {
    if (!lesson) return;
    const lessonId = this.getLessonId(lesson);
    const moduleId = module ? this.getModuleId(module) : undefined;
    
    const formData = { 
      id: lessonId, 
      title: String(lesson.title || ''), 
      content: String(lesson.content || ''), 
      lessonOrder: lesson.lessonOrder ?? lesson.order ?? 0, 
      moduleId, 
      videoUrl: String((lesson as any).videoUrl || '') 
    };
    
    // Armazenar os valores originais
    this.lessonEditFormOriginal.set(formData);
    this.lessonEditForm.set(formData);
    this.showEditLessonModal.set(true);
    
    // Add tooltips to Quill buttons
    setTimeout(() => this.setupQuillTooltips(), 100);
  }

  setupQuillTooltips(): void {
    const tooltips: { [selector: string]: string } = {
      '[class*="ql-bold"]': 'Negrito',
      '[class*="ql-italic"]': 'Itálico',
      '[class*="ql-underline"]': 'Sublinhado',
      '[class*="ql-strike"]': 'Riscado',
      '[class*="ql-blockquote"]': 'Citação',
      '[class*="ql-code-block"]': 'Bloco de Código',
      '[class*="ql-header"][value="1"]': 'Título 1',
      '[class*="ql-header"][value="2"]': 'Título 2',
      '[class*="ql-list"][value="ordered"]': 'Lista Numerada',
      '[class*="ql-list"][value="bullet"]': 'Lista com Marcadores',
      '[class*="ql-link"]': 'Inserir Link',
      '[class*="ql-image"]': 'Inserir Imagem',
      '[class*="ql-clean"]': 'Limpar Formatação'
    };

    Object.entries(tooltips).forEach(([selector, tooltip]) => {
      const elements = document.querySelectorAll(`.ql-toolbar.ql-snow ${selector}`);
      elements.forEach((el) => {
        if (!el.getAttribute('title')) {
          el.setAttribute('title', tooltip);
        }
      });
    });
  }

  closeEditLesson(): void {
    this.showEditLessonModal.set(false);
  }

  setLessonField(key: 'title' | 'content' | 'lessonOrder' | 'videoUrl', value: any): void {
    this.lessonEditForm.update(f => ({ ...f, [key]: value }));
  }

  openLessonContent(lesson: any): void {
    this.showLessonContentModal.set(true);
    this.selectedLessonContent.set({
      title: lesson.title,
      content: lesson.content || ''
    });
  }

  closeLessonContent(): void {
    this.showLessonContentModal.set(false);
    this.selectedLessonContent.set(null);
  }

  submitEditLesson(): void {
    const current = this.lessonEditForm();
    const original = this.lessonEditFormOriginal();
    
    if (!current || !current.title || !current.moduleId) return;
    
    const isCreating = !current.id;
    
    // Se for criação, enviar todos os campos
    if (isCreating) {
      this.editingLesson.set(true);
      this.admin.createModuleLesson(current.moduleId, { 
        title: current.title, 
        content: current.content, 
        lessonOrder: Number(current.lessonOrder) || 0, 
        videoUrl: current.videoUrl || '' 
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: updated => {
            this.editingLesson.set(false);
            this.showEditLessonModal.set(false);
            const tid = this.trainingId(); if (tid) this.loadTraining(tid);
          },
          error: err => {
            this.editingLesson.set(false);
            try { alert(err?.message || 'Erro ao criar aula'); } catch {}
          }
        });
      return;
    }
    
    // Se for edição, verificar quais campos foram alterados
    // Porém SEMPRE incluir title e lessonOrder (campos obrigatórios no backend)
    let hasChanges = false;
    
    if (current.title !== original.title || 
        current.content !== original.content || 
        current.lessonOrder !== original.lessonOrder || 
        current.videoUrl !== original.videoUrl) {
      hasChanges = true;
    }
    
    // Se não houver mudanças, fechar modal sem fazer requisição
    if (!hasChanges) {
      this.showEditLessonModal.set(false);
      return;
    }
    
    // Se houver mudanças, atualizar enviando TODOS os campos obrigatórios + alterados
    const payload: any = {
      title: current.title, // Always send (required)
      lessonOrder: Number(current.lessonOrder) || 0 // Always send (required)
    };
    
    // Enviar campos opcionais se foram alterados ou têm valores
    if (current.content !== original.content || current.content) {
      payload.content = current.content || null;
    }
    if (current.videoUrl !== original.videoUrl || current.videoUrl) {
      payload.videoUrl = current.videoUrl || null;
    }
    
    this.editingLesson.set(true);
    this.admin.updateModuleLesson(current.id!, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.editingLesson.set(false);
          this.showEditLessonModal.set(false);
          const tid = this.trainingId(); if (tid) this.loadTraining(tid);
        },
        error: err => {
          this.editingLesson.set(false);
          try { alert(err?.message || 'Erro ao atualizar aula'); } catch {}
        }
      });
  }

  deleteLesson(lesson: any, module?: any): void {
    const lessonId = this.getLessonId(lesson);
    if (!lessonId) return;
    const ok = confirm('Excluir esta aula?');
    if (!ok) return;
    this.admin.deleteModuleLesson(lessonId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { const tid = this.trainingId(); if (tid) this.loadTraining(tid); },
        error: err => { try { alert(err?.message || 'Erro ao excluir aula'); } catch {} }
      });
  }

  // Drag & Drop handlers
  onModulesDropped(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) return; // Sem mudança
    const t = this.training(); if (!t) return;
    const modules = t.modules || [];
    moveItemInArray(modules, event.previousIndex, event.currentIndex);
    this.training.update(_ => ({ ...(t || {}), modules }));

    const items = (modules || []).map((m: any, i: number) => ({ id: this.getModuleId(m), newOrder: i + 1 }));
    const tid = this.trainingId();
    if (!tid) return;
    this.reorderSaving.set(true);
    this.admin.reorderTrainingModules(tid, items)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.reorderSaving.set(false); this.showSaveMessage('Ordem dos módulos salva'); },
        error: () => { this.reorderSaving.set(false); this.showSaveMessage('Erro ao salvar ordem'); }
      });
  }

  onLessonsDropped(event: CdkDragDrop<any[]>, module: any): void {
    if (event.previousIndex === event.currentIndex) return; // Sem mudança
    if (!module) return;
    const lessons = module.lessons || [];
    moveItemInArray(lessons, event.previousIndex, event.currentIndex);

    const t = this.training(); if (!t) return;
    const moduleId = this.getModuleId(module);
    const modules = (t.modules || []).map((m: any) => {
      if (this.getModuleId(m) === moduleId) {
        return { ...m, lessons };
      }
      return m;
    });
    this.training.update(_ => ({ ...(t || {}), modules }));

    const items = (lessons || []).map((l: any, i: number) => ({ id: this.getLessonId(l), newOrder: i + 1 }));
    this.reorderSaving.set(true);
    this.admin.reorderModuleLessons(moduleId, items)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.reorderSaving.set(false); this.showSaveMessage('Ordem das aulas salva'); },
        error: () => { this.reorderSaving.set(false); this.showSaveMessage('Erro ao salvar ordem'); }
      });
  }

  showSaveMessage(msg: string): void {
    if (this.saveMessageTimeout) clearTimeout(this.saveMessageTimeout);
    this.saveIndicatorMessage.set(msg);
    this.saveMessageTimeout = setTimeout(() => {
      this.saveIndicatorMessage.set(null);
      this.saveMessageTimeout = null;
    }, 3000);
  }
}
