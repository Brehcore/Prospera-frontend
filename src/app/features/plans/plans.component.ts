import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogItem, CatalogService } from '../../core/services/catalog.service';
import { PlanCardComponent, Plan } from './plan-card.component';

@Component({
  selector: 'pros-plans',
  standalone: true,
  imports: [CommonModule, RouterLink, PlanCardComponent],
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.scss']
})
export class PlansComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private plansUpdateSub: any;

  plans = signal<Plan[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  enterprisePlans = computed(() => this.getSortedEnterprisePlans());
  otherPlans = computed(() => this.getSortedOtherPlans());

  ngOnInit(): void {
    this.loadPlansFromPublicApi();
    // Recarrega planos quando outro lugar do app notificar mudança
    this.plansUpdateSub = this.catalogService.plansUpdated.subscribe(() => this.loadPlansFromPublicApi());
  }

  private getDurationOrder(days?: number | null): number {
    if (!days) return 999;
    // Anual = 365+ dias
    if (days >= 350) return 1;
    // Semestral = 170-190 dias
    if (days >= 170 && days <= 190) return 2;
    // Mensal = 28-31 dias
    if (days >= 28 && days <= 31) return 3;
    // Outros valores
    return 4;
  }

  private isEnterprisePlan(plan: Plan): boolean {
    const t = String(plan.type || '').trim().toUpperCase();
    return t === 'ENTERPRISE' || t === 'ENTERPRISE_ORGANIZATION' || t === 'ENTERPRISE_ORG' || t === 'ENTERPRISES' || t === 'EMPRESARIAL';
  }

  private getSortedEnterprisePlans(): Plan[] {
    return this.plans()
      .filter(plan => this.isEnterprisePlan(plan))
      .sort((a, b) => this.getDurationOrder(a.durationInDays) - this.getDurationOrder(b.durationInDays));
  }

  private getSortedOtherPlans(): Plan[] {
    return this.plans()
      .filter(plan => !this.isEnterprisePlan(plan))
      .sort((a, b) => this.getDurationOrder(a.durationInDays) - this.getDurationOrder(b.durationInDays));
  }

  retryLoadPlans() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    // Tentar somente o endpoint /plans — sem fallback para catálogo público
    this.catalogService.loadPlansEndpoint().subscribe({
      next: (items: CatalogItem[]) => {
        if (items && items.length) {
          this.plans.set(items.map(i => this.toPlan(i)));
          this.isLoading.set(false);
        } else {
          this.plans.set([]);
          this.isLoading.set(false);
          this.errorMessage.set('Nenhum plano retornado por /plans.');
        }
      },
      error: (err: any) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message ?? 'Falha ao carregar planos via /plans.');
      }
    });
  }

  private loadPlansPreferential() {
    this.catalogService.loadPlansEndpoint().subscribe({
      next: (items: CatalogItem[]) => {
        if (items && items.length) {
          this.plans.set(items.map(i => this.toPlan(i)));
          this.isLoading.set(false);
          return;
        }
        // fallback para catálogo público
        this.catalogService.loadCatalog().subscribe({
          next: (all: CatalogItem[]) => {
            const packages = (all || []).filter(i => i.format === 'PACKAGE');
            this.plans.set(packages.map(i => this.toPlan(i)));
            this.isLoading.set(false);
            if (!this.plans().length) this.errorMessage.set('Nenhum plano disponível no momento.');
          },
          error: (err: any) => {
            this.errorMessage.set(err?.message ?? 'Não foi possível carregar os planos agora.');
            this.isLoading.set(false);
          }
        });
      },
      error: (err: any) => {
        // fallback direto em caso de erro
        this.catalogService.loadCatalog().subscribe({
          next: (all: CatalogItem[]) => {
            const packages = (all || []).filter(i => i.format === 'PACKAGE');
            this.plans.set(packages.map(i => this.toPlan(i)));
            this.isLoading.set(false);
            if (!this.plans().length) this.errorMessage.set('Nenhum plano disponível no momento.');
          },
          error: (err2: any) => {
            this.errorMessage.set(err2?.message ?? 'Não foi possível carregar os planos agora.');
            this.isLoading.set(false);
          }
        });
      }
    });
  }

  private loadPlansFromPublicApi() {
    this.catalogService.loadFromPublicApi('//localhost:8080/public/catalog/plans').subscribe({
      next: (items: any[]) => {
        this.plans.set(items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          originalPrice: item.originalPrice,
          currentPrice: item.currentPrice,
          durationInDays: item.durationInDays,
          type: item.type
        })));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        // Tratamento amigável para falhas de rede/CORS que aparecem como status 0
        // Exemplo: "Http failure response for //localhost:8080/public/catalog/plans: 0 undefined"
        const status = err?.status;
        const msg = err?.message || '';
        if (status === 0 || (typeof msg === 'string' && msg.includes('Http failure response for'))) {
          this.errorMessage.set('Não foi possível conectar ao serviço de planos. Verifique sua conexão com a internet ou se o servidor está acessível e tente novamente.');
        } else {
          this.errorMessage.set(msg || 'Erro ao carregar planos da API pública');
        }
        this.isLoading.set(false);
      }
    });
  }

  trackById(_: number, item: Plan): string {
    return item.id;
  }

  formatLabel(format: CatalogItem['format']): string {
    switch (format) {
      case 'PACKAGE':
        return 'Plano';
      case 'EBOOK':
        return 'E-book';
      case 'RECORDED_COURSE':
        return 'Curso gravado';
      case 'LIVE_TRAINING':
        return 'Treinamento ao vivo';
      default:
        return 'Conteúdo';
    }
  }

  private toPlan(item: CatalogItem): Plan {
    // Tentativa de extrair preços do payload original (backend pode enviar em data ou nos campos diretos futuramente)
    const raw: any = item.data ?? {};
    const original = raw.originalPrice ?? raw.priceOriginal ?? raw.basePrice ?? null;
    const current = raw.currentPrice ?? raw.price ?? raw.finalPrice ?? original ?? null;
    const duration = raw.durationInDays ?? raw.duration ?? raw.days ?? null;
    const type = raw.type ?? null;
    return {
      id: item.id,
      name: item.title,
      description: item.description,
      originalPrice: typeof original === 'number' ? original : null,
      currentPrice: typeof current === 'number' ? current : (typeof original === 'number' ? original : null),
      durationInDays: typeof duration === 'number' ? duration : null,
      sectors: item.sectors,
      type: type
    };
  }

  planTypeLabel(type?: string | null): string {
    const t = String(type || '').trim().toUpperCase();
    if (!t) return '—';
    if (t === 'ENTERPRISE' || t === 'ENTERPRISE_ORGANIZATION' || t === 'ENTERPRISE_ORG' || t === 'ENTERPRISES' || t === 'EMPRESARIAL') {
      return 'Empresarial';
    }
    if (t === 'INDIVIDUAL' || t === 'PERSONAL' || t === 'PESSOAL' || t === 'PERSON') {
      return 'Individual';
    }
    return t[0] + t.slice(1).toLowerCase();
  }
}
