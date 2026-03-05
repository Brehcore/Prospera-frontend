import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, defaultIfEmpty, filter, forkJoin, from, map, of, switchMap, take, tap, Subject } from 'rxjs';
import { SKIP_AUTH } from '../http.tokens';

import { ApiService } from './api.service';

export type CatalogFormat = 'EBOOK' | 'RECORDED_COURSE' | 'LIVE_TRAINING' | 'PACKAGE';

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  format: CatalogFormat;
  entityType?: string | null;
  sectors: string[];
  author?: string | null;
  coverImageUrl?: string | null;
  data?: unknown;
}

export interface CatalogSector {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  // Emite quando os planos/catalogo mudam (criação/atualização) permitindo que consumidores recarreguem
  plansUpdated = new Subject<void>();

  notifyPlansUpdated() {
    try { this.plansUpdated.next(); } catch (e) { /* no-op */ }
  }
  constructor(private readonly api: ApiService, private http: HttpClient) {}

  /**
   * Lista todo o catálogo público usando o endpoint único /public/catalog (resumido).
   * Fallback: se falhar, recorre ao modelo antigo (products + packages + ebooks).
   */
  loadCatalog() {
    const fallback$ = of([] as CatalogItem[]); // métodos legados removidos

    return this.fetchPublicCatalogAll().pipe(
      map(items => this.mergeDistinct(items)),
      catchError(err => {
        console.warn('[CatalogService] falha em /public/catalog, aplicando fallback composto.', err);
        return fallback$;
      })
    );
  }

  // Métodos legados de pacotes/planos foram removidos após adoção de /public/catalog.

  // loadEbooks() removido (catálogo consolidado). Manter fallback se necessário em outro serviço especializado.

  loadSectors() {
    const endpoints = ['/api/public/catalog/sectors', '/public/catalog/sectors'];
    return from(endpoints).pipe(
      switchMap(endpoint =>
        this.api.get<any>(endpoint).pipe(
          map(response => {
            const list = Array.isArray(response)
              ? response
              : Array.isArray(response?.items)
              ? response.items
              : Array.isArray(response?.data)
              ? response.data
              : [];
            return list.filter(Boolean).map((item: CatalogSector | any) => this.normalizeSector(item));
          }),
          catchError(() => of([] as CatalogSector[]))
        )
      ),
      filter(sectors => sectors.length > 0),
      take(1),
      defaultIfEmpty([] as CatalogSector[])
    );
  }

  // fetchProducts / fetchPackages removidos (consolidados em catálogo público).

  /**
   * Tenta buscar planos em endpoints públicos, retornando assim que um deles responder com dados.
   */
  // fetchPlans removido – planos agora fazem parte do catálogo público.

  // fetchPublicCatalog por tipo removido – endpoint único cobre todos os formatos.

  /**
   * Busca catálogo completo resumido (todos os formatos) sem filtro de tipo.
   */
  private fetchPublicCatalogAll() {
  return this.api.get<any>('/public/catalog').pipe(
    tap(data => console.debug('[CatalogService] GET /public/catalog =>', data)),
    map(data => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : [];
        return list.map((item: any) =>
          this.toCatalogItem(
            item,
            this.normalizeFormat(item?.format ?? item?.type ?? item?.trainingType ?? item?.entityType) ?? 'EBOOK',
            item.coverImageUrl ?? item.imageUrl ?? null
          )
        );
      })
    );
  }

  /**
   * Busca possíveis planos/pacotes dentro do catálogo público.
   * Usa /public/catalog e filtra por formato PACKAGE (ou por heurística quando necessário).
   */
  loadPlansEndpoint() {
    return this.api.get<any>('/public/catalog/plans').pipe(
      tap(data => console.debug('[CatalogService] GET /public/catalog/plans =>', data)),
      map(data => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : [];
        // filtra itens que parecem pacotes/plano (formato PACKAGE ou type/package)
        const filtered = list.filter((item: any) => {
          const t = (item?.format ?? item?.type ?? '').toString().toUpperCase();
          const hasPrice = (typeof item?.originalPrice === 'number') || (typeof item?.currentPrice === 'number');
          const hasDuration = typeof item?.durationInDays === 'number' || typeof item?.duration === 'number';
          // aceitável: PACKAGE/PLAN/SUBSCRIPTION, flags isPackage, tipos ENTERPRISE/INDIVIDUAL,
          // ou qualquer item que tenha preços e duração (provável plano)
          return (
            t === 'PACKAGE' || t === 'PLAN' || t === 'SUBSCRIPTION' || t === 'PACKAGE' ||
            t === 'ENTERPRISE' || t === 'INDIVIDUAL' || (item?.isPackage === true) ||
            (hasPrice && hasDuration)
          );
        });
        return filtered.map((item: any) => this.toCatalogItem(item, 'PACKAGE', item.coverImageUrl ?? item.imageUrl ?? null));
      }),
      catchError(err => {
        console.warn('[CatalogService] falha em /public/catalog/plans (plans fallback)', err);
        return of([] as CatalogItem[]);
      })
    );
  }

  /**
   * Carrega dados de um endpoint público.
   */
  loadFromPublicApi(endpoint: string) {
    // Se for URL absoluta, usa diretamente; senão, monta a URL pública (sem /api) e faz a requisição
    const url = /^https?:\/\//i.test(endpoint) ? endpoint : this.api.createPublicUrl(endpoint);
    // Requisições para o catálogo público não devem incluir Authorization (rota pública)
    const context = new HttpContext().set(SKIP_AUTH, true);
    return this.api.get<any[]>(url, { context });
  }

  /**
   * Faz merge garantindo unicidade por (format::id) e mantém descrição mais longa.
   */
  private mergeDistinct(items: CatalogItem[]): CatalogItem[] {
    const mapById = new Map<string, CatalogItem>();
    for (const item of items) {
      const key = `${item.format}::${item.id}`;
      if (!mapById.has(key)) {
        mapById.set(key, item);
      } else {
        const existing = mapById.get(key)!;
        if ((item.description?.length ?? 0) > (existing.description?.length ?? 0)) {
          mapById.set(key, item);
        }
      }
    }
    return Array.from(mapById.values());
  }

  private toCatalogItem(raw: any, fallbackFormat: CatalogFormat, cover: string | null): CatalogItem {
    const sectors = Array.isArray(raw?.sectors)
      ? raw.sectors
      : Array.isArray(raw?.assignedSectors)
      ? raw.assignedSectors
      : ['global'];
    return {
  id: String(raw?.id ?? raw?.uuid ?? raw?.code ?? `item-${Math.random().toString(36).slice(2, 9)}`),
      title: raw?.title ?? raw?.name ?? 'Item',
      description: raw?.description ?? raw?.shortDescription ?? '',
      format: this.normalizeFormat(raw?.format ?? raw?.type ?? raw?.trainingType) ?? fallbackFormat,
      entityType: (raw?.entityType ?? raw?.format ?? raw?.type ?? raw?.trainingType) ?? null,
      sectors: sectors.map((sector: any) =>
        typeof sector === 'string' ? sector : sector?.id ?? sector?.code ?? 'global'
      ),
      author: raw?.author ?? raw?.creator ?? raw?.publisher ?? null,
      coverImageUrl: cover || undefined,
      data: raw
    };
  }

  private normalizeFormat(value: string | undefined): CatalogFormat | null {
    if (!value) {
      return null;
    }
    const normalized = value.toUpperCase();
    if (normalized.includes('EBOOK')) {
      return 'EBOOK';
    }
    if (normalized.includes('RECORDED') || normalized.includes('GRAV')) {
      return 'RECORDED_COURSE';
    }
    if (normalized.includes('LIVE') || normalized.includes('AO_VIVO')) {
      return 'LIVE_TRAINING';
    }
    if (normalized.includes('PACKAGE')) {
      return 'PACKAGE';
    }
    return null;
  }

  private normalizeSector(sector: CatalogSector | any): CatalogSector {
    return {
      id: String(sector?.id ?? sector?.uuid ?? sector?.code ?? sector?.slug ?? 'global'),
      name: sector?.name ?? sector?.title ?? sector?.label ?? 'Setor'
    };
  }

  // Fallbacks específicos removidos. Caso necessário, extrair para um seed estático em outro módulo.
}
