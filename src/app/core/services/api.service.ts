import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH } from '../http.tokens';

export interface RequestOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  context?: HttpContext;
  withCredentials?: boolean;
  responseType?: 'json';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  /**
   * Cria uma URL externa baseada em `environment.apiUrl` mas removendo um eventual '/api' final.
   * Use para endpoints públicos que não passam pelo prefixo '/api' do gateway.
   */
  createExternalUrl(path: string): string {
    const base = String(this.baseUrl || '').replace(/\/api\/?$/,'');
    if (!path) return base;
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * Alias para criar URLs públicas (sem /api). Retorna uma URL absoluta.
   */
  createPublicUrl(path: string): string {
    return this.createExternalUrl(path);
  }

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.toAbsoluteUrl(path), options);
  }

  // Public helper for sectors (catálogo público)
  getPublicSectors<T>(): Observable<T> {
    return this.get<T>('/public/catalog/sectors');
  }

  post<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.toAbsoluteUrl(path), body, options);
  }

  patch<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http.patch<T>(this.toAbsoluteUrl(path), body, options);
  }

  put<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http.put<T>(this.toAbsoluteUrl(path), body, options);
  }

  delete<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http.delete<T>(this.toAbsoluteUrl(path), options);
  }

  createUrl(path: string): string {
    return this.toAbsoluteUrl(path);
  }

  private toAbsoluteUrl(path: string): string {
    if (!path) {
      return this.baseUrl;
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    if (path.startsWith('/')) {
      return `${this.baseUrl}${path}`;
    }
    return `${this.baseUrl}/${path}`;
  }
}
