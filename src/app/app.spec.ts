import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { App } from './app';
import { AuthService } from './core/services/auth.service';

class AuthServiceStub {
  readonly user$ = of(null);
  readonly isAuthenticated$ = of(false);

  isAuthenticated(): boolean {
    return false;
  }

  hasRole(_role: string): boolean {
    return false;
  }

  logout(): void {}
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: AuthService, useClass: AuthServiceStub }]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render header navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navLabels = Array.from(compiled.querySelectorAll('header nav a')).map(link => link.textContent?.trim());
    expect(navLabels).toContain('Catálogo');
  });
});
