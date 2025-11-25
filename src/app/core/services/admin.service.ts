import { HttpClient, HttpErrorResponse, HttpEventType, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, filter, map, of, throwError } from 'rxjs';

import {
  AdminSector,
  AdminTraining,
  AdminTrainingPayload,
  AdminTrainingUpdatePayload,
  AssignTrainingPayload,
  EbookProgress,
  EbookUploadEvent
} from '../models/admin';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly api: ApiService, private readonly http: HttpClient) {}

  getSectors(): Observable<AdminSector[]> {
    return this.api.get<unknown>('/admin/sectors').pipe(map(response => this.unwrapList<AdminSector>(response).map(this.normalizeSector)));
  }

  /**
   * Carrega setores do catálogo público (endpoint público)
   * GET /public/catalog/sectors
   */
  getCatalogSectors(): Observable<any[]> {
    return this.api.get<unknown>('/public/catalog/sectors').pipe(
      map(response => {
        // Se a resposta for um array direto, retornar; caso contrário, extrair a lista
        if (Array.isArray(response)) {
          return response;
        }
        return this.unwrapList<any>(response);
      })
    );
  }

  // --- Organizations (Admin) ---
  getOrganizations(): Observable<any[]> {
    return this.api.get<unknown>('/admin/organizations').pipe(
      map(resp => this.unwrapList<any>(resp).map(o => this.normalizeOrganization(o)))
    );
  }

  getOrganizationById(orgId: string): Observable<any> {
    return this.api.get<unknown>(`/admin/organizations/${encodeURIComponent(orgId)}`).pipe(
      map(resp => this.normalizeOrganization(resp))
    );
  }

  updateOrganizationEnabled(orgId: string, enabled: boolean): Observable<any> {
    const newStatus = enabled ? 'ACTIVE' : 'INACTIVE';
    // endpoint principal conhecido (legacy)
    return this.api.patch<any>(`/admin/organizations/${encodeURIComponent(orgId)}/status`, { newStatus }).pipe(
      catchError(err => {
        // fallback: PATCH direto com enabled (caso backend aceite)
        if (err && (err.status === 400 || err.status === 404 || err.status === 405)) {
          return this.api.patch<any>(`/admin/organizations/${encodeURIComponent(orgId)}`, { enabled });
        }
        return throwError(() => err);
      })
    );
  }

  // --- Users (Admin) ---
  getUsers(): Observable<any[]> {
    return this.api.get<unknown>('/admin/users').pipe(
      map(resp => this.unwrapList<any>(resp).map(u => this.normalizeUser(u)))
    );
  }

  getUserById(userId: string): Observable<any> {
    return this.api.get<unknown>(`/admin/users/${encodeURIComponent(userId)}`).pipe(
      map(resp => this.normalizeUser(resp))
    );
  }

  updateUserEnabled(userId: string, enabled: boolean): Observable<any> {
    // tenta endpoint canônico; se falhar com 400/404/405 poderemos futuramente tentar fallback /status
    return this.api.patch<any>(`/admin/users/${encodeURIComponent(userId)}`, { enabled }).pipe(
      catchError(err => {
        // fallback opcional baseado no legacy
        if (err && (err.status === 400 || err.status === 404 || err.status === 405)) {
          const newStatus = enabled ? 'ACTIVE' : 'INACTIVE';
          return this.api.patch<any>(`/admin/users/${encodeURIComponent(userId)}/status`, { newStatus });
        }
        return throwError(() => err);
      })
    );
  }

  createSector(name: string): Observable<AdminSector> {
    return this.api
      .post<AdminSector>('/admin/sectors', { name })
      .pipe(map(this.normalizeSector));
  }

  deleteSector(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/sectors/${encodeURIComponent(id)}`).pipe(map(() => void 0));
  }

  getSectorById(id: string): Observable<AdminSector> {
    return this.api
      .get<AdminSector>(`/admin/sectors/${encodeURIComponent(id)}`)
      .pipe(map(this.normalizeSector));
  }

  getTrainings(): Observable<AdminTraining[]> {
    return this.api.get<unknown>('/admin/trainings').pipe(map(response => this.unwrapList<AdminTraining>(response).map(this.normalizeTraining)));
  }

  createTraining(payload: AdminTrainingPayload): Observable<AdminTraining> {
    // normaliza entityType defensivamente antes de enviar
    const body = { ...payload } as any;
    if (body.entityType !== undefined && body.entityType !== null) {
      body.entityType = this.normalizeEntityType(String(body.entityType));
    }
    return this.api
      .post<AdminTraining>('/admin/trainings', body)
      .pipe(map(this.normalizeTraining));
  }

  getTrainingById(id: string): Observable<AdminTraining> {
    return this.api
      .get<AdminTraining>(`/admin/trainings/${encodeURIComponent(id)}`)
      .pipe(map(this.normalizeTraining));
  }

  updateTraining(id: string, changes: AdminTrainingUpdatePayload): Observable<AdminTraining> {
    const body = { ...changes } as any;
    if (body.entityType !== undefined && body.entityType !== null) {
      body.entityType = this.normalizeEntityType(String(body.entityType));
    }
    return this.api
      .put<AdminTraining>(`/admin/trainings/${encodeURIComponent(id)}`, body)
      .pipe(map(this.normalizeTraining));
  }

  /**
   * Normaliza variantes conhecidas de entityType para os enums aceitos pelo backend.
   * Evita enviar valores legados como 'COURSE' que causam InvalidDataAccessApiUsageException.
   */
  private normalizeEntityType(value: string | null | undefined): string | null {
    if (!value) return null;
    const v = String(value).trim().toUpperCase();
    if (!v) return null;
    if (v === 'COURSE' || v === 'RECORDED' || v === 'RECORDED_COURSE' || v.includes('RECOR')) return 'RECORDED_COURSE';
    if (v === 'LIVE_COURSE' || v === 'LIVE_TRAINING' || v.includes('LIVE') || v.includes('AO_VIVO')) return 'LIVE_TRAINING';
    if (v === 'EBOOK' || v.includes('EBOOK')) return 'EBOOK';
    return v;
  }

  publishTraining(id: string): Observable<void> {
    return this.api.post<void>(`/admin/trainings/${encodeURIComponent(id)}/publish`, {}).pipe(map(() => void 0));
  }

  deleteTraining(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/trainings/${encodeURIComponent(id)}`).pipe(map(() => void 0));
  }

  assignTrainingToSector(trainingId: string, assignment: AssignTrainingPayload): Observable<void> {
    return this.api
      .post<void>(`/admin/trainings/${encodeURIComponent(trainingId)}/sectors`, assignment)
      .pipe(map(() => void 0));
  }

  unlinkTrainingSector(trainingId: string, sectorId: string): Observable<void> {
    return this.api
      .delete<void>(`/admin/trainings/${encodeURIComponent(trainingId)}/sectors/${encodeURIComponent(sectorId)}`)
      .pipe(map(() => void 0));
  }

  /**
   * Cria um módulo para um curso gravado (RECORDED_COURSE).
   * POST /admin/courses/{trainingId}/modules
   */
  createCourseModule(trainingId: string, payload: { title: string; moduleOrder?: number }): Observable<any> {
    const body = { title: (payload.title || '').trim(), moduleOrder: Number(payload.moduleOrder) || 0 };
    return this.api.post<any>(`/admin/trainings/courses/${encodeURIComponent(trainingId)}/modules`, body).pipe(map(resp => resp as any));
  }

  /**
   * Cria uma aula (lesson) dentro de um módulo.
   * POST /admin/modules/{moduleId}/lessons
   */
  createModuleLesson(moduleId: string, payload: { title: string; content?: string; lessonOrder?: number }): Observable<any> {
    const body = { title: (payload.title || '').trim(), content: payload.content ?? undefined, lessonOrder: Number(payload.lessonOrder) || 0 };
    return this.api.post<any>(`/admin/trainings/modules/${encodeURIComponent(moduleId)}/lessons`, body).pipe(map(resp => resp as any));
  }

  orgUnfollowSector(orgId: string, sectorId: string): Observable<void> {
    return this.api
      .delete<void>(`/organizations/${encodeURIComponent(orgId)}/sectors/${encodeURIComponent(sectorId)}`)
      .pipe(map(() => void 0));
  }

  /**
   * Adiciona um setor à organização (adotar setor do catálogo global)
   * POST /organizations/{orgId}/sectors
   */
  addSectorToOrganization(orgId: string, sectorId: string): Observable<void> {
    if (!orgId || !sectorId) return of(void 0);
    return this.api
      .post<void>(`/organizations/${encodeURIComponent(orgId)}/sectors`, { sectorId })
      .pipe(map(() => void 0));
  }

  /**
   * Lista todos os setores atualmente adotados pela organização
   * GET /organizations/{orgId}/sectors
   */
  getOrganizationSectors(orgId: string): Observable<any[]> {
    return this.api.get<unknown>(`/organizations/${encodeURIComponent(orgId)}/sectors`).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        }
        return this.unwrapList<any>(response);
      })
    );
  }

  // --- Organization members / enrollments ---
  /**
   * Lista membros matriculados em um treinamento específico dentro de uma organização.
   * GET /organizations/{orgId}/trainings/{trainingId}/enrollments
   */
  getOrganizationEnrollments(orgId: string, trainingId: string): Observable<any[]> {
    if (!orgId || !trainingId) return of([]);
    const path = `/organizations/${encodeURIComponent(orgId)}/trainings/${encodeURIComponent(trainingId)}/enrollments`;
    return this.api.get<unknown>(path).pipe(map(resp => this.unwrapList<any>(resp)));
  }

  /**
   * Matricula em massa membros da organização em um treinamento.
   * POST /organizations/{orgId}/enrollments
   */
  enrollMembersInTraining(orgId: string, payload: { trainingId: string; userIds: string[] }): Observable<void> {
    if (!orgId || !payload || !payload.trainingId || !Array.isArray(payload.userIds) || payload.userIds.length === 0) return of(void 0);
    const path = `/organizations/${encodeURIComponent(orgId)}/enrollments`;
    return this.api.post<void>(path, payload).pipe(map(() => void 0));
  }

  /**
   * Lista membros da organização (endpoint alternativo mais genérico).
   * GET /organizations/{orgId}/members
   */
  getOrganizationMembers(orgId: string): Observable<any[]> {
    if (!orgId) return of([]);
    return this.api.get<unknown>(`/organizations/${encodeURIComponent(orgId)}/members`).pipe(map(resp => this.unwrapList<any>(resp)));
  }

  /**
   * Lista os treinamentos do catálogo que podem ser atribuídos/contratados para a organização.
   * GET /organizations/{orgId}/assignable-trainings
   */
  getAssignableTrainingsForOrg(orgId: string): Observable<any[]> {
    if (!orgId) return of([]);
    const path = `/organizations/${encodeURIComponent(orgId)}/assignable-trainings`;
    return this.api.get<unknown>(path).pipe(map(resp => this.unwrapList<any>(resp)));
  }

  /**
   * Lista organizações do usuário autenticado
   * GET /profile/me/organizations
   */
  getMyOrganizations(): Observable<any[]> {
    return this.api.get<unknown>('/profile/me/organizations').pipe(map(resp => this.unwrapList<any>(resp)));
  }

  /**
   * Cria nova organização
   * POST /organizations
   */
  createOrganization(payload: { razaoSocial: string; cnpj: string }): Observable<any> {
    const body = { razaoSocial: (payload.razaoSocial || '').trim(), cnpj: (payload.cnpj || '').trim() };
    return this.api.post<any>('/organizations', body);
  }

  /**
   * Adiciona um membro à organização (Admin role required)
   * POST /organizations/{organizationId}/members
   */
  addOrganizationMember(orgId: string, payload: any): Observable<any> {
    const body = { ...(payload || {}) };
    return this.api.post<any>(`/organizations/${encodeURIComponent(orgId)}/members`, body);
  }

  /**
   * Remove um membro da organização
   * DELETE /organizations/{organizationId}/members/{membershipId}
   */
  deleteOrganizationMember(orgId: string, membershipId: string): Observable<void> {
    return this.api.delete<void>(`/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`).pipe(map(() => void 0));
  }

  /**
   * Atualiza a role de um membro na organização
   * PATCH /organizations/{organizationId}/members/{membershipId}
   */
  updateOrganizationMemberRole(orgId: string, membershipId: string, payload: any): Observable<any> {
    const body = { ...(payload || {}) };
    return this.api.patch<any>(`/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, body);
  }

  /**
   * Busca detalhes completos de um membro na organização
   * GET /organizations/{organizationId}/members/{membershipId}
   */
  getMemberDetails(orgId: string, membershipId: string): Observable<any> {
    if (!orgId || !membershipId) return of(null);
    return this.api.get<unknown>(`/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`).pipe(map(resp => resp as any));
  }

  /**
   * Busca o progresso de um membro em todos os seus cursos
   * GET /organizations/{organizationId}/members/{membershipId}/progress
   */
  getMemberProgress(orgId: string, membershipId: string): Observable<any> {
    if (!orgId || !membershipId) return of(null);
    return this.api.get<unknown>(`/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}/progress`).pipe(map(resp => resp as any));
  }

  uploadEbookFile(trainingId: string, file: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<unknown>(`/admin/trainings/ebooks/${encodeURIComponent(trainingId)}/upload`, formData);
  }

  uploadEbookFileWithProgress(trainingId: string, file: File): Observable<EbookUploadEvent> {
    const formData = new FormData();
    formData.append('file', file);
    const url = this.api.createUrl(`/admin/trainings/ebooks/${encodeURIComponent(trainingId)}/upload`);
    const request = new HttpRequest('POST', url, formData, {
      reportProgress: true
    });
    return this.http.request(request).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          return { type: 'progress', progress } as EbookUploadEvent;
        }
        if (event.type === HttpEventType.Response) {
          return { type: 'response', body: event.body ?? null } as EbookUploadEvent;
        }
        return null;
      }),
      filter((event): event is EbookUploadEvent => event !== null),
      catchError(error => {
        const message = error instanceof HttpErrorResponse ? error.message || 'Falha no upload do e-book.' : 'Falha no upload do e-book.';
        return throwError(() => new Error(message));
      })
    );
  }

  uploadTrainingCoverImage(trainingId: string, file: File): Observable<EbookUploadEvent> {
    const formData = new FormData();
    formData.append('file', file);
    const url = this.api.createUrl(`/admin/trainings/${encodeURIComponent(trainingId)}/cover-image`);
    const request = new HttpRequest('POST', url, formData, { reportProgress: true });
    return this.http.request(request).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
            return { type: 'progress', progress } as EbookUploadEvent;
        }
        if (event.type === HttpEventType.Response) {
          return { type: 'response', body: event.body ?? null } as EbookUploadEvent;
        }
        return null;
      }),
      filter((e): e is EbookUploadEvent => e !== null),
      catchError(err => throwError(() => new Error(err?.message || 'Falha no upload da capa.')))
    );
  }

  fetchEbookProgress(trainingId: string): Observable<EbookProgress | null> {
    return this.api.get<EbookProgress>(`/progress/ebooks/${encodeURIComponent(trainingId)}`).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      })
    );
  }

  // --- Monetization: subscription plans (public/internal)
  getSubscriptionPlans(): Observable<any[]> {
    // Busca planos a partir do catálogo público (/public/catalog) e filtra itens tipo PACKAGE/PLAN
    return this.api.get<unknown>('/public/catalog/plans').pipe(
      map(resp => {
        const list = this.unwrapList<any>(resp);
        return list.filter((item: any) => {
          const t = String(item?.format ?? item?.type ?? '').toUpperCase();
          const hasPrice = (typeof item?.originalPrice === 'number') || (typeof item?.currentPrice === 'number');
          const hasDuration = typeof item?.durationInDays === 'number' || typeof item?.duration === 'number';
          return (
            t === 'PACKAGE' || t === 'PLAN' || t === 'SUBSCRIPTION' || t === 'ENTERPRISE' || t === 'INDIVIDUAL' ||
            item?.isPackage === true || (hasPrice && hasDuration)
          );
        });
      })
    );
  }

  /**
   * Lista assinaturas com suporte a filtros opcionais.
   * Exemplos:
   *  - GET /admin/subscriptions
   *  - GET /admin/subscriptions?origin=MANUAL&status=ACTIVE
   *  - GET /admin/subscriptions?status=EXPIRED
   */
  getSubscriptions(filters?: { origin?: string; status?: string }): Observable<any[]> {
    const params: string[] = [];
    if (filters?.origin) params.push(`origin=${encodeURIComponent(String(filters.origin))}`);
    if (filters?.status) params.push(`status=${encodeURIComponent(String(filters.status))}`);
    const path = params.length ? `/admin/subscriptions?${params.join('&')}` : '/admin/subscriptions';
    return this.api.get<unknown>(path).pipe(
      map(resp => this.unwrapList<any>(resp))
    );
  }

  /**
   * Cria uma nova assinatura pessoal (vinculada à "Conta Pessoal" do usuário).
   * POST /admin/subscriptions/users
   * body: { userId: string, planId: string }
   */
  createPersonalSubscription(payload: { userId: string; planId: string }): Observable<any> {
    if (!payload || !payload.userId || !payload.planId) return of(null);
    const body = { userId: String(payload.userId), planId: String(payload.planId) };
    return this.api.post<any>('/admin/subscriptions/users', body).pipe(map(resp => resp));
  }

  /**
   * Cria uma nova assinatura para toda uma organização (Enterprise).
   * POST /admin/subscriptions/organizations/{organizationId}
   * body: { planId: string }
   */
  createOrganizationSubscription(organizationId: string, payload: { planId: string }): Observable<any> {
    if (!organizationId || !payload || !payload.planId) return of(null);
    const body = { planId: String(payload.planId) };
    const path = `/admin/subscriptions/organizations/${encodeURIComponent(organizationId)}`;
    return this.api.post<any>(path, body).pipe(map(resp => resp));
  }

  /**
   * Cancela uma assinatura administrativa.
   * POST /admin/subscriptions/{subscriptionId}/cancel
   */
  cancelSubscription(subscriptionId: string): Observable<any> {
    if (!subscriptionId) return of(null);
    return this.api.post<any>(`/admin/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {}).pipe(map(resp => resp));
  }

  updateEbookProgress(trainingId: string, lastPageRead: number): Observable<void> {
    return this.api
      .put<void>(`/progress/ebooks/${encodeURIComponent(trainingId)}`, { lastPageRead })
      .pipe(map(() => void 0));
  }

  buildEbookFileUrl(fileName: string | null | undefined): string | null {
    if (!fileName) {
      return null;
    }
    return this.api.createUrl(`/admin/ebooks/${encodeURIComponent(fileName)}`);
  }

  /**
   * Verifica se há PDF disponível seguindo a mesma heurística robusta do legacy:
   * 1. Flags booleanas conhecidas (hasPdf, pdfUploaded, ebookFileUploaded, fileUploaded)
   * 2. Conjunto de chaves de caminho/URL que terminem em .pdf
   * 3. ebookDetails.filePath
   * 4. Busca rasa (profundidade 1) por qualquer string terminando em .pdf
   */
  trainingHasPdf(training: AdminTraining | Record<string, unknown> | null | undefined): boolean {
    return this.trainingPdfDebug(training).has;
  }

  /**
   * Método de diagnóstico que explica COMO o PDF foi (ou não) detectado.
   * Retorna a primeira correspondência encontrada para facilitar debug.
   * Utilize no console: adminService.trainingPdfDebug(obj)
   */
  trainingPdfDebug(training: AdminTraining | Record<string, unknown> | null | undefined): { has: boolean; matchedBy: string; key?: string; valueSample?: string; path?: string } {
    if (!training) return { has: false, matchedBy: 'no-training' };
    const visited = new Set<any>();
    const anyT = training as any;

    const looksLikePdf = (raw: unknown): raw is string => {
      if (typeof raw !== 'string') return false;
      const trimmed = raw.trim();
      // Normalização simples para casos com espaços finais ou parâmetros de query
      const base = trimmed.split('?')[0].trim().toLowerCase();
      if (base.endsWith('.pdf')) return true;
      // regex original (cobre casos com ?query)
      if (/\.pdf($|\?)/i.test(trimmed)) return true;
      return false;
    };

    // 1. Flags booleanas óbvias
    const booleanFlags = ['hasPdf','pdfUploaded','ebookFileUploaded','fileUploaded'];
    for (const flag of booleanFlags) {
      if (anyT && anyT[flag]) {
        return { has: true, matchedBy: 'boolean-flag', key: flag, valueSample: String(anyT[flag]) };
      }
    }

    // 2. ebookDetails prioritário
    const ed = anyT.ebookDetails;
    if (ed && typeof ed === 'object') {
      const edPaths = [ed.filePath, ed.file, ed.filepath, ed.pdfFilePath, ed.pdfPath, ed.url, ed.fileUrl, ed.name, ed.filename, ed.originalName];
      const match = edPaths.find(v => looksLikePdf(v));
      if (match) {
        return { has: true, matchedBy: 'ebookDetails', key: 'ebookDetails.*', valueSample: String(match) };
      }
    }

    // 3. Chaves diretas ampliadas
    const pathKeys = [
      'filePath','filepath','file','pdfPath','pdfFilePath','pdfFile',
      'ebookFile','ebookFilePath','ebookPath','ebookPdfPath',
      'ebookFileUrl','fileUrl','pdfUrl','pdf','ebookUrl',
      'ebook','document','documentPath','resourcePath','resourceUrl',
      'pdfFileName','ebookFileName','filename','name','originalName'
    ];
    for (const k of pathKeys) {
      const v = anyT[k];
      if (looksLikePdf(v)) {
        return { has: true, matchedBy: 'direct-key', key: k, valueSample: String(v) };
      }
    }

    // 4. Busca profunda (objetos + arrays) – BFS limitada por profundidade e número de nós
    interface QueueItem { value: any; depth: number; path: string; }
    const queue: QueueItem[] = [{ value: anyT, depth: 0, path: 'root' }];
    const MAX_DEPTH = 5;
    const MAX_NODES = 500; // protecção contra loops ou objetos gigantes
    let processed = 0;

    while (queue.length) {
      const current = queue.shift()!;
      const { value, depth, path } = current;
      if (!value || typeof value !== 'object') continue;
      if (visited.has(value)) continue;
      visited.add(value);
      processed++;
      if (processed > MAX_NODES) break;

      const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
      for (const [k, v] of entries) {
        if (looksLikePdf(v)) {
          return { has: true, matchedBy: 'deep-scan', key: k, valueSample: String(v), path: path + '.' + k };
        }
        // Alguns backends enviam objetos de arquivo { name: 'x.pdf', url: '...' }
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const nameLike = (v as any).name || (v as any).fileName || (v as any).filename || (v as any).originalName;
          const urlLike = (v as any).url || (v as any).fileUrl;
            if (looksLikePdf(nameLike)) {
              return { has: true, matchedBy: 'deep-file-object-name', key: k, valueSample: String(nameLike), path: path + '.' + k };
            }
            if (looksLikePdf(urlLike)) {
              return { has: true, matchedBy: 'deep-file-object-url', key: k, valueSample: String(urlLike), path: path + '.' + k };
            }
        }
        if (v && typeof v === 'object' && depth < MAX_DEPTH) {
          queue.push({ value: v, depth: depth + 1, path: path + '.' + k });
        }
      }
    }

    return { has: false, matchedBy: 'not-found' };
  }

  extractPdfFileName(training: AdminTraining | Record<string, unknown> | null | undefined): string {
    if (!training) {
      return '';
    }
    const looksLikePdf = (raw: unknown): raw is string => {
      if (typeof raw !== 'string') return false;
      const trimmed = raw.trim();
      const base = trimmed.split('?')[0].trim().toLowerCase();
      if (base.endsWith('.pdf')) return true;
      if (/\.pdf($|\?)/i.test(trimmed)) return true;
      return false;
    };
    const pathKeys = [
      'filePath',
      'filepath',
      'file',
      'pdfPath',
      'pdfFilePath',
      'pdfFile',
      'ebookFile',
      'ebookFilePath',
      'ebookPath',
      'ebookPdfPath',
      'ebookFileUrl',
      'fileUrl',
      'pdfUrl',
      'pdf',
      'ebookUrl'
    ];
    for (const key of pathKeys) {
      const value = (training as any)[key];
      if (looksLikePdf(value)) {
        try {
          return decodeURIComponent(value.split('/').pop()!.split('?')[0]);
        } catch {
          return value.split('/').pop() ?? '';
        }
      }
    }
    // fallback: ebookDetails
    const ed: any = (training as any).ebookDetails;
    if (ed && looksLikePdf(ed.filePath)) {
      try {
        return decodeURIComponent(ed.filePath.split('/').pop()!.split('?')[0]);
      } catch {
        return ed.filePath.split('/').pop() ?? '';
      }
    }
    return '';
  }

  extractPdfUpdatedDate(training: AdminTraining | Record<string, unknown> | null | undefined): Date | null {
    if (!training) {
      return null;
    }
    const dateKeys = [
      'pdfUpdatedAt',
      'fileUpdatedAt',
      'ebookUpdatedAt',
      'ebookFileUpdatedAt',
      'updatedAt',
      'lastUpdatedAt',
      'modifiedAt',
      'fileModifiedAt'
    ];
    for (const key of dateKeys) {
      const value = (training as any)[key];
      if (value && (typeof value === 'string' || typeof value === 'number')) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return null;
  }

  private normalizeTraining = (raw: AdminTraining | Record<string, unknown> | undefined): AdminTraining => {
    const source = raw ?? {};
    const id = this.normalizeId(source);
    // Spread source first to preserve other fields, then override id and normalized fields
    return {
      ...source,
      id,
      title: String((source as any).title ?? (source as any).name ?? 'Treinamento'),
      description: (source as any).description ?? null,
      author: (source as any).author ?? null,
      entityType: this.normalizeEntityType(((source as any).entityType ?? (source as any).format ?? (source as any).type) ?? null),
  publicationStatus: this.normalizePublicationStatus(source),
      coverImageUrl: (source as any).coverImageUrl ?? (source as any).imageUrl ?? null,
      organizationId: (source as any).organizationId ?? null,
      updatedAt: (source as any).updatedAt ?? null,
      // normalize modules: accept different shapes from backend
      modules: ((): any[] => {
        const m = (source as any).modules ?? (source as any).courseModules ?? (source as any).sections ?? (source as any).courseDetails?.modules ?? null;
        if (!m) return [];
        if (!Array.isArray(m)) return [];
        return m.map((mod: any) => ({
          id: String(mod.id ?? mod.moduleId ?? mod._id ?? ''),
          title: mod.title ?? mod.name ?? 'Módulo',
          moduleOrder: mod.moduleOrder ?? mod.order ?? null,
          lessons: ((): any[] => {
            const ls = mod.lessons ?? mod.items ?? mod.talks ?? null;
            if (!ls) return [];
            if (!Array.isArray(ls)) return [];
            return ls.map((l: any) => ({
              id: String(l.id ?? l.lessonId ?? l._id ?? ''),
              title: l.title ?? l.name ?? 'Aula',
              content: l.content ?? l.url ?? null,
              lessonOrder: l.lessonOrder ?? l.order ?? null
            }));
          })()
        }));
      })()
    } as AdminTraining;
  };

  private normalizePublicationStatus(source: any): string | null {
    if (!source || typeof source !== 'object') return null;
    const candidates = [
      source.publicationStatus,
      source.publication_status,
      source.publicationState,
      source.publication,
      source.status,
      source.state,
      source.pubStatus,
      source.publicado,
      source.publicacao
    ];
    for (const c of candidates) {
      if (c === undefined || c === null) continue;
      const s = String(c).trim();
      if (!s) continue;
      const up = s.toUpperCase();
      if (up === 'DRAFT' || up === 'RAScunho'.toUpperCase() || up === 'RASCUNHO') return 'DRAFT';
      if (up === 'PUBLISHED' || up === 'PUBLICADO' || up === 'PUBLICADO'.toUpperCase()) return 'PUBLISHED';
      // fallback: return normalized uppercase token
      return up;
    }
    return null;
  }

  // --- Monetização: Planos & Assinaturas ---
  /**
   * Cria um novo plano de assinatura.
   * Agora o payload espera preços numéricos e campo `type` (ex: INDIVIDUAL, ENTERPRISE).
   */
  createPlan(payload: { name: string; description: string; originalPrice: number; currentPrice: number; durationInDays: number; type?: string }): Observable<any> {
    // Sanitização mínima: trim e corte de descrição (máx 512 chars conforme requisito)
    const body: any = {
      name: (payload.name || '').trim(),
      description: (payload.description || '').trim().slice(0, 512),
      originalPrice: typeof payload.originalPrice === 'number' ? payload.originalPrice : Number(payload.originalPrice) || 0,
      currentPrice: typeof payload.currentPrice === 'number' ? payload.currentPrice : Number(payload.currentPrice) || 0,
      durationInDays: Number(payload.durationInDays) || 0
    };
    if (payload.type) body.type = String(payload.type).trim();
    return this.api.post<any>('/admin/plans', body);
  }

  /**
   * Atualiza um plano existente via PUT /admin/plans/{planId}
   * Aceita partial payloads; sanitiza nome/descrição e repassa preços como fornecidos.
   */
  updatePlan(planId: string, payload: {
    name?: string;
    description?: string;
    originalPrice?: any;
    currentPrice?: any;
    durationInDays?: number;
    isActive?: boolean;
    type?: string;
  }): Observable<any> {
    const body: Record<string, unknown> = {};
  if (payload['name'] !== undefined) body['name'] = String(payload['name']).trim();
  if (payload['description'] !== undefined) body['description'] = String(payload['description']).trim().slice(0, 512);
  if (payload['originalPrice'] !== undefined) body['originalPrice'] = payload['originalPrice'];
  if (payload['currentPrice'] !== undefined) body['currentPrice'] = payload['currentPrice'];
  if (payload['type'] !== undefined) body['type'] = String(payload['type']).trim();
  if (payload['durationInDays'] !== undefined) body['durationInDays'] = Number(payload['durationInDays']) || 0;
  if (payload['isActive'] !== undefined) body['isActive'] = !!payload['isActive'];

    return this.api.put<any>(`/admin/plans/${encodeURIComponent(planId)}`, body);
  }

  /**
   * Cria manualmente uma assinatura para um usuário.
   */
  createSubscription(payload: { userId: string; planId: string }): Observable<any> {
    const body = { userId: (payload.userId || '').trim(), planId: (payload.planId || '').trim() };
    return this.api.post<any>('/admin/subscriptions', body);
  }

  private normalizeSector = (raw: AdminSector | Record<string, unknown> | undefined): AdminSector => {
    const source = raw ?? {};
    const id = this.normalizeId(source);
    return {
      id,
      name: String((source as any).name ?? (source as any).title ?? (source as any).label ?? 'Setor'),
      ...source
    } as AdminSector;
  };

  private normalizeId(raw: Record<string, unknown>): string {
    const candidate = raw['id'] ?? (raw as any).uuid ?? (raw as any).code ?? (raw as any).slug ?? (raw as any).trainingId;
    if (candidate != null) {
      return String(candidate);
    }
    return `admin-${Math.random().toString(36).slice(2, 11)}`;
  }

  private unwrapList<T>(response: unknown): T[] {
    if (Array.isArray(response)) {
      return response as T[];
    }
    if (response && typeof response === 'object') {
      const collection = (response as any).items ?? (response as any).data ?? (response as any).content;
      if (Array.isArray(collection)) {
        return collection as T[];
      }
    }
    return [];
  }

  private normalizeUser(raw: any): any {
    if (!raw) return { id: '', email: '', enabled: false };
    const id = String(raw.id ?? raw.userId ?? raw._id ?? '');
    const email = String(raw.email ?? raw.userEmail ?? '');
    const role = raw.role ?? raw.systemRole ?? null;
    const enabled = raw.enabled === false ? false : true;
    return { id, email, role, enabled, ...raw };
  }

  private normalizeOrganization(raw: any): any {
    const src = raw || {};
    const id = String(src.id ?? src.orgId ?? src._id ?? '');
    const name = String(src.razaoSocial ?? src.companyName ?? src.name ?? src.title ?? '');
    const cnpj = src.cnpj ?? src.CNPJ ?? null;
    let enabled: boolean;
    if (src.enabled === true) enabled = true; else if (src.enabled === false) enabled = false; else if (typeof src.status === 'string') {
      const st = src.status.toLowerCase(); enabled = (st === 'active' || st === 'enabled' || st === 'true');
    } else if (typeof src.active === 'boolean') enabled = src.active; else if (typeof src.state === 'string') {
      const st = src.state.toLowerCase(); enabled = (st === 'active' || st === 'enabled');
    } else enabled = true;
    const memberCount = typeof src.memberCount === 'number' ? src.memberCount : (Array.isArray(src.members) ? src.members.length : undefined);
    return { id, name, cnpj, enabled, memberCount, ...src };
  }

  private searchPdfInNested(obj: Record<string, unknown> | AdminTraining, depth = 0): boolean {
    if (!obj || depth > 1) {
      return false;
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && /\.pdf($|\?)/i.test(value)) {
        return true;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (this.searchPdfInNested(value as Record<string, unknown>, depth + 1)) {
          return true;
        }
      }
    }
    return false;
  }
}
