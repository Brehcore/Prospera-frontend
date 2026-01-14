import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { PublicationStatusPipe } from '../../core/pipes/publication-status.pipe';

@Component({
  selector: 'app-admin-training-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, PublicationStatusPipe],
  template: `
  <div class="training-detail-page" *ngIf="isSystemAdmin(); else noAccess" (click)="closeFilePickers()">
    <div class="header-row" *ngIf="training() as t">
      <div class="title-block">
        <a class="back-link" routerLink="/admin">← Voltar</a>
    <h1 class="title">{{t.title}}</h1>
      </div>
      <div class="action-bar">
        <button type="button" class="btn btn--primary" (click)="publish()" [disabled]="publishing() || (t.publicationStatus||'').toLowerCase()==='published'">{{ (t.publicationStatus||'').toLowerCase()==='published' ? 'Publicado' : 'Publicar' }}</button>
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
      <!-- Modal de editar metadados do treinamento (disponível para todos os tipos) -->
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
      <section class="card">
        <h2 class="card-title">Descrição</h2>
        <p class="description">{{t.description || '—'}}</p>
      </section>
  <!-- Seção Módulos (apenas para cursos gravados) -->
  <section class="card modules-column" *ngIf="t.entityType === 'RECORDED_COURSE'">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.6rem;">
          <h2 class="card-title" style="margin:0">Módulos</h2>
          <div>
            <button type="button" class="btn btn--primary btn-xs" (click)="openAddModule()">Adicionar Módulo</button>
          </div>
        </div>

        <div *ngIf="!(t.modules || []).length" class="mono" style="padding:.6rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">Nenhum módulo criado.</div>

        <div *ngFor="let m of (t.modules || [])" style="margin-top:.8rem;border:1px solid #e2e8f0;border-radius:10px;padding:.6rem;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-weight:700">{{m.title || 'Módulo'}}</div>
            <div style="display:flex;gap:.5rem;align-items:center">
              <button type="button" class="btn btn--ghost btn-xs" (click)="openAddLesson(m.id)">Adicionar Aula</button>
            </div>
          </div>
          <div *ngIf="(m.lessons || []).length" style="margin-top:.5rem;padding-left:.6rem;">
            <ol style="margin:0;padding-left:1rem;">
              <li *ngFor="let l of m.lessons" style="margin-bottom:.3rem">{{l.title || 'Aula'}} <span class="mono" style="color:#64748b;font-size:.7rem">(#{{l.lessonOrder || '-' }})</span></li>
            </ol>
          </div>
        </div>

        <!-- Modal de adicionar módulo -->
        <div class="overlay" *ngIf="showAddModule()" (click)="closeAddModule()"></div>
        <div class="create-modal" *ngIf="showAddModule()" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" style="max-width:520px;">
          <form (submit)="$event.preventDefault(); submitAddModule();">
            <h3 style="margin-top:0">Adicionar Módulo</h3>
            <label style="display:block;margin-bottom:.4rem">Título</label>
            <input type="text" [value]="addModuleForm().title" (input)="setAddModuleField('title',$any($event.target).value)" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem;" />
            <label style="display:block;margin-bottom:.4rem">Ordem</label>
            <input type="number" [value]="addModuleForm().moduleOrder" (input)="setAddModuleField('moduleOrder',$any($event.target).value)" style="width:120px;padding:.35rem .5rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.6rem;" />
            <div style="display:flex;gap:.5rem;justify-content:flex-end">
              <button type="button" class="btn btn--subtle" (click)="closeAddModule()" [disabled]="creatingModule()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="creatingModule()">{{ creatingModule() ? 'Criando...' : 'Criar Módulo' }}</button>
            </div>
            <div *ngIf="addModuleError()" class="error" style="margin-top:.5rem">{{addModuleError()}}</div>
          </form>
        </div>

        <!-- (edit modal moved below so it's rendered for all training types) -->

        <!-- Modal de adicionar aula -->
        <div class="overlay" *ngIf="showAddLessonForModuleId()" (click)="closeAddLesson()"></div>
        <div class="create-modal" *ngIf="showAddLessonForModuleId()" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" style="max-width:640px;">
          <form (submit)="$event.preventDefault(); submitAddLesson(showAddLessonForModuleId()!)">
            <h3 style="margin-top:0">Adicionar Aula</h3>
            <label style="display:block;margin-bottom:.4rem">Título</label>
            <input type="text" [value]="addLessonForm().title" (input)="setAddLessonField('title',$any($event.target).value)" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem;" />
            <label style="display:block;margin-bottom:.4rem">Conteúdo (URL do vídeo)</label>
            <input type="text" [value]="addLessonForm().content" (input)="setAddLessonField('content',$any($event.target).value)" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem;" />
            <label style="display:block;margin-bottom:.4rem">Ordem</label>
            <input type="number" [value]="addLessonForm().lessonOrder" (input)="setAddLessonField('lessonOrder',$any($event.target).value)" style="width:120px;padding:.35rem .5rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.6rem;" />
            <div style="display:flex;gap:.5rem;justify-content:flex-end">
              <button type="button" class="btn btn--subtle" (click)="closeAddLesson()" [disabled]="creatingLesson()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="creatingLesson()">{{ creatingLesson() ? 'Criando...' : 'Criar Aula' }}</button>
            </div>
            <div *ngIf="addLessonError()" class="error" style="margin-top:.5rem">{{addLessonError()}}</div>
          </form>
        </div>
      </section>
      <section class="card" *ngIf="t.entityType==='EBOOK' && t.ebookDetails as ed">
        <h2 class="card-title">E-book</h2>
        <div class="kv-grid">
          <div class="kv-item"><span class="k">Arquivo</span><span class="v mono">{{ed.filePath || extractPdfFileName(t) || '—'}}</span></div>
          <div class="kv-item"><span class="k">Páginas</span><span class="v">{{ed.totalPages || '—'}}</span></div>
          <div class="kv-item"><span class="k">Upload</span><span class="v">{{ed.fileUploadedAt | date:'short'}}</span></div>
        </div>
        <div class="ebook-actions" *ngIf="trainingHasPdf(t)">
          <a *ngIf="buildEbookFileUrl(extractPdfFileName(t)) as pdfUrl" class="btn btn--ghost btn-xs" [href]="pdfUrl" target="_blank" rel="noopener">Abrir PDF</a>
        </div>
      </section>
      <section class="card">
        <h2 class="card-title">Setores Vinculados</h2>

        <div class="assignment-form" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.6rem;">
          <select [value]="assignmentForm().sectorId" (change)="setAssignmentField('sectorId',$any($event.target).value)" style="min-width:220px;padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;background:#fff;">
            <option value="">— Selecionar setor —</option>
            <option *ngFor="let s of sectors()" [value]="s.id">{{s.name}}</option>
          </select>
          <select [value]="assignmentForm().trainingType" (change)="setAssignmentField('trainingType',$any($event.target).value)" style="padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;background:#fff;">
            <option value="COMPULSORY">Compulsório</option>
            <option value="ELECTIVE">Eletivo</option>
          </select>
          <input type="text" placeholder="Base legal (opcional)" [value]="assignmentForm().legalBasis" (input)="setAssignmentField('legalBasis',$any($event.target).value)" style="padding:.45rem .6rem;border-radius:8px;border:1px solid #e2e8f0;min-width:200px;" />
          <button type="button" class="btn btn--primary btn-xs" (click)="addSector()" [disabled]="assigning()">{{ assigning() ? 'Vinculando...' : 'Vincular setor' }}</button>
        </div>

        <div *ngIf="assignmentError()" class="error" style="margin-bottom:.5rem">{{assignmentError()}}</div>
        <div *ngIf="assignmentMessage()" class="success" style="margin-bottom:.5rem;color:#065f46">{{assignmentMessage()}}</div>

  <table class="table mini center-headers" aria-label="Setores vinculados">
    <thead><tr><th>ID</th><th>Nome do Setor</th><th>Tipo</th><th>Base Legal</th><th class="actions-header">Ações</th></tr></thead>
          <tbody>
            <tr *ngFor="let sa of (training().sectorAssignments || [])">
              <td data-label="ID" class="mono">{{sa.sectorId}}</td>
              <td data-label="Nome do Setor">{{sectorName(sa.sectorId)}}</td>
              <td data-label="Tipo">{{ displaySectorType(sa.trainingType) }}</td>
              <td data-label="Base Legal">{{sa.legalBasis || '—'}}</td>
              <td data-label="Ações" class="actions-col"><div style="display:flex;justify-content:center"><button type="button" class="btn btn--ghost btn-xs" (click)="unlinkSector(sa.sectorId, t.id)">Remover</button></div></td>
            </tr>
            <tr *ngIf="!(training().sectorAssignments || []).length">
              <td colspan="5" class="mono">Nenhum setor vinculado.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
  <ng-template #noAccess><p class="error">Acesso negado.</p></ng-template>
  `,
  styles: [`
    :host { display:block; padding:1.5rem clamp(0.75rem,2vw,1.5rem) 3rem; }
    .training-detail-page { display:flex; flex-direction:column; gap:1.25rem; }
    .header-row { display:flex; justify-content:space-between; gap:1.25rem; flex-wrap:wrap; align-items:flex-start; }
    .title-block { display:flex; flex-direction:column; gap:.4rem; min-width:260px; }
    .back-link { text-decoration:none; font-size:.7rem; color:#4f46e5; font-weight:600; }
    .back-link:hover { text-decoration:underline; }
    .title { margin:0; font-size:1.4rem; line-height:1.1; font-weight:600; letter-spacing:-.5px; color:#1e293b; }
    .status-badge { display:inline-block; width:fit-content; font-size:.6rem; font-weight:600; letter-spacing:.05em; text-transform:uppercase; padding:.3rem .55rem; border-radius:6px; background:#e2e8f0; color:#334155; }
    .status-badge.published { background:linear-gradient(90deg,#22c55e,#16a34a); color:#fff; }
    .action-bar { display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; }
    .loading.skeleton { opacity:.75; }
    .error { font-size:.8rem; color:#b91c1c; }
    .cards { display:grid; gap:1rem; grid-template-columns:1fr; }
    .card { background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:1rem 1.1rem 1.1rem; position:relative; box-shadow:0 4px 14px -6px rgba(0,0,0,.08); display:flex; flex-direction:column; gap:.85rem; animation:fadeIn .25s ease; }
    .card-title { margin:0; font-size:.85rem; letter-spacing:.05em; font-weight:700; text-transform:uppercase; color:#334155; }
    .meta-card { padding-bottom:.9rem; }
    .cover-meta { display:flex; gap:1.25rem; flex-wrap:wrap; align-items:stretch; }
    .cover { margin:0; width:140px; }
    .cover img { width:140px; height:180px; object-fit:cover; border:1px solid #e2e8f0; border-radius:10px; box-shadow:0 2px 6px -2px rgba(0,0,0,.15); background:#fff; }
    .cover-fallback { width:140px; height:180px; border:1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; font-size:.65rem; border-radius:10px; color:#64748b; background:#f8fafc; }
    .pdf-flag { margin-top:.5rem; text-align:center; font-size:.55rem; letter-spacing:.05em; background:#eef2ff; border:1px solid #c7d2fe; color:#3730a3; padding:.18rem .45rem; border-radius:6px; font-weight:600; }
    .meta-grid { display:grid; flex:1; gap:.75rem; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); align-content:start; }
    .meta-grid .field { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:.55rem .65rem .65rem; display:flex; flex-direction:column; gap:.35rem; position:relative; box-shadow:0 1px 2px rgba(0,0,0,.05); }
    .meta-grid label { font-size:.55rem; letter-spacing:.05em; text-transform:uppercase; color:#64748b; font-weight:700; }
    .value { font-size:.72rem; font-weight:500; color:#1e293b; word-break:break-word; }
    .mono { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.62rem; }
    .description { font-size:.7rem; color:#334155; line-height:1.4; margin:0; white-space:pre-line; }
    .kv-grid { display:grid; gap:.6rem; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); }
    .kv-item { background:#f8fafc; border:1px solid #e2e8f0; padding:.5rem .6rem; border-radius:8px; font-size:.6rem; display:flex; flex-direction:column; gap:.3rem; }
    .kv-item .k { font-size:.55rem; letter-spacing:.05em; text-transform:uppercase; color:#64748b; font-weight:600; }
    .kv-item .v { font-size:.7rem; font-weight:500; color:#1e293b; }
    .ebook-actions { display:flex; gap:.5rem; flex-wrap:wrap; }
    .table { width:100%; border-collapse:collapse; font-size:.65rem; }
  .table thead th { text-align:left; font-size:.55rem; letter-spacing:.05em; text-transform:uppercase; font-weight:600; padding:.45rem .5rem; background:#f1f5f9; color:#334155; }
  /* centered header only for the Ações column (use class 'center-headers' on table) */
  .center-headers thead th.actions-header { text-align:center; }
    .table tbody td { padding:.45rem .5rem; border-top:1px solid #e2e8f0; }
    .actions-col { text-align:right; }
    /* Buttons */
    .btn { --btn-bg:#f1f5f9; --btn-border:#cbd5e1; --btn-color:#0f172a; --btn-bg-hover:#e2e8f0; --btn-shadow:0 1px 2px rgba(0,0,0,.05); font-size:.66rem; font-weight:600; letter-spacing:.4px; padding:.55rem .9rem; border-radius:9px; border:1px solid var(--btn-border); background:var(--btn-bg); color:var(--btn-color); cursor:pointer; transition:.18s cubic-bezier(.4,0,.2,1); display:inline-flex; align-items:center; gap:.45rem; position:relative; box-shadow:var(--btn-shadow); }
    .btn-xs { padding:.35rem .55rem; font-size:.55rem; border-radius:7px; }
    .btn:disabled { opacity:.6; cursor:not-allowed; }
    .btn:not(:disabled):hover { background:var(--btn-bg-hover); transform:translateY(-1px); box-shadow:0 4px 14px -4px rgba(0,0,0,.15); }
    .btn:not(:disabled):active { transform:translateY(0); box-shadow:0 2px 8px -4px rgba(0,0,0,.2); }
    .btn--primary { --btn-bg:#6366f1; --btn-bg-hover:#4f46e5; --btn-border:#6366f1; --btn-color:#fff; }
    .btn--outline { --btn-bg:#ffffff; --btn-bg-hover:#f8fafc; --btn-border:#94a3b8; }
    .btn--ghost { background:transparent; border:1px solid transparent; box-shadow:none; padding:.45rem .65rem; }
    .btn--ghost:hover { background:#f1f5f9; }
    .file-btn { cursor:pointer; overflow:hidden; }
    .badge { padding:.25rem .55rem; font-size:.55rem; border-radius:14px; font-weight:600; letter-spacing:.5px; background:#e2e8f0; color:#334155; position:relative; overflow:hidden; }
    .badge-active { background:linear-gradient(90deg,#22c55e,#16a34a); color:#fff; }
    .badge-inactive { background:linear-gradient(90deg,#f87171,#dc2626); color:#fff; }
    .progress-bar.top { position:relative; height:5px; background:#e2e8f0; border-radius:4px; overflow:hidden; margin-top:-.5rem; }
    .progress-bar .bar { position:absolute; inset:0; background:linear-gradient(90deg,#6366f1,#818cf8); transition:width .25s; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
  /* Modal overlay and centered modal styles - ensure modal overlays the page instead of injecting inline */
  .overlay { position:fixed; inset:0; background:rgba(2,6,23,0.45); z-index:60; }
  .create-modal { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:70; background:#ffffff; border-radius:12px; padding:1rem; box-shadow:0 10px 40px rgba(2,6,23,0.24); width:clamp(320px,90%,640px); max-height:90vh; overflow:auto; }
    /* cards empilhados verticalmente por padrão (uma coluna) */
    .cards { grid-template-columns: 1fr; }
    .meta-card { grid-column:1 / -1; }
    .modules-column { max-height: none; overflow: visible; }
  `]
})
export class AdminTrainingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  training = signal<any | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  publishing = signal<boolean>(false);
  uploadProgress = signal<number | null>(null);
  coverBroken = signal<boolean>(false);
  sectors = signal<any[]>([]);

  // formulário local para vincular setor
  assignmentForm = signal<{ sectorId: string; trainingType: string; legalBasis: string }>({ sectorId: '', trainingType: 'COMPULSORY', legalBasis: '' });
  assigning = signal<boolean>(false);
  assignmentError = signal<string | null>(null);
  assignmentMessage = signal<string | null>(null);

  isSystemAdmin = () => this.auth.hasRole('SYSTEM_ADMIN');

  constructor() {
    effect(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) this.fetch(id);
    });
    // Carrega lista de setores para permitir resolver o nome exibido na tabela
    this.loadSectors();
  }

  fetch(id: string) {
    this.loading.set(true); this.error.set(null);
    this.admin.getTrainingById(id).subscribe({
      next: (t: any) => {
        if (t && !t.publicationStatus && t['status']) {
          t = { ...t, publicationStatus: t['status'] };
        }
        this.training.set(t as any);
      },
      error: err => this.error.set(err?.message || 'Erro ao carregar treinamento'),
      complete: () => this.loading.set(false)
    });
  }

  publish() {
    const t = this.training(); if (!t || (t.publicationStatus||'').toLowerCase()==='published') return;
    if (!confirm(`Publicar '${t.title}'?`)) return;
    this.publishing.set(true);
    this.admin.publishTraining(t.id).subscribe({
      next: () => this.training.update(curr => curr ? { ...curr, publicationStatus: 'PUBLISHED' } : curr),
      error: err => this.error.set(err?.message || 'Falha ao publicar'),
      complete: () => this.publishing.set(false)
    });
  }

  onPdfSelected(file: File) {
    const t = this.training(); if (!t || !file) return;
    this.uploadProgress.set(0); this.admin.uploadEbookFileWithProgress(t.id, file).subscribe({
      next: ev => { if (ev.type==='progress') this.uploadProgress.set(ev.progress ?? 0); },
      error: err => { this.error.set(err?.message || 'Falha upload PDF'); this.uploadProgress.set(null); },
      complete: () => {
        this.uploadProgress.set(100);
        const id = t.id;
        setTimeout(()=> { this.uploadProgress.set(null); this.fetch(id); }, 1200);
      }
    });
  }

  onCoverSelected(file: File) {
    const t = this.training(); if (!t || !file) return;
    this.uploadProgress.set(0); this.admin.uploadTrainingCoverImage(t.id, file).subscribe({
      next: ev => { if (ev.type==='progress') this.uploadProgress.set(ev.progress ?? 0); },
      error: err => { this.error.set(err?.message || 'Falha upload capa'); this.uploadProgress.set(null); },
      complete: () => {
        this.uploadProgress.set(100);
        const id = t.id;
        setTimeout(()=> { this.uploadProgress.set(null); this.fetch(id); }, 1000);
      }
    });
  }

  trainingHasPdf(t: any) { return this.admin.trainingHasPdf(t); }
  extractPdfFileName(t: any) { return this.admin.extractPdfFileName(t); }
  buildEbookFileUrl(fileName: string) { return this.admin.buildEbookFileUrl(fileName); }

  // --- Módulos e Aulas (árvore para RECORDED_COURSE) ---
  showAddModule = signal<boolean>(false);
  creatingModule = signal<boolean>(false);
  addModuleForm = signal<{ title: string; moduleOrder: number }>({ title: '', moduleOrder: 1 });
  addModuleError = signal<string | null>(null);

  showAddLessonForModuleId = signal<string | null>(null);
  creatingLesson = signal<boolean>(false);
  addLessonForm = signal<{ title: string; content: string; lessonOrder: number }>({ title: '', content: '', lessonOrder: 1 });
  addLessonError = signal<string | null>(null);

  // --- Edit metadata modal ---
  showEditModal = signal<boolean>(false);
  editing = signal<boolean>(false);
  editError = signal<string | null>(null);
  editForm = signal<{ title: string; description: string; author: string }>({ title: '', description: '', author: '' });

  unlinkSector(sectorId: string, trainingId: string) {
    if (!sectorId || !trainingId) return;
    if (!confirm('Remover vínculo com setor?')) return;
    this.admin.unlinkTrainingSector(trainingId, sectorId).subscribe({
      next: () => this.training.update(t => t ? { ...t, sectorAssignments: (t.sectorAssignments||[]).filter((s:any)=> s.sectorId !== sectorId) } : t),
      error: err => this.error.set(err?.message || 'Falha ao desvincular setor')
    });
  }

  openEditMetadata() {
    const t = this.training();
    if (!t) return;
    this.editForm.set({ title: String(t.title ?? ''), description: String(t.description ?? ''), author: String(t.author ?? '') });
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditMetadata() { this.showEditModal.set(false); }

  setEditField(key: 'title' | 'description' | 'author', value: any) {
    this.editForm.update(f => ({ ...f, [key]: value }));
  }

  submitEditMetadata() {
    const t = this.training(); if (!t) return;
    const form = this.editForm();
    this.editError.set(null);
    const payload: any = {};
    if (form.title !== undefined) payload.title = String(form.title).trim();
    if (form.description !== undefined) payload.description = String(form.description).trim();
    if (form.author !== undefined) payload.author = String(form.author).trim();
    this.editing.set(true);
    this.admin.updateTraining(t.id, payload).subscribe({
      next: updated => {
        // service may return the updated training or not; if not, refetch to get fresh data
        if (updated && (updated as any).id) {
          this.training.set(updated as any);
        } else {
          this.fetch(t.id);
        }
        this.showEditModal.set(false);
      },
      error: err => this.editError.set(err?.message || 'Falha ao atualizar treinamento'),
      complete: () => this.editing.set(false)
    });
  }

  setAssignmentField(key: 'sectorId' | 'trainingType' | 'legalBasis', value: any) {
    this.assignmentForm.update(f => ({ ...f, [key]: value }));
  }

  addSector() {
    const t = this.training();
    if (!t) return;
    const form = this.assignmentForm();
    this.assignmentError.set(null);
    if (!form.sectorId) { this.assignmentError.set('Selecione um setor.'); return; }
    this.assigning.set(true);
    this.admin.assignTrainingToSector(t.id, { sectorId: String(form.sectorId), trainingType: String(form.trainingType), legalBasis: String(form.legalBasis) }).subscribe({
      next: () => {
        // Atualiza UI localmente (backend retorna void) => cria o objeto mínimo para exibir
        const newAssign = { sectorId: form.sectorId, trainingType: form.trainingType, legalBasis: form.legalBasis } as any;
        this.training.update(curr => curr ? { ...curr, sectorAssignments: [...(curr.sectorAssignments||[]), newAssign] } : curr);
        this.assignmentMessage.set('Setor vinculado com sucesso.');
        // limpa formulário
        this.assignmentForm.set({ sectorId: '', trainingType: 'COMPULSORY', legalBasis: '' });
        setTimeout(() => this.assignmentMessage.set(null), 2500);
      },
      error: err => this.assignmentError.set(err?.message || 'Falha ao vincular setor'),
      complete: () => this.assigning.set(false)
    });
  }

  // Abre modal de criar módulo
  openAddModule() {
    this.addModuleForm.set({ title: '', moduleOrder: (this.training()?.modules?.length || 0) + 1 });
    this.addModuleError.set(null);
    this.showAddModule.set(true);
  }
  closeAddModule() { this.showAddModule.set(false); }

  submitAddModule() {
    const t = this.training(); if (!t) return;
    const form = this.addModuleForm();
    if (!form.title.trim()) { this.addModuleError.set('Título do módulo é obrigatório.'); return; }
    this.creatingModule.set(true); this.addModuleError.set(null);
    this.admin.createCourseModule(t.id, { title: form.title.trim(), moduleOrder: Number(form.moduleOrder) || 0 }).subscribe({
      next: created => {
        // garante array
        this.training.update(curr => {
          if (!curr) return curr;
          const modules = Array.isArray(curr.modules) ? [...curr.modules, created] : [created];
          return { ...curr, modules };
        });
        this.showAddModule.set(false);
      },
      error: err => this.addModuleError.set(err?.message || 'Falha ao criar módulo'),
      complete: () => this.creatingModule.set(false)
    });
  }

  setAddModuleField(key: 'title' | 'moduleOrder', value: any) {
    this.addModuleForm.update(f => ({ ...f, [key]: key === 'moduleOrder' ? Number(value) || 0 : value }));
  }

  setAddLessonField(key: 'title' | 'content' | 'lessonOrder', value: any) {
    this.addLessonForm.update(f => ({ ...f, [key]: key === 'lessonOrder' ? Number(value) || 0 : value }));
  }

  // Aulas
  openAddLesson(moduleId: string) {
    this.addLessonForm.set({ title: '', content: '', lessonOrder: 1 });
    this.addLessonError.set(null);
    this.showAddLessonForModuleId.set(moduleId);
  }
  closeAddLesson() { this.showAddLessonForModuleId.set(null); }

  submitAddLesson(moduleId: string) {
    const form = this.addLessonForm();
    if (!form.title.trim()) { this.addLessonError.set('Título da aula é obrigatório.'); return; }
    this.creatingLesson.set(true); this.addLessonError.set(null);
  this.admin.createModuleLesson(moduleId, { title: form.title.trim(), content: form.content?.trim() || undefined, lessonOrder: Number(form.lessonOrder) || 0 }).subscribe({
      next: created => {
        // localmente adiciona a lesson ao módulo correspondente
        this.training.update(curr => {
          if (!curr) return curr;
          const modules = Array.isArray(curr.modules) ? curr.modules.map((m:any) => {
            if (String(m.id) === String(moduleId)) {
              const lessons = Array.isArray(m.lessons) ? [...m.lessons, created] : [created];
              return { ...m, lessons };
            }
            return m;
          }) : [];
          return { ...curr, modules };
        });
        this.showAddLessonForModuleId.set(null);
      },
      error: err => this.addLessonError.set(err?.message || 'Falha ao criar aula'),
      complete: () => this.creatingLesson.set(false)
    });
  }

  private loadSectors() {
    this.admin.getSectors().subscribe({
      next: list => this.sectors.set(list || []),
      error: () => {/* silencioso para não poluir UI principal */}
    });
  }

  sectorName(sectorId: string | null | undefined): string {
    if (!sectorId) return '—';
    const found = this.sectors().find(s => s.id === sectorId);
    const candidate = found?.name || sectorId;
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (guidRegex.test(String(candidate))) return '—';
    return candidate;
  }

  displaySectorType(type: string | null | undefined): string {
    if (!type) return '—';
    const t = String(type).toUpperCase();
    // Normalize OPTIONAL -> ELECTIVE token if needed, then provide Portuguese labels
    if (t === 'OPTIONAL' || t === 'ELECTIVE') return 'Eletivo';
    if (t === 'COMPULSORY' || t === 'MANDATORY') return 'Compulsório';
    // Fallback: return as-is to avoid losing data
    return type as string;
  }

  // Placeholder para futuras interações (ex: fechar menus/file pickers externos se necessário)
  closeFilePickers() { /* no-op por enquanto */ }
}
