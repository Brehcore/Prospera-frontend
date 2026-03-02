import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { map, filter } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { FooterColumn, FooterLink } from './core/models/footer';
import { NavItem } from './core/models/navigation';
import { AuthService } from './core/services/auth.service';
import { FooterComponent } from './shared/components/layout/footer/footer.component';
import { HeaderComponent } from './shared/components/layout/header/header.component';
import { AuthModalComponent } from './features/auth/auth-modal/auth-modal.component';
import { CatalogDetailsModalComponent } from './shared/components/catalog-details-modal/catalog-details-modal.component';
import { FloatingChatComponent } from './shared/components/floating-chat/floating-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, AuthModalComponent, CatalogDetailsModalComponent, AsyncPipe, FloatingChatComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  showAuthModal = false;
  showFooter = signal(true);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly baseNavItems: NavItem[] = [
    { label: 'Início', route: '/' },
	{ label: 'Catálogo', route: '/catalog' },
    { label: 'Planos', route: '/planos' },
    { label: 'Suporte', route: '/suporte' },
    { label: 'FAQ', route: '/faq' }
  ];

  readonly isAuthenticated$ = this.authService.isAuthenticated$;
  readonly user$ = this.authService.user$;
  readonly navItems$: Observable<NavItem[]> = this.user$.pipe(
    map(() => {
      const items = [...this.baseNavItems];
      if (this.authService.hasRole('SYSTEM_ADMIN')) {
        items.push({ label: 'Admin', route: '/admin' });
      }
      return items;
    })
  );
  readonly accountLabel$ = this.user$.pipe(
    map(user => {
      if (!user) {
        return 'Minha conta';
      }

      const [primary] = [user.name, user.fullName, user.email]
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .filter(value => !!value);

      return primary || 'Minha conta';
    })
  );

  readonly userEmail$ = this.user$.pipe(
    map(user => {
      if (!user) {
        return '';
      }
      return user.email || '';
    })
  );

  readonly isProfileComplete$ = this.user$.pipe(
    map(user => {
      if (!user) {
        return false;
      }
      // Verificar se os campos principais estão preenchidos
      return !!(user.name || user.fullName) && !!user.email;
    })
  );

  readonly accountMenuItems = [
    { id: 'profile', label: 'Minha Conta', icon: 'fas fa-user' },
    { id: 'manageCompanies', label: 'Gerenciar Empresas', icon: 'fas fa-building' },
    { id: 'plans', label: 'Planos & Assinatura', icon: 'fas fa-layer-group' },
    { id: 'learning', label: 'Cursos & Treinamentos', icon: 'fas fa-graduation-cap' },
    { id: 'certificates', label: 'Certificados', icon: 'fas fa-certificate' }
  ];

  readonly footerDescription =
    'Plataforma integrada para desenvolver talentos, promover bem-estar e garantir conformidade nas organizações.';

  readonly footerColumns: FooterColumn[] = [
    {
      title: 'Plataforma',
      links: [
        { label: 'Como funciona', route: '/sobre' },
  { label: 'Catálogo de treinamentos', route: '/catalog' },
  // E-books removed from footer per request
      ]
    },
    {
      title: 'Recursos',
      links: [
        { label: 'Calendário de eventos', route: '/agenda' },
        { label: 'Central de suporte', route: '/suporte' },
        { label: 'Perguntas frequentes', route: '/faq' }
      ]
    },
    {
      title: 'Institucional',
      links: [
        { label: 'Sobre a Prospera', route: '/sobre' },
        { label: 'Políticas e LGPD', route: '/politicas' },
        { label: 'Fale conosco', route: '/suporte' }
      ]
    }
  ];

  readonly socialLinks: FooterLink[] = [
    {
      label: 'LinkedIn',
      externalUrl: 'https://linkedin.com/company/go-tree-consultoria',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zm7.5 0h3.8v2.15h.05c.53-1 1.84-2.15 3.79-2.15 4.05 0 4.8 2.67 4.8 6.15V23h-4v-7.25c0-1.73-.03-3.95-2.4-3.95-2.4 0-2.77 1.87-2.77 3.8V23h-4V8z"/></svg>`
    },
    {
      label: 'Instagram',
      externalUrl: 'https://instagram.com/gotreeconsultoria',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 1 0 12 7.3m0-2.3c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5m6.5-.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2M12 2c-2.84 0-3.2.01-4.32.06-1.11.05-1.87.22-2.54.47a5.1 5.1 0 0 0-1.85 1.2 5.1 5.1 0 0 0-1.2 1.85c-.25.67-.42 1.43-.47 2.54C1 11.8 1 12.16 1 15s.01 3.2.06 4.32c.05 1.11.22 1.87.47 2.54a5.1 5.1 0 0 0 1.2 1.85 5.1 5.1 0 0 0 1.85 1.2c.67.25 1.43.42 2.54.47 1.12.05 1.48.06 4.32.06s3.2-.01 4.32-.06c1.11-.05 1.87-.22 2.54-.47a5.1 5.1 0 0 0 1.85-1.2 5.1 5.1 0 0 0 1.2-1.85c.25-.67.42-1.43.47-2.54.05-1.12.06-1.48.06-4.32s-.01-3.2-.06-4.32c-.05-1.11-.22-1.87-.47-2.54a5.1 5.1 0 0 0-1.2-1.85 5.1 5.1 0 0 0-1.85-1.2c-.67-.25-1.43-.42-2.54-.47C15.2 2.01 14.84 2 12 2m0 1.8c2.78 0 3.11.01 4.21.06.97.04 1.49.21 1.84.35.46.18.79.39 1.14.74.35.35.56.68.74 1.14.14.35.31.87.35 1.84.05 1.1.06 1.43.06 4.21s-.01 3.11-.06 4.21c-.04.97-.21 1.49-.35 1.84a3.3 3.3 0 0 1-.74 1.14 3.3 3.3 0 0 1-1.14.74c-.35.14-.87.31-1.84.35-1.1.05-1.43.06-4.21.06s-3.11-.01-4.21-.06c-.97-.04-1.49-.21-1.84-.35a3.3 3.3 0 0 1-1.14-.74 3.3 3.3 0 0 1-.74-1.14c-.14-.35-.31-.87-.35-1.84-.05-1.1-.06-1.43-.06-4.21s.01-3.11.06-4.21c.04-.97.21-1.49.35-1.84.18-.46.39-.79.74-1.14.35-.35.68-.56 1.14-.74.35-.14.87-.31 1.84-.35 1.1-.05 1.43-.06 4.21-.06"/></svg>`
    }
  ];

  readonly currentYear = new Date().getFullYear();

  constructor() {
    // Detectar quando estamos na página de visualização de EBOOK
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Esconder footer nas rotas de visualização de aulas (student player):
      // - /conteudo/visualizar/:id (legacy/content-view)
      // - /treinamento/:id (student training-detail)
      const isLessonViewer = /^\/conteudo\/visualizar\//.test(event.urlAfterRedirects) || /^\/treinamento\//.test(event.urlAfterRedirects);
      this.showFooter.set(!isLessonViewer);
    });
  }

  onAccountClick(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/conta']);
    } else {
      this.showAuthModal = true;
    }
  }

  onCloseAuthModal(): void {
    this.showAuthModal = false;
  }

  onLogout(): void {
    this.authService.logout();
  }

  onMenuItemClick(menuId: string): void {
    // Navegar para certificados se for o item correspondente
    if (menuId === 'certificates') {
      this.router.navigate(['/certificados']);
      return;
    }
    // Navegar para a página de conta com a seção selecionada
    this.router.navigate(['/conta'], { queryParams: { section: menuId } });
  }

}
