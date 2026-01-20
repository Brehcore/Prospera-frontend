import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { AccountComponent } from './features/account/account.component';
import { CatalogComponent } from './features/catalog/catalog.component';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
	{
		path: '',
		component: HomeComponent
	},
	{
		path: 'catalog',
		component: CatalogComponent,
		data: { title: 'Catálogo' }
	},
	{
		path: 'catalogo',
		redirectTo: 'catalog',
		pathMatch: 'full'
	},
	{
		path: 'entrar',
		redirectTo: '',
		pathMatch: 'full'
	},
	{
		path: 'conta',
		component: AccountComponent,
		canActivate: [authGuard]
	},
	{
		path: 'trainings',
		canActivate: [authGuard],
		loadComponent: () => import('./features/trainings/trainings.component').then(m => m.TrainingsComponent),
		data: { title: 'Treinamentos' }
	},
	{
		path: 'conta/assinatura',
		canActivate: [authGuard],
		loadComponent: () => import('./features/account/subscription-view.component').then(m => m.SubscriptionViewComponent),
		data: { title: 'Minha Assinatura' }
	},
	{
		path: 'planos',
		loadComponent: () => import('./features/plans/plans.component').then(m => m.PlansComponent),
		data: { title: 'Planos' }
	},
	{
		path: 'admin',
		canActivate: [authGuard, adminGuard],
		loadComponent: () => import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
		data: { title: 'Painel Admin' }
	},
	{
		path: 'conteudo/visualizar/:id',
		canActivate: [authGuard],
		loadComponent: () => import('./features/content/content-view.component').then(m => m.ContentViewComponent),
		data: { title: 'Visualizar Conteúdo' }
	},
	{
		path: 'admin/conteudo/:id',
		canActivate: [authGuard, adminGuard],
		loadComponent: () => import('./features/admin/admin-training-detail.component').then(m => m.AdminTrainingDetailComponent),
		data: { title: 'Detalhe Conteúdo' }
	},
	{
		path: 'packages',
		redirectTo: 'planos',
		pathMatch: 'full'
	},
	{
		path: 'contato',
		loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent),
		data: { title: 'Contato' }
	},
	{
		path: 'sobre',
		loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent),
		data: { title: 'Sobre' }
	},
	// E-books route removed
	{
		path: 'agenda',
		loadComponent: () => import('./features/agenda/agenda.component').then(m => m.AgendaComponent),
		data: { title: 'Agenda' }
	},
	{
		path: 'suporte',
		loadComponent: () => import('./features/support/support.component').then(m => m.SupportComponent),
		data: { title: 'Suporte' }
	},
	{
		path: 'faq',
		loadComponent: () => import('./features/faq/faq.component').then(m => m.FaqComponent),
		data: { title: 'FAQ' }
	},
	{
		path: 'reset-password',
		loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
		data: { title: 'Redefinir Senha' }
	},
	{
		path: 'politicas',
		loadComponent: () => import('./features/policies/policies.component').then(m => m.PoliciesComponent),
		data: { title: 'Políticas' }
	},
	{
		path: '**',
		redirectTo: ''
	}
];
