import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface RequestOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  context?: HttpContext;
  withCredentials?: boolean;
  responseType?: 'json';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = this.resolveBaseUrl();

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

  private resolveBaseUrl(): string {
    if (typeof window === 'undefined') {
      return 'https://prospera.gotreeconsultoria.com.br/api';
    }
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    return 'https://prospera.gotreeconsultoria.com.br/api';
  }
}
