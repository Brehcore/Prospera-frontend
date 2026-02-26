import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicationStatusPipe } from '../../core/pipes/publication-status.pipe';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { CatalogService } from '../../core/services/catalog.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminTraining, AdminSector } from '../../core/models/admin';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

interface AdminUserSummary {
  id: string;
  email: string;
  role?: string | null;
  enabled?: boolean;
  [key: string]: unknown;
}

interface AdminOrganizationSummary {
  id: string;
  name: string;
  cnpj?: string | null;
  memberCount?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, RouterModule, ReactiveFormsModule, PublicationStatusPipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  private readonly admin = inject(AdminService);
  private readonly catalogService = inject(CatalogService);
  private readonly subscription = inject(SubscriptionService);
  private readonly auth = inject(AuthService);

  // signals
  trainings = signal<AdminTraining[]>([]);
  trainingSearch = signal<string>('');
  trainingStatusFilter = signal<'all'|'published'|'draft'>('all');
  filteredTrainings = computed(() => {
    const term = this.trainingSearch().trim().toLowerCase();
    const status = this.trainingStatusFilter();
    return this.trainings().filter(t => {
      if (term) {
        const comp = `${t.title || ''} ${t.author || ''} ${t.id}`.toLowerCase();
        if (!comp.includes(term)) return false;
      }
      if (status === 'published' && (t.publicationStatus || '').toLowerCase() !== 'published') return false;
      if (status === 'draft' && (t.publicationStatus || '').toLowerCase() === 'published') return false;
      return true;
    });
  });
  selectedTrainingId = signal<string | null>(null);
  selectedTrainingDetails = signal<any | null>(null);
  uploadProgress = signal<number | null>(null);
  showCreateTraining = signal<boolean>(false);
  createTrainingLoading = signal<boolean>(false);
  createTrainingError = signal<string | null>(null);
  createTrainingForm = signal<{title:string; description:string; author:string; entityType:string; organizationId:string | null}>({ title:'', description:'', author:'', entityType:'EBOOK', organizationId: null });
  openActionMenuId = signal<string | null>(null);
  sectors = signal<AdminSector[]>([]);
  newSectorName = signal<string>('');
  creatingSector = signal<boolean>(false);
  sectorError = signal<string | null>(null);
  deletingSectorId = signal<string | null>(null);
  removingTrainingSectorId = signal<string | null>(null);
  users = signal<AdminUserSummary[]>([]);
  selectedUserId = signal<string | null>(null);
  selectedUserDetails = signal<any | null>(null);
  filteredUsers = computed(() => {
    const list = this.users();
    const term = this.userSearch().trim().toLowerCase();
    const status = this.userStatusFilter();
    const role = this.userRoleFilter();
    return list.filter(u => {
      if (term && !u.email.toLowerCase().includes(term)) return false;
      if (status === 'active' && u.enabled === false) return false;
      if (status === 'inactive' && u.enabled !== false) return false;
      if (role !== 'all' && role && (u.role || '').toUpperCase() !== role.toUpperCase()) return false;
      return true;
    });
  });

  // filtros (signals simples)
  userSearch = signal<string>('');
  userStatusFilter = signal<'all'|'active'|'inactive'>('all');
  userRoleFilter = signal<string>('all');
  organizations = signal<AdminOrganizationSummary[]>([]);
  orgSearch = signal<string>('');
  orgStatusFilter = signal<'all'|'active'|'inactive'>('all');
  filteredOrganizations = computed(() => {
    const term = this.orgSearch().trim().toLowerCase();
    const status = this.orgStatusFilter();
    return this.organizations().filter(o => {
      if (status === 'active' && o.enabled === false) return false;
      if (status === 'inactive' && o.enabled !== false) return false;
      if (term) {
        const composite = `${o.name || ''} ${o.cnpj || ''} ${o.id}`.toLowerCase();
        if (!composite.includes(term)) return false;
      }
      return true;
    });
  });
  selectedOrgId = signal<string | null>(null);
  selectedOrgDetails = signal<any | null>(null);
  loading = signal<{[key:string]: boolean}>({});
  error = signal<{[key:string]: string | null}>({});
  activeCard = signal<string | null>(null);
  // --- Monetização (Planos & Assinaturas) ---
  monetizationPlanForm = signal<{name:string; description:string; originalPrice:string; currentPrice:string; durationInDays:number; type?: string}>({ name:'', description:'', originalPrice:'', currentPrice:'', durationInDays:30, type: 'INDIVIDUAL' });
  monetizationSubscriptionForm = signal<{userId:string; planId:string}>({ userId:'', planId:'' });
  // tipo do modal de criação de assinatura: 'PERSONAL' | 'ORGANIZATION'
  subscriptionType = signal<'PERSONAL'|'ORGANIZATION'>('PERSONAL');
  creatingPlan = signal<boolean>(false);
  creatingSubscription = signal<boolean>(false);
  monetizationMessage = signal<string | null>(null);
  monetizationError = signal<string | null>(null);
  // Sinais dedicados para mensagens de assinatura (separados de planos)
  subscriptionSuccessMessage = signal<string | null>(null);
  subscriptionErrorMessage = signal<string | null>(null);
  // dropdown helper signals
  loadingSubscriptionDropdowns = signal<boolean>(false);
  // Subscriptions listing (admin)
  subscriptions = signal<any[]>([]);
  subscriptionFilterOrigin = signal<string>(''); // '' | 'MANUAL' | other
  subscriptionFilterStatus = signal<string>(''); // '' | 'ACTIVE' | 'EXPIRED' | other
  loadingSubscriptions = signal<boolean>(false);
  subscriptionsError = signal<string | null>(null);
  // edit flow signals
  editingPlanId = signal<string | null>(null);
  showEditPlan = signal<boolean>(false);
  editingPlanForm = signal<{name:string; description:string; originalPrice:string; currentPrice:string; durationInDays:number; isActive?:boolean; type?: string}>({ name:'', description:'', originalPrice:'', currentPrice:'', durationInDays:30, isActive: true, type: 'INDIVIDUAL' });
  // simples memória local de planos criados nesta sessão (até termos GET /admin/plans)
  createdPlans = signal<any[]>([]);
  // aba selecionada na listagem de planos criados
  selectedCreatedPlanIndex = signal<number>(0);
  // planos disponíveis vindos do endpoint (GET /subscription/plans)
  subscriptionPlans = signal<any[]>([]);
  // planos filtrados conforme tipo selecionado no modal
  filteredSubscriptionPlans = computed(() => {
    const type = this.subscriptionType();
    const list = this.subscriptionPlans() || [];
    if (!type) return list;
    if (type === 'PERSONAL') {
      return list.filter(p => (String(p?.type || p?.format || '').toUpperCase() === 'INDIVIDUAL') || (p?.isIndividual === true));
    }
    return list.filter(p => (String(p?.type || p?.format || '').toUpperCase() === 'ENTERPRISE') || (p?.isEnterprise === true));
  });
  // modal control para criação de planos
  showCreatePlan = signal<boolean>(false);
  // modal control for creating manual subscription
  showCreateSubscription = signal<boolean>(false);
  subscriptionModalTab = signal<'create' | 'login'>('create');

  updatePlanField<K extends keyof ReturnType<typeof this.monetizationPlanForm>>(key: K, value: any) {
    this.monetizationPlanForm.update(f => ({ ...f, [key]: key==='durationInDays' ? Number(value)||0 : value }));
  }
  updateSubscriptionField<K extends keyof ReturnType<typeof this.monetizationSubscriptionForm>>(key: K, value: any) {
    this.monetizationSubscriptionForm.update(f => ({ ...f, [key]: value }));
  }
  submitCreatePlan() {
    const form = this.monetizationPlanForm();
    if (!form.name.trim()) { this.monetizationError.set('Nome do plano é obrigatório.'); return; }
    if (!form.originalPrice.trim() || !form.currentPrice.trim()) { this.monetizationError.set('Preços original e atual são obrigatórios.'); return; }
    if (!String(form.description || '').trim()) { this.monetizationError.set('Descrição do plano é obrigatória.'); return; }
    this.creatingPlan.set(true); this.monetizationError.set(null); this.monetizationMessage.set(null);
    this.admin.createPlan({
      name: form.name.trim(),
      description: form.description.trim(),
      originalPrice: Number(String(form.originalPrice).replace(',', '.')) || 0,
      currentPrice: Number(String(form.currentPrice).replace(',', '.')) || 0,
      durationInDays: form.durationInDays||0,
      type: form.type ? String(form.type).trim().toUpperCase() : undefined
    } as any).subscribe({
      next: created => {
        this.monetizationMessage.set('Plano criado com sucesso.');
        this.createdPlans.update(list => [created, ...list]);
        // Atualiza também a lista de planos disponíveis no contexto admin para refletir imediatamente a criação
        this.subscriptionPlans.update(list => [created, ...list]);
        // Notifica consumidores que os planos foram atualizados para que a lista pública recarregue
        try { this.catalogService.notifyPlansUpdated(); } catch (e) { /* no-op */ }
        // seleciona o plano recém-criado (o primeiro da lista)
        this.selectedCreatedPlanIndex.set(0);
        // mantém valores de preço para facilitar criação em série, limpa nome/desc
        this.monetizationPlanForm.update(f => ({ ...f, name:'', description:'' }));
      },
      error: err => { this.monetizationError.set(this.formatServerError(err) || 'Falha ao criar plano'); this.creatingPlan.set(false); },
      complete: () => this.creatingPlan.set(false)
    });
  }
  submitCreateSubscription() {
    const form = this.monetizationSubscriptionForm();
    const type = this.subscriptionType();
    // basic validation conforme tipo
    if (type === 'PERSONAL') {
      if (!form.userId.trim() || !form.planId.trim()) { this.monetizationError.set('User ID e Plan ID são obrigatórios para criar assinatura pessoal.'); return; }
    } else {
      if (!this.selectedOrgId() || !form.planId.trim()) { this.monetizationError.set('Conta Cliente e Plan ID são obrigatórios para criar assinatura para empresa.'); return; }
    }
    this.creatingSubscription.set(true); 
    this.monetizationError.set(null); 
    // NÃO limpar a mensagem aqui, pois será usada no sucesso

    if (type === 'PERSONAL') {
      this.subscription.createPersonalSubscription(form.userId.trim(), form.planId.trim()).subscribe({
        next: created => this.onCreateSubscriptionSuccess(),
        error: err => this.handleCreateSubscriptionError(err),
        complete: () => this.creatingSubscription.set(false)
      });
      return;
    }

    // ORGANIZATION
    this.subscription.createOrganizationSubscription(this.selectedOrgId() || '', form.planId.trim()).subscribe({
      next: created => this.onCreateSubscriptionSuccess(),
      error: err => this.handleCreateSubscriptionError(err),
      complete: () => this.creatingSubscription.set(false)
    });
  }

  private onCreateSubscriptionSuccess() {
    // Define a mensagem de sucesso usando o sinal dedicado para assinatura
    this.subscriptionSuccessMessage.set('Assinatura efetivada com sucesso.');
    this.monetizationSubscriptionForm.set({ userId: '', planId: '' });
    // Não faz mais transição automática - deixa o usuário clicar
  }

  private handleCreateSubscriptionError(err: any) {
    const serverMsg = err?.error?.message || err?.error || err?.message || '';
    const text = String(serverMsg || '').trim();
    this.subscriptionErrorMessage.set(text || 'Falha ao criar assinatura');
    this.creatingSubscription.set(false);
  }

  openCreateSubscription() {
    this.monetizationSubscriptionForm.set({ userId: '', planId: '' });
    this.monetizationError.set(null);
    // reset para default PESSOAL
    this.subscriptionType.set('PERSONAL');
    // ensure we have users, plans and organizations for the selects
    const reqs: { [key: string]: import('rxjs').Observable<any> } = {};
  if (this.users().length === 0) reqs['users'] = this.admin.getUsers();
  if (this.subscriptionPlans().length === 0) reqs['plans'] = this.admin.getSubscriptionPlans();
  if (this.organizations().length === 0) reqs['orgs'] = this.admin.getOrganizations();

    if (Object.keys(reqs).length) {
      this.loadingSubscriptionDropdowns.set(true);
      // forkJoin will emit an object with the same keys containing the responses
      forkJoin(reqs).subscribe({
        next: res => {
          if (res['users'] !== undefined) {
            const u = res['users'];
            this.users.set(Array.isArray(u) ? u.map(x => this.normalizeUser(x)) : this.unwrapList(u).map(x => this.normalizeUser(x)));
          }
          if (res['plans'] !== undefined) {
            const p = res['plans'];
            this.subscriptionPlans.set(Array.isArray(p) ? p : this.unwrapList(p));
          }
          if (res['orgs'] !== undefined) {
            const o = res['orgs'];
            this.organizations.set(Array.isArray(o) ? o.map(x => this.normalizeOrganization(x)) : this.unwrapList(o).map(x => this.normalizeOrganization(x)));
          }
        },
        error: () => {
          // best-effort: ignore errors here and let individual parts remain empty
        },
        complete: () => this.loadingSubscriptionDropdowns.set(false)
      });
    }
    this.showCreateSubscription.set(true);
    this.subscriptionModalTab.set('create'); // Sempre abre na aba de criação
  }
  closeCreateSubscription() { 
    this.showCreateSubscription.set(false); 
    this.subscriptionModalTab.set('create'); // Reseta para aba de criação ao fechar
    this.subscriptionSuccessMessage.set(null); // Limpa mensagem de sucesso de assinatura
    this.subscriptionErrorMessage.set(null); // Limpa mensagens de erro de assinatura
  }

  setEditingPlanField<K extends keyof ReturnType<typeof this.editingPlanForm>>(key: K, value: any) {
    this.editingPlanForm.update(f => ({ ...f, [key]: key === 'durationInDays' ? Number(value) || 0 : value } as any));
  }

  openCreatePlan() {
    // mantém preços preenchidos para criação em série; limpa nome/descrição ao abrir
    this.monetizationPlanForm.update(f => ({ ...f, name:'', description:'' }));
    this.monetizationError.set(null);
    this.showCreatePlan.set(true);
  }
  closeCreatePlan() { this.showCreatePlan.set(false); }
  openEditPlan(plan: any) {
    if (!plan || !plan.id) return;
    // populate edit form from plan (coerce types to strings where UI expects)
    this.editingPlanId.set(plan.id);
    this.editingPlanForm.set({
      name: plan.name || '',
      description: plan.description || '',
      originalPrice: plan.originalPrice || '',
      currentPrice: plan.currentPrice || '',
      durationInDays: Number(plan.durationInDays) || 0,
      isActive: plan.isActive === undefined ? true : !!plan.isActive
    });
    this.monetizationError.set(null);
    this.showEditPlan.set(true);
  }
  closeEditPlan() {
    this.showEditPlan.set(false);
    this.editingPlanId.set(null);
  }
  submitEditPlan() {
    const id = this.editingPlanId();
    if (!id) return;
    const form = this.editingPlanForm();
    if (!form.name.trim()) { this.monetizationError.set('Nome do plano é obrigatório.'); return; }
    this.monetizationError.set(null); this.monetizationMessage.set(null);
    this.setLoading('updatePlan', true);
    this.admin.updatePlan(id, {
      name: String(form.name ?? '').trim(),
      description: String(form.description ?? '').trim(),
      originalPrice: Number(String(form.originalPrice ?? '').replace(',', '.')) || 0,
      currentPrice: Number(String(form.currentPrice ?? '').replace(',', '.')) || 0,
      durationInDays: Number(form.durationInDays) || 0,
      isActive: !!form.isActive,
      type: form.type ? String(form.type).trim().toUpperCase() : undefined
    } as any).subscribe({
      next: updated => {
        // update local list if present
        this.subscriptionPlans.update(list => list.map(p => p && String(p.id) === String(id) ? ({ ...p, ...updated }) : p));
        this.monetizationMessage.set('Plano atualizado com sucesso.');
        this.closeEditPlan();
      },
      error: err => this.monetizationError.set(this.formatServerError(err) || 'Falha ao atualizar plano'),
      complete: () => this.setLoading('updatePlan', false)
    });
  }

  // Formata erros vindos do servidor, incluindo objetos de validação (422)
  private formatServerError(err: any): string {
    try {
      // Caso padrão: objeto com campo error e array validationErros
      const body = err?.error ?? err;
      if (err?.status === 422 && Array.isArray(body?.validationErros)) {
        const parts = body.validationErros.map((v: any) => {
          const field = v?.field ? `${v.field}` : null;
          const msg = v?.message || v?.defaultMessage || '';
          return field ? `${field}: ${msg}` : `${msg}`;
        });
        return parts.join('; ');
      }
      // Mensagem simples do servidor
      const serverMsg = body?.message || body?.error || err?.message;
      return serverMsg ? String(serverMsg) : '';
    } catch (e) {
      return '';
    }
  }
  discountPercent(plan: any): number | null {
    const op = parseFloat(plan?.originalPrice);
    const cp = parseFloat(plan?.currentPrice);
    if (isFinite(op) && isFinite(cp) && op > 0 && cp < op) {
      return Math.round(((op - cp) / op) * 100);
    }
    return null;
  }

  isSystemAdmin = computed(() => this.auth.hasRole('SYSTEM_ADMIN'));

  constructor() {
    // load initial lightweight data (setores e treinamentos) eagerly
    effect(() => {
      if (this.isSystemAdmin()) {
        this.loadSectors();
        this.loadTrainings();
      }
    });
  }

  // Wrappers para funções de PDF do serviço (mantém template simples)
  trainingHasPdf(t: any) { return this.admin.trainingHasPdf(t); }
  extractPdfFileName(t: any) { return this.admin.extractPdfFileName(t); }
  buildEbookFileUrl(fileName: string | null = null, trainingId?: string) { return this.admin.buildEbookFileUrl(fileName, trainingId); }
  // Debug simplificado: retorna string explicando a detecção de PDF (ou ausência)
  pdfDebugInfo(t: any): string {
    const dbg = this.admin.trainingPdfDebug(t);
    if (!dbg.has) return 'Nenhum PDF enviado';
    // Nome do arquivo
    let fileName = this.extractPdfFileName(t);
    if (!fileName && t?.ebookDetails?.filePath) {
      try { fileName = decodeURIComponent(String(t.ebookDetails.filePath).split('/').pop()!); } catch { fileName = String(t.ebookDetails.filePath); }
    }
    const pages = t?.ebookDetails?.totalPages;
    const uploadedRaw = t?.ebookDetails?.fileUploadedAt || t?.ebookDetails?.uploadedAt || t?.ebookDetails?.createdAt;
    let uploadedPart = '';
    if (uploadedRaw) {
      const d = new Date(uploadedRaw);
      if (!isNaN(d.getTime())) {
        uploadedPart = 'enviado em ' + d.toLocaleDateString('pt-BR');
      }
    }
    const parts: string[] = [];
    parts.push(fileName ? `PDF disponível: ${fileName}` : 'PDF disponível');
    if (pages) parts.push(`${pages} pág${pages > 1 ? 's' : ''}`);
    if (uploadedPart) parts.push(uploadedPart);
    return parts.join(' • ');
  }
  // Atalho para logar no console (chamado pelo botão debug)
  logPdfDebug(t: any) { console.log('PDF DEBUG', t.id, this.admin.trainingPdfDebug(t)); }

  toggleCard(key: string) {
    this.activeCard.update(curr => curr === key ? null : key);
    // Lazy fetch by card
    if (this.activeCard() === key) {
  if (key === 'users' && this.users().length === 0) this.loadUsers();
      if (key === 'organizations' && this.organizations().length === 0) this.loadOrganizations();
      if (key === 'content' && this.trainings().length === 0) this.loadTrainings();
  if (key === 'platform' && this.sectors().length === 0) this.loadSectors();
      // (monetization) no fetch inicial porque depende apenas de POSTs por enquanto
      if (key === 'monetization') {
        // carregar planos do endpoint se ainda não carregados
        if (!this.subscriptionPlans().length) this.loadSubscriptionPlans();
        // carregar a listagem de assinaturas automaticamente ao abrir Monetização
        // (evita depender do botão 'Atualizar') — respeita filtros atuais
        if (!this.subscriptions().length) {
          try {
            this.loadSubscriptions({ origin: this.subscriptionFilterOrigin() || undefined, status: this.subscriptionFilterStatus() || undefined });
          } catch (e) {
            // no-op: loadSubscriptions já trata erros internamente
          }
        }
      }
    }
  }

  /** Retorna o rótulo legível para o tipo do plano */
  planTypeLabel(type?: string | null): string {
    const t = String(type || '').toUpperCase();
    if (!t) return '—';
    switch (t) {
      case 'ENTERPRISE':
      case 'EMPRESARIAL':
        return 'Empresarial';
      case 'INDIVIDUAL':
      case 'PERSONAL':
      case 'INDIVIDUALO':
        return 'Individual';
      default:
        return (t.charAt(0) + t.slice(1).toLowerCase()) || t;
    }
  }

  /** Evita exibir 'Global' como nome do plano quando o backend usa placeholders; prefere mostrar o nome real ou 'Empresarial/Individual' quando fizer sentido */
  displayPlanName(plan: any): string {
    if (!plan) return '—';
    const name = String(plan.name || plan.title || '').trim();
    // se o nome for 'Global' ou vazio, tenta inferir a partir do tipo
    if (!name || name.toLowerCase() === 'global') {
      const tLabel = this.planTypeLabel(plan.type || plan?.planType || plan?.format);
      return tLabel === '—' ? (name || '—') : tLabel;
    }
    return name;
  }

  loadSubscriptionPlans() {
    if (!this.isSystemAdmin()) return;
    this.setLoading('subscriptionPlans', true); this.setError('subscriptionPlans', null);
    this.admin.getSubscriptionPlans().subscribe({
      next: list => this.subscriptionPlans.set(list || []),
      error: err => this.setError('subscriptionPlans', err?.message || 'Falha ao carregar planos'),
      complete: () => this.setLoading('subscriptionPlans', false)
    });
  }

  loadSubscriptions(filters?: { origin?: string; status?: string }) {
    if (!this.isSystemAdmin()) return;
    this.loadingSubscriptions.set(true); this.subscriptionsError.set(null);
    this.admin.getSubscriptions(filters).subscribe({
      next: list => {
        const arr = list || [];
        this.subscriptions.set(arr);
        // Se não temos a lista de users carregada e as assinaturas trazem userId, prefetch users
        try {
          const hasUserIds = arr.some((s: any) => !!(s.userId || s.user?.id || s.customerId));
          if (hasUserIds && this.users().length === 0) {
            this.loadUsers();
          }
        } catch (e) {
          // silently ignore
        }
      },
      error: err => this.subscriptionsError.set(err?.message || 'Falha ao carregar assinaturas'),
      complete: () => this.loadingSubscriptions.set(false)
    });
  }

  // control id currently being canceled
  cancelingSubscriptionId = signal<string | null>(null);

  // subscription details modal
  selectedSubscription = signal<any | null>(null);
  showSubscriptionDetails = signal<boolean>(false);

  openSubscriptionDetails(s: any) {
    if (!s) return;
    this.selectedSubscription.set(s);
    this.showSubscriptionDetails.set(true);
  }

  closeSubscriptionDetails() {
    this.showSubscriptionDetails.set(false);
    this.selectedSubscription.set(null);
  }

  cancelSubscriptionAction(s: any) {
    if (!s || !s.id) return;
    const id = s.id;
    // guarda: se já estiver cancelado, não tenta novamente
    const status = (s.status || s.status?.toString() || '').toUpperCase();
    if (status === 'CANCELED' || status === 'CANCELLED') {
      this.monetizationMessage.set('Esta assinatura já está cancelada.');
      return;
    }
    if (!confirm(`Cancelar assinatura ${id}? Esta ação pode ser irreversível.`)) return;
    this.cancelingSubscriptionId.set(id);
    this.admin.cancelSubscription(id).subscribe({
      next: resp => {
        // best-effort: atualizar status localmente para 'CANCELED' ou remover da lista
        this.subscriptions.update(list => list.map((x: any) => x && String(x.id) === String(id) ? ({ ...x, status: 'CANCELED' }) : x));
        this.monetizationMessage.set('Assinatura cancelada.');
      },
      error: err => this.subscriptionsError.set(err?.message || 'Falha ao cancelar assinatura'),
      complete: () => this.cancelingSubscriptionId.set(null)
    });
  }

  private setLoading(scope: string, value: boolean) {
    this.loading.update(l => ({ ...l, [scope]: value }));
  }
  private setError(scope: string, value: string | null) {
    this.error.update(e => ({ ...e, [scope]: value }));
  }

  loadTrainings() {
    if (!this.isSystemAdmin()) return;
    this.setLoading('trainings', true); this.setError('trainings', null);
    this.admin.getTrainings().subscribe({
      next: list => {
        this.trainings.set(list);
        // Prefetch detalhes para EBOOKs que não detectaram PDF (lista resumida sem ebookDetails)
        this.prefetchPdfInfo(list);
      },
      error: err => this.setError('trainings', err?.message || 'Falha ao carregar treinamentos'),
      complete: () => this.setLoading('trainings', false)
    });
  }

  viewTrainingDetails(t: AdminTraining) {
    if (!t?.id) return; this.selectedTrainingId.set(t.id); this.selectedTrainingDetails.set(null);
    this.setLoading('trainingDetails', true); this.setError('trainingDetails', null);
    this.admin.getTrainingById(t.id).subscribe({
      next: detail => this.selectedTrainingDetails.set(detail),
      error: err => this.setError('trainingDetails', err?.message || 'Falha ao carregar detalhe'),
      complete: () => this.setLoading('trainingDetails', false)
    });
  }

  closeTrainingDetails() { this.selectedTrainingId.set(null); this.selectedTrainingDetails.set(null); }

  publishTraining(t: AdminTraining) {
    if (!t?.id) return; if (!confirm(`Publicar treinamento '${t.title}'?`)) return;
    this.setLoading('publishTraining', true); this.setError('publishTraining', null);
    this.admin.publishTraining(t.id).subscribe({
      next: () => {
        this.trainings.update(list => list.map(x => x.id === t.id ? { ...x, publicationStatus: 'PUBLISHED' } : x));
        if (this.selectedTrainingId() === t.id && this.selectedTrainingDetails()) {
          this.selectedTrainingDetails.update(d => d ? { ...d, publicationStatus: 'PUBLISHED' } : d);
        }
        if (this.openActionMenuId() === t.id) this.openActionMenuId.set(null);
      },
      error: err => this.setError('publishTraining', err?.message || 'Falha ao publicar'),
      complete: () => this.setLoading('publishTraining', false)
    });
  }

  uploadEbook(t: AdminTraining, file: File) {
    if (!t?.id || !file) return;
    this.uploadProgress.set(0); this.setLoading('ebookUpload', true); this.setError('ebookUpload', null);
    this.admin.uploadEbookFileWithProgress(t.id, file).subscribe({
      next: ev => {
        if (ev.type === 'progress') this.uploadProgress.set(ev.progress ?? 0);
        if (ev.type === 'response') {
          this.uploadProgress.set(100);
          // marca localmente que tem PDF
          this.trainings.update(list => list.map(x => x.id === t.id ? { ...x, ebookFileUploaded: true } : x));
        }
      },
      error: err => { this.setError('ebookUpload', err?.message || 'Falha no upload'); this.setLoading('ebookUpload', false); this.uploadProgress.set(null); },
      complete: () => { this.setLoading('ebookUpload', false); setTimeout(() => this.uploadProgress.set(null), 1200); }
    });
  }

  uploadCover(t: AdminTraining, file: File) {
    if (!t?.id || !file) return;
    this.setLoading('coverUpload', true); this.setError('coverUpload', null); this.uploadProgress.set(0);
    this.admin.uploadTrainingCoverImage(t.id, file).subscribe({
      next: ev => { if (ev.type === 'progress') this.uploadProgress.set(ev.progress ?? 0); },
      error: err => { this.setError('coverUpload', err?.message || 'Falha no upload da capa'); this.setLoading('coverUpload', false); this.uploadProgress.set(null); },
      complete: () => { this.setLoading('coverUpload', false); setTimeout(() => this.uploadProgress.set(null), 1000); }
    });
  }

  clearTrainingFilters() { this.trainingSearch.set(''); this.trainingStatusFilter.set('all'); }

  openCreateTraining() {
    this.createTrainingForm.set({ title:'', description:'', author:'', entityType:'EBOOK', organizationId: null });
    this.createTrainingError.set(null);
    this.showCreateTraining.set(true);
  }
  closeCreateTraining() { this.showCreateTraining.set(false); }
  updateCreateField<K extends keyof ReturnType<typeof this.createTrainingForm>> (key: K, value: any) {
    this.createTrainingForm.update(f => ({ ...f, [key]: value }));
  }
  submitCreateTraining() {
    const form = this.createTrainingForm();
    if (!form.title.trim() || !form.entityType) { this.createTrainingError.set('Título e tipo são obrigatórios.'); return; }
    this.createTrainingLoading.set(true); this.createTrainingError.set(null);
    const payload: any = {
      title: form.title.trim(),
      entityType: this.normalizeEntityType(String(form.entityType)),
      description: form.description?.trim() || null,
      author: form.author?.trim() || null,
      organizationId: form.organizationId || null
    };
    this.admin.createTraining(payload).subscribe({
      next: created => {
        this.showCreateTraining.set(false);
        // otimista: insere na lista
        this.trainings.update(list => [created, ...list]);
      },
      error: err => this.createTrainingError.set(err?.message || 'Falha ao criar treinamento'),
      complete: () => this.createTrainingLoading.set(false)
    });
  }

  /**
   * Normaliza variantes de tipo de entidade vindas do UI/inputs externos para os enums
   * esperados pelo backend. Evita valores como 'COURSE' ou 'LIVE_COURSE' que podem causar
   * exceções de enum no servidor.
   */
  private normalizeEntityType(value: string | null | undefined): string | null {
    if (!value) return null;
    const v = String(value).trim().toUpperCase();
    if (!v) return null;
    // mapeamentos defensivos para variantes conhecidas
    if (v === 'COURSE' || v === 'RECORDED' || v === 'RECORDED_COURSE' || v.includes('RECOR')) return 'RECORDED_COURSE';
    if (v === 'LIVE_COURSE' || v === 'LIVE_TRAINING' || v.includes('LIVE') || v.includes('AO_VIVO')) return 'LIVE_TRAINING';
    if (v === 'EBOOK' || v.includes('EBOOK')) return 'EBOOK';
    if (v === 'PACKAGE' || v.includes('PACKAGE')) return 'PACKAGE';
    // fallback: retorna input original (caller should validate) — but uppercase for consistency
    return v;
  }

  // --- Ações menu popover ---
  toggleTrainingActionsMenu(id: string, ev?: Event) {
    ev?.stopPropagation();
    this.openActionMenuId.update(curr => curr === id ? null : id);
  }
  closeTrainingActionsMenu() { this.openActionMenuId.set(null); }

  loadSectors() {
    if (!this.isSystemAdmin()) return;
    this.setLoading('sectors', true); this.setError('sectors', null);
    this.admin.getSectors().subscribe({
      next: list => this.sectors.set(list),
      error: err => this.setError('sectors', err?.message || 'Falha ao carregar setores'),
      complete: () => this.setLoading('sectors', false)
    });
  }

  createSector() {
    const name = this.newSectorName().trim();
    if (!name) { this.sectorError.set('Nome é obrigatório.'); return; }
    this.creatingSector.set(true); this.sectorError.set(null);
    this.admin.createSector(name).subscribe({
      next: created => {
        this.sectors.update(list => [...list, created]);
        this.newSectorName.set('');
      },
      error: err => this.sectorError.set(err?.message || 'Falha ao criar setor'),
      complete: () => this.creatingSector.set(false)
    });
  }

  deleteSector(sector: AdminSector) {
    if (!sector?.id) return;
    if (!confirm(`Excluir setor '${sector.name}'? Esta ação não poderá ser desfeita.`)) return;
    this.deletingSectorId.set(sector.id);
    this.admin.deleteSector(sector.id).subscribe({
      next: () => this.sectors.update(list => list.filter(s => s.id !== sector.id)),
      error: err => alert(err?.message || 'Falha ao excluir setor'),
      complete: () => this.deletingSectorId.set(null)
    });
  }

  loadUsers() {
    if (!this.isSystemAdmin()) return;
    this.setLoading('users', true); this.setError('users', null);
    this.admin.getUsers().subscribe({
      next: list => this.users.set(list as any),
      error: err => this.setError('users', err?.message || 'Falha ao carregar usuários'),
      complete: () => this.setLoading('users', false)
    });
  }

  toggleUserEnabled(user: AdminUserSummary) {
    const target = !user.enabled;
    this.loading.update(l => ({ ...l, userToggle: true }));
    this.admin.updateUserEnabled(user.id, target).subscribe({
      next: () => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, enabled: target } : u));
      },
      error: err => {
        this.setError('users', err?.message || 'Falha ao atualizar usuário');
      },
      complete: () => this.loading.update(l => ({ ...l, userToggle: false }))
    });
  }

  viewUserDetails(user: AdminUserSummary) {
    if (!user?.id) return;
    this.selectedUserId.set(user.id);
    this.selectedUserDetails.set(null);
    this.setLoading('userDetails', true); this.setError('userDetails', null);
    this.admin.getUserById(user.id).subscribe({
      next: detail => this.selectedUserDetails.set(detail),
      error: err => this.setError('userDetails', err?.message || 'Falha ao carregar detalhes'),
      complete: () => this.setLoading('userDetails', false)
    });
  }

  closeUserDetails() {
    this.selectedUserId.set(null);
    this.selectedUserDetails.set(null);
  }

  clearUserFilters() {
    this.userSearch.set('');
    this.userStatusFilter.set('all');
    this.userRoleFilter.set('all');
  }

  loadOrganizations() {
    if (!this.isSystemAdmin()) return;
    this.setLoading('organizations', true); this.setError('organizations', null);
    this.admin.getOrganizations().subscribe({
      next: list => this.organizations.set(list as any),
      error: err => this.setError('organizations', err?.message || 'Falha ao carregar organizações'),
      complete: () => this.setLoading('organizations', false)
    });
  }

  toggleOrganizationEnabled(org: AdminOrganizationSummary) {
    const target = !org.enabled;
    // Confirmação similar ao legacy (mensagem contextual)
    const orgName = org.name || org.id;
    const confirmMsg = target
      ? `Ativar organização '${orgName}'?`
      : `Você tem certeza que deseja INATIVAR a organização '${orgName}'? Todos os membros perderão acesso.`;
    if (!(window as any).showConfirmModal) {
      if (!confirm(confirmMsg)) return;
    } else {
      // se existir showConfirmModal assíncrono
      const proceed = (window as any).showConfirmModal(confirmMsg);
      if (proceed && typeof (proceed as Promise<boolean>).then === 'function') {
        (proceed as Promise<boolean>).then(ok => { if (ok) this.toggleOrganizationEnabled(org); });
        return;
      }
    }
    this.loading.update(l => ({ ...l, orgToggle: true }));
    this.admin.updateOrganizationEnabled(org.id, target).subscribe({
      next: () => {
        this.organizations.update(list => list.map(o => o.id === org.id ? { ...o, enabled: target } : o));
        if (this.selectedOrgId() === org.id && this.selectedOrgDetails()) {
          this.selectedOrgDetails.update(d => d ? { ...d, enabled: target } : d);
        }
      },
      error: err => this.setError('organizations', err?.message || 'Falha ao atualizar organização'),
      complete: () => this.loading.update(l => ({ ...l, orgToggle: false }))
    });
  }

  viewOrganizationDetails(org: AdminOrganizationSummary) {
    if (!org?.id) return; this.selectedOrgId.set(org.id); this.selectedOrgDetails.set(null);
    this.setLoading('orgDetails', true); this.setError('orgDetails', null);
    this.admin.getOrganizationById(org.id).subscribe({
      next: detail => this.selectedOrgDetails.set(detail),
      error: err => this.setError('orgDetails', err?.message || 'Falha ao carregar detalhe'),
      complete: () => this.setLoading('orgDetails', false)
    });
  }

  closeOrganizationDetails() { this.selectedOrgId.set(null); this.selectedOrgDetails.set(null); }

  clearOrgFilters() { this.orgSearch.set(''); this.orgStatusFilter.set('all'); }

  // --- Normalizers (replicam heurísticas do legacy) ---
  private unwrapList(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (response && typeof response === 'object') {
      const c = response.items ?? response.data ?? response.content ?? response.users ?? response.results;
      if (Array.isArray(c)) return c;
      if (response.data && Array.isArray(response.data.items)) return response.data.items;
    }
    return [];
  }

  private normalizeUser(raw: any): AdminUserSummary {
    const id = String(raw.id ?? raw.userId ?? raw._id ?? '');
    const email = String(raw.email ?? raw.userEmail ?? '');
    const role = raw.role ?? raw.systemRole ?? null;
    const enabled = raw.enabled === false ? false : true;
    return { id, email, role, enabled, ...raw };
  }

  private normalizeOrganization(raw: any): AdminOrganizationSummary {
    const id = String(raw.id ?? raw.orgId ?? raw._id ?? '');
    const name = String(raw.razaoSocial ?? raw.companyName ?? raw.name ?? raw.title ?? '');
    const cnpj = raw.cnpj ?? raw.CNPJ ?? null;
    const memberCount = typeof raw.memberCount === 'number' ? raw.memberCount : (Array.isArray(raw.members) ? raw.members.length : undefined);
    const enabled = raw.enabled === false ? false : true;
    return { id, name, cnpj, memberCount, enabled, ...raw };
  }

  // --- Lazy PDF enrichment ---
  private pdfLookupInProgress = new Set<string>();
  private prefetchPdfInfo(list: AdminTraining[]) {
    for (const t of list) {
      if (!t?.id) continue;
      if ((t.entityType || '').toUpperCase() !== 'EBOOK') continue;
      // Se já detecta PDF, não precisa detalhar
      if (this.trainingHasPdf(t)) continue;
      if (this.pdfLookupInProgress.has(t.id)) continue;
      this.pdfLookupInProgress.add(t.id);
      this.admin.getTrainingById(t.id).subscribe({
        next: detail => {
          // Mescla detalhes (inclui ebookDetails) e força atualização na lista
          this.trainings.update(curr => curr.map(x => x.id === t.id ? { ...x, ...detail } : x));
        },
        error: () => {
          // silencia; poderia logar se necessário
        },
        complete: () => this.pdfLookupInProgress.delete(t.id)
      });
    }
  }

  // --- Setores vinculados ao treinamento ---
  getTrainingSectorAssignments(detail: any): Array<any> {
    if (!detail || typeof detail !== 'object') return [];
    const candidates = [detail.sectorAssignments, detail.trainingSectors, detail.assignedSectors, detail.sectors];
    for (const c of candidates) {
      if (Array.isArray(c)) {
        // normaliza objetos que contenham sectorId / id
        return c.filter(a => a && (a.sectorId || a.id)).map(a => ({
          sectorId: String(a.sectorId || a.id),
            trainingType: a.trainingType || a.type || a.category || null,
            legalBasis: a.legalBasis || a.baseLegal || a.legalBase || null,
            _raw: a
          }));
      }
    }
    return [];
  }

  /**
   * Retorna um rótulo legível para o tipo de vínculo do setor.
   */
  displaySectorType(type: string | null | undefined): string {
    if (!type) return '—';
    let t = String(type).trim().toUpperCase();
    if (!t) return '—';
    // Normalize legacy token OPTIONAL to ELECTIVE
    if (t === 'OPTIONAL') t = 'ELECTIVE';
    switch (t) {
      case 'COMPULSORY':
      case 'MANDATORY':
        return 'Compulsório';
      case 'ELECTIVE':
      case 'OPTIONAL':
        return 'Eletivo';
      default:
        // Fallback: capitaliza
        return t.charAt(0) + t.slice(1).toLowerCase();
    }
  }

  sectorName(id: string | null | undefined): string {
    if (!id) return '';
    const found = this.sectors().find(s => s.id === id);
    return found ? found.name : '';
  }

  /**
   * Retorna um rótulo amigável para o usuário da assinatura.
   * Aceita o objeto de assinatura e tenta resolver, na ordem:
   * - objeto embutido `s.user` (name/email)
   * - campos explícitos como `userEmail`, `customerEmail`
   * - lookup na lista `users` carregada (email)
   * - fallback para ID
   */
  getSubscriptionUserLabel(s: any): string {
    if (!s) return '—';
    // Prefer ownerName when backend provides it (ex: ownerName for organization-owned subscriptions)
    if (s.ownerName) return String(s.ownerName);
    const userObj = s.user || s.customer || null;
    if (userObj) {
      return String(userObj.name || userObj.fullName || userObj.email || userObj.userEmail || userObj.id || '').trim() || '—';
    }
    // try common fields
    const possibleEmail = s.userEmail || s.customerEmail || s.email;
    if (possibleEmail) return String(possibleEmail);
    const id = s.userId || s.user?.id || s.customerId || null;
    if (!id) return '—';
    // try lookup in loaded users
    const found = this.users().find(u => String(u.id) === String(id));
    if (found) return found.email || String(found.id || '—');
    return String(id);
  }

  /**
   * Retorna um rótulo amigável para o plano da assinatura.
   * Procura por nome no objeto `s.plan`, ou na lista `subscriptionPlans` carregada.
   */
  getSubscriptionPlanLabel(s: any): string {
    if (!s) return '—';
    const planObj = s.plan || null;
    if (planObj) return String(planObj.name || planObj.title || planObj.id || '').trim() || '—';
    const possibleName = s.planName || s.planTitle;
    if (possibleName) return String(possibleName);
    const id = s.planId || s.plan?.id || null;
    if (!id) return '—';
    const found = this.subscriptionPlans().find(p => String(p.id) === String(id));
    if (found) return String(found.name || found.title || found.id || '—');
    return String(id);
  }

  /**
   * Retorna o nome do usuário associado à assinatura.
   * Procura por campos embutidos (s.user.*), depois faz lookup em `this.users()`.
   * Se nenhum nome for encontrado retorna 'Não preenchido'.
   */
  getSubscriptionUserName(s: any): string {
    if (!s) return 'Não preenchido';
    // Prefer ownerName when available
    if (s.ownerName) return String(s.ownerName);
    const userObj = s.user || s.customer || null;
    if (userObj) {
      const name = userObj.name || userObj.fullName || userObj.firstName || (userObj.personalProfile && (userObj.personalProfile.fullName || userObj.personalProfile.name));
      return name ? String(name) : 'Não preenchido';
    }
    const id = s.userId || s.customerId || (s.user && s.user.id) || null;
    if (!id) return 'Não preenchido';
    const found = this.users().find(u => String(u.id) === String(id));
    if (found) {
      const name = (found as any).name || (found as any).fullName || ((found as any).personalProfile && ((found as any).personalProfile.fullName || (found as any).personalProfile.name));
      return name ? String(name) : 'Não preenchido';
    }
    return 'Não preenchido';
  }

  /**
   * Normaliza e retorna o rótulo da origem da assinatura.
   * Procura por `origin`, `source`, `originType` ou campos similares e mapeia valores conhecidos.
   */
  getSubscriptionOriginLabel(s: any): string {
    if (!s) return '—';

    // Tenta extrair a origem a partir de várias chaves possíveis e formatos
    const candidates: any[] = [
      s.origin, s.origem, s.source, s.originType, s.origin_type, s.originName, s.originName,
      // estruturas aninhadas comuns
      s.payment?.origin, s.payment?.source, s.metadata?.origin, s.meta?.origin,
      s.data?.origin, s.attributes?.origin, s.payload?.origin
    ];

    let raw: string = '';
    for (const c of candidates) {
      if (c === undefined || c === null) continue;
      if (typeof c === 'object') {
        // se for objeto, tente chaves internas
        const inner = c.type || c.name || c.value || c.origin || c.source;
        if (inner) { raw = String(inner); break; }
      } else {
        const str = String(c || '').trim();
        if (str) { raw = str; break; }
      }
    }

    if (!raw) return '—';
    const v = raw.trim().toUpperCase();
    if (!v) return '—';

    // Normalizações e rótulos legíveis
    if (v === 'MANUAL' || v === 'MANU' || v === 'MANUAIS') return 'Manual';
    if (v === 'API') return 'API';
    if (v === 'IMPORT' || v === 'IMPORTACAO' || v === 'IMPORTAÇÃO') return 'Importação';
    // Cobrir variações como PAYMENT_GATEWAY, PAYMENTGATEWAY, GATEWAY
    if (v.includes('PAYMENT') && v.includes('GATEWAY')) return 'Gateway de Pagamento';
    if (v === 'GATEWAY' || v === 'PAYMENTGATEWAY' || v === 'PAYMENT-GATEWAY') return 'Gateway de Pagamento';

    // fallback para o valor original
    return raw || v;
  }

  removeTrainingSector(trainingId: string, sectorId: string) {
    if (!trainingId || !sectorId) return;
    if (!confirm('Remover vínculo com o setor?')) return;
    this.removingTrainingSectorId.set(sectorId);
    this.admin.unlinkTrainingSector(trainingId, sectorId).subscribe({
      next: () => {
        // Atualiza detalhes selecionados
        this.selectedTrainingDetails.update(d => {
          if (!d) return d;
          const arrays = ['sectorAssignments','trainingSectors','assignedSectors','sectors'];
          for (const key of arrays) {
            if (Array.isArray((d as any)[key])) {
              (d as any)[key] = (d as any)[key].filter((a: any) => (a.sectorId || a.id) !== sectorId);
            }
          }
          return { ...d }; // força mudança
        });
      },
      error: err => alert(err?.message || 'Falha ao remover vínculo'),
      complete: () => this.removingTrainingSectorId.set(null)
    });
  }
}
