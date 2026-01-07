import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { ApiService } from './api.service';
import { CatalogItem, CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let apiService: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiService = jasmine.createSpyObj<ApiService>('ApiService', ['get']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CatalogService,
        { provide: ApiService, useValue: apiService }
      ]
    });

    service = TestBed.inject(CatalogService);
  });

  it('combina produtos, pacotes e catálogo público sem duplicar itens', (done) => {
    // O serviço agora consome apenas /public/catalog (endpoint unificado).
    const payload = [
      { id: 1, title: 'E-book', description: 'curta', format: 'EBOOK' },
      { id: 1, title: 'E-book', description: 'descrição mais longa que deve prevalecer', format: 'EBOOK' },
      { id: 2, title: 'Combo SST', description: 'Combo', type: 'PACKAGE' }
    ];

    apiService.get.and.callFake((path: string) => {
      if (path === '/public/catalog') return of(payload) as any;
      return of([]) as any;
    });

    service.loadCatalog().subscribe(items => {
      // Deve fazer merge mantendo unicidade por (format::id) e preservar descrição maior
      expect(items.length).toBe(2);
      expect(items.some(item => item.format === 'PACKAGE')).toBeTrue();
      expect(items.some(item => item.format === 'EBOOK' && item.id === '1')).toBeTrue();
      const ebook = items.find(i => i.format === 'EBOOK' && i.id === '1')!;
      expect(ebook.description).toContain('mais longa');
      done();
    });
  });

  it('retorna fallback (vazio) quando /public/catalog falha', (done) => {
    apiService.get.and.returnValue(throwError(() => new Error('fail')) as any);

    service.loadCatalog().subscribe((items: CatalogItem[]) => {
      expect(Array.isArray(items)).toBeTrue();
      expect(items.length).toBe(0);
      done();
    });
  });

  it('carrega setores usando o primeiro endpoint bem-sucedido', (done) => {
    apiService.get.and.callFake((path: string) => {
      if (path === '/api/public/catalog/sectors') {
        return throwError(() => new Error('offline')) as any;
      }
      if (path === '/public/catalog/sectors') {
        return of({ items: [{ id: 'ind', name: 'Indústria' }] }) as any;
      }
      return of([]) as any;
    });

    service.loadSectors().subscribe(sectors => {
      expect(sectors.length).toBe(1);
      const [sector] = sectors;
      expect(sector.id).toBe('ind');
      expect(sector.name).toBe('Indústria');
      done();
    });
  });
});
