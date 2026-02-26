import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';

interface CertificateItem {
  id: string;
  enrollmentId?: string;
  courseTitle: string;
  coverImageUrl?: string;
  issuedAt?: string;
  downloadUrl?: string;
  certificateId?: string | null;
}

@Component({
  selector: 'pros-certificates',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.scss']
})
export class CertificatesComponent {
  private readonly api = new ApiService((window as any).fetch ? undefined as any : undefined as any);
  // Note: above line preserves DI fallback in this standalone file environment.

  isLoading = signal(false);
  error = signal<string | null>(null);
  searchTerm = signal('');
  items = signal<CertificateItem[]>([]);

  constructor(
    private readonly apiService: ApiService,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    const params: any = {};
    if (this.searchTerm() && this.searchTerm().trim().length) {
      params.search = this.searchTerm().trim();
    }
    this.apiService.get<CertificateItem[]>('/api/certificates/my-certificates', { params }).subscribe({
      next: data => {
        this.items.set(data || []);
        this.isLoading.set(false);
      },
      error: err => {
        console.error('[Certificates] failed to load', err);
        this.error.set('Falha ao carregar certificados');
        this.isLoading.set(false);
      }
    });
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    // simple debounce: reload after 350ms
    setTimeout(() => this.load(), 350);
  }

  issueCertificate(item: CertificateItem): void {
    if (!item.enrollmentId) return;
    // Backend retorna um código de validação (string simples, não JSON)
    this.apiService.post<string>(`/api/certificates/issue/${item.enrollmentId}`, {}, { responseType: 'text' as any }).subscribe({
      next: (validationCode) => this.load(),
      error: err => console.error('[Certificates] issue failed', err)
    });
  }

  downloadCertificate(item: CertificateItem): void {
    const certId = item.certificateId || item.id;
    if (!certId) {
      console.error('[Certificates] certificateId not found');
      return;
    }

    const url = this.apiService.createUrl(`/api/certificates/download/${encodeURIComponent(certId)}`);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        try {
          const bUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = bUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          a.download = `certificado-${certId}.pdf`;
          a.click();
          try { URL.revokeObjectURL(bUrl); } catch {}
        } catch (e) {
          window.open(url, '_blank');
        }
      },
      error: (err) => {
        const errMsg = err?.error?.message || err?.message || 'Erro ao baixar certificado';
        console.error('[Certificates] download failed:', errMsg);
      }
    });
  }
}
