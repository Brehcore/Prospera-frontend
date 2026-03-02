import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Plan {
  id: string;
  name: string;
  description: string;
  originalPrice?: number | null;
  currentPrice?: number | null;
  durationInDays?: number | null;
  sectors?: string[];
  type?: string | null;
}

@Component({
  selector: 'pros-plan-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <article class="plan-card" [attr.data-discount]="showDiscount() ? 'true' : null">
    <header class="plan-header">
      <span class="badge" *ngIf="durationLabel()">{{ durationLabel() }}</span>
      <h2>{{ plan?.name }}</h2>
      <p class="plan-type">{{ planTypeLabel(plan?.type) }}</p>
    </header>
    <p class="plan-description">{{ plan?.description }}</p>

    <div class="plan-pricing" *ngIf="plan?.currentPrice; else priceFallback">
      <div class="price-values">
        <span class="price-old" *ngIf="showDiscount()">{{ formatPrice(plan!.originalPrice!) }}</span>
        <span class="price-current">{{ formatPrice(plan!.currentPrice!) }}</span>
      </div>
      <span class="price-badge" *ngIf="showDiscount()">-{{ discountPercent() }}%</span>
    </div>
    <ng-template #priceFallback>
      <div class="plan-pricing plan-pricing--pending">
        <span class="price-current">Sob consulta</span>
      </div>
    </ng-template>

    <div class="plan-actions">
      <a class="btn btn-primary" routerLink="/suporte">Falar com um especialista</a>
    </div>
  </article>
  `,
  styleUrls: ['./plan-card.component.scss']
})
export class PlanCardComponent {
  @Input() plan: Plan | null = null;
  // auto-referência para evitar possíveis otimizações/avisos de template tooling
  readonly self = PlanCardComponent;

  private readonly currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  durationLabel = computed(() => this.buildDurationLabel(this.plan?.durationInDays));

  showDiscount = computed(() => {
    if (!this.plan?.originalPrice || !this.plan?.currentPrice) return false;
    return this.plan.originalPrice > this.plan.currentPrice;
  });

  discountPercent = computed(() => {
    if (!this.showDiscount()) return 0;
    const diff = (this.plan!.originalPrice! - this.plan!.currentPrice!);
    return Math.round((diff / this.plan!.originalPrice!) * 100);
  });

  formatPrice(value: number) {
    return this.currency.format(value);
  }

  // Retorna o rótulo do tipo do plano em português
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

  // Mostra o rótulo do setor; se o setor for 'global' usa o tipo do plano
  displaySectorLabel(sector?: string | null): string {
    const s = String(sector || '').trim();
    if (!s) return '—';
    if (s.toLowerCase() === 'global') {
      return this.planTypeLabel(this.plan?.type);
    }
    return s.toUpperCase();
  }

  private buildDurationLabel(days?: number | null): string {
    if (!days) return '';
    if (days >= 28 && days <= 31) return 'Mensal';
    if (days >= 85 && days <= 95) return 'Trimestral';
    if (days >= 170 && days <= 190) return 'Semestral';
    if (days >= 360 && days <= 370) return 'Anual';
    if (days === 7) return 'Semanal';
    return `${days} dias`;
  }
}
